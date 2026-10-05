import * as THREE from 'three';
import { Physics } from './physics.js';
import { Builder } from './builder.js';
import { makeWorldUniforms, worldMaterial, glowMaterial, makeSky, makeGlassMaterial } from './materials.js';
import { chamferBox } from './geometry.js';
import { FEEL } from './player.js';
import { audio } from './audio.js';
import { music } from './music.js';

// The runtime for whichever level is loaded: environment, echoes, liquids, wires,
// checkpoints, pickups, triggers and camera zones. Level-specific rules live in the
// level module's fixed()/update()/onEcho() hooks.

class Wire {
  constructor(pts, o) {
    this.pts = pts; this.enabled = true; this.oneWay = o.oneWay || 0; this.o = o;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.len = this.cum[this.cum.length - 1];
    this._t = new THREE.Vector3();
  }
  seg(s) { let i = 1; while (i < this.cum.length - 1 && this.cum[i] < s) i++; return i; }
  point(s, out) {
    const i = this.seg(s), a = this.pts[i - 1], b = this.pts[i];
    const k = (s - this.cum[i - 1]) / Math.max(1e-6, this.cum[i] - this.cum[i - 1]);
    return out.copy(a).lerp(b, Math.max(0, Math.min(1, k)));
  }
  tangent(s) { const i = this.seg(s); return this._t.subVectors(this.pts[i], this.pts[i - 1]).normalize(); }
  closest(x, y, z) {
    let best = { d: Infinity, s: 0 };
    const p = new THREE.Vector3(x, y, z), ab = new THREE.Vector3(), ap = new THREE.Vector3();
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      ab.subVectors(b, a); ap.subVectors(p, a);
      const L2 = ab.lengthSq();
      const k = Math.max(0, Math.min(1, ap.dot(ab) / L2));
      const d = ap.addScaledVector(ab, -k).length();
      if (d < best.d) best = { d, s: this.cum[i - 1] + k * Math.sqrt(L2) };
    }
    return best;
  }
}

const inBox = (b, p, pad = 0) => p.x >= b.min[0] - pad && p.x <= b.max[0] + pad && p.y >= b.min[1] - pad && p.y <= b.max[1] + pad && p.z >= b.min[2] - pad && p.z <= b.max[2] + pad;

export class World {
  constructor(game) {
    this.g = game;
    this.scene = game.scene;
    this.hemi = new THREE.HemisphereLight(0x8888aa, 0x222233, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0x000000, 20, 200);
    this.root = null;
    this.def = null;
    this.echoGeo = chamferBox(FEEL.echoSize[0], FEEL.echoSize[1], FEEL.echoSize[2], 0.17, 0xffffff);
    this.t = 0;
  }

  unload() {
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse((o) => {
        if (o.geometry && o.geometry !== this.echoGeo) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
    }
    if (this.sky) { this.scene.remove(this.sky); this.sky.material.dispose(); }
    music.stopSpatials();
    this.root = null;
  }

  load(def, opts = {}) {
    this.unload();
    this.def = def;
    this.t = 0;
    const env = def.env;
    this.physics = this.g.physics = new Physics();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.U = makeWorldUniforms(env);
    this.worldMat = worldMaterial(this.U);
    this.swayMat = worldMaterial(this.U, { sway: true });
    this.glowMat = glowMaterial();
    this.sky = makeSky(env);
    this.scene.add(this.sky);
    this.applyEnv(env);

    this.timers = [];
    this.movers = []; this.waters = []; this.wires = []; this.checkpoints = []; this.pickups = [];
    this.triggers = []; this.camZones = []; this.prompts = []; this.echoes = []; this.animated = [];
    this.spawnPoint = { x: 0, y: 0, z: 0, yaw: 0 };
    this.cp = null;
    this.depth = 0;
    this.killY = def.killY ?? -40;
    this.echoMode = def.echoMode || 'solid';

    const L = new Builder(this, def);
    this.state = def.build(L, this.g) || {};
    L.finish();
    if (env.motes) this.makeMotes(env.motes);

    const save = this.g.save;
    for (const p of this.pickups) {
      p.taken = p.kind === 'ident' ? save.hasIdent(def.id) : p.kind === 'ability' ? save.data.abilities[p.ability] : save.has(def.id, p.id);
      if (p.taken && p.mesh.userData.setGhost) p.mesh.userData.setGhost(true);
    }
    music.play(def.music);
    music.setDepth(0);
    let sp = this.spawnPoint;
    if (opts.at) sp = opts.at;
    if (opts.checkpoint !== undefined && this.checkpoints[opts.checkpoint]) {
      this.activate(this.checkpoints[opts.checkpoint], true);
      sp = this.respawnPoint();
    }
    this.startPoint = { ...this.spawnPoint };
    return sp;
  }

  applyEnv(env) {
    const f = env.fog || [0x000000, 20, 200];
    this.scene.fog.color.set(f[0]); this.scene.fog.near = f[1]; this.scene.fog.far = f[2];
    this.g.renderer.setClearColor(f[0]);
    const h = env.hemi || [0x8888aa, 0x222233, 1.2];
    this.hemi.color.set(h[0]); this.hemi.groundColor.set(h[1]); this.hemi.intensity = h[2];
    const s = env.sun || [0xffffff, 1, [0.4, 1, 0.3]];
    this.sun.color.set(s[0]); this.sun.intensity = s[1];
    this.sun.position.set(...s[2]).multiplyScalar(50); this.sun.target.position.set(0, 0, 0);
    this.echoColor = env.echo ?? 0xffe8c0;
  }

  makeMotes(o) {
    const n = o.count ?? 240, R = 26;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) p[i] = (Math.random() * 2 - 1) * R;
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: o.color ?? 0xffffff, size: o.size ?? 0.08, transparent: true, opacity: o.opacity ?? 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    this.root.add(pts);
    const drift = o.drift ?? [0.2, 0.1, 0.15];
    this.animated.push((dt) => {
      const c = this.g.camera.position;
      for (let i = 0; i < n; i++) {
        let x = p[i * 3] + drift[0] * dt, y = p[i * 3 + 1] + drift[1] * dt * Math.sin(i + this.t * 0.3), z = p[i * 3 + 2] + drift[2] * dt;
        // wrap into a box around the camera
        x = ((x - c.x + R) % (2 * R) + 2 * R) % (2 * R) - R + c.x;
        y = ((y - c.y + R) % (2 * R) + 2 * R) % (2 * R) - R + c.y;
        z = ((z - c.z + R) % (2 * R) + 2 * R) % (2 * R) - R + c.z;
        p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      }
      g.attributes.position.needsUpdate = true;
    });
  }

  // ---- registration (called by Builder) ----
  addWire(pts, o) { const w = new Wire(pts, o); this.wires.push(w); return w; }
  addCheckpoint(c) { c.index = this.checkpoints.length; this.checkpoints.push(c); return c; }
  addPickup(p) { this.pickups.push(p); return p; }
  addTrigger(t) { t.inside = false; this.triggers.push(t); return t; }
  addCamZone(z) { this.camZones.push(z); return z; }
  addPrompt(p) { this.prompts.push(p); return p; }
  onFrame(f) { this.animated.push(f); }

  camZoneAt(p) {
    let hit = null;
    for (const z of this.camZones) if (!z.disabled && inBox(z, p)) hit = z;
    return hit;
  }

  liquidAt(x, z) {
    let best = null;
    for (const w of this.waters) {
      if (w.disabled || Math.abs(x - w.x) > w.w / 2 || Math.abs(z - w.z) > w.d / 2) continue;
      let y = w.level;
      if (w.amp) {
        const f = w.freq, t = this.t;
        y += (Math.sin(x * f + t * 1.1) * 0.6 + Math.sin(z * f * 1.3 - t * 0.9) * 0.5 + Math.sin((x + z) * f * 2.1 + t * 1.7) * 0.25) * w.amp;
      }
      if (!best || y > best.y) best = { y, liquid: w.liquid, water: w };
    }
    return best;
  }

  respawnPoint() { return this.cp ? { x: this.cp.x, y: this.cp.y + 0.05, z: this.cp.z, yaw: this.cp.yaw ?? this.g.player.facing } : { ...this.startPoint }; }

  activate(cp, silent = false) {
    if (this.cp === cp) return;
    this.cp = cp;
    const d = cp.depth ?? cp.index + 1;
    if (d > this.depth) { this.depth = d; music.setDepth(d); }
    this.g.save.setResume(this.def.id, cp.index);
    if (!silent) {
      audio.checkpoint();
      this.g.fx.ring(cp.x, cp.y + 0.05, cp.z, { r0: 0.3, r1: 3.5, dur: 0.8, color: this.def.palette.accent ?? 0xffc070 });
      this.g.fx.burst(cp.x, cp.y + 1.8, cp.z, { count: 12, color: this.def.palette.accent ?? 0xffc070, speed: 2, size: 0.15 });
    }
    if (this.def.onCheckpoint) this.def.onCheckpoint(this.state, cp, this.g);
  }

  // ---- echoes ----
  spawnEcho(player) {
    const P = player.pos, b = player.body;
    const [ex, ey, ez] = FEEL.echoSize;
    for (const e of this.echoes) if (!e.dead) this.expireEcho(e, true);
    const e = { life: this.def.echoLife ?? FEEL.echoLife, max: 0, dead: false, mode: this.echoMode, x: P.x, z: P.z, y: 0, floating: false };
    if (b.grounded) {
      e.y = P.y + ey / 2;
      if (this.physics.isFree(P.x, P.y + ey, P.z, b.hw, b.h)) P.y += ey;
    } else e.y = P.y - ey / 2 - 0.02;
    e.max = e.life;
    if (e.mode !== 'hole') {
      e.col = this.physics.addBox(e.x - ex / 2, e.y - ey / 2, e.z - ez / 2, e.x + ex / 2, e.y + ey / 2, e.z + ez / 2, { kinematic: true, tag: 'echo' });
      e.col.data = e;
      e.mat = makeGlassMaterial(this.echoColor, { core: 0.22 });
      e.mesh = new THREE.Mesh(this.echoGeo, e.mat);
      e.mesh.position.set(e.x, e.y, e.z);
      this.root.add(e.mesh);
    }
    this.echoes.push(e);
    this.g.fx.ring(e.x, e.y + 0.1, e.z, { r0: 0.4, r1: 4.5, dur: 0.7, color: this.echoColor, alpha: 0.7 });
    this.g.fx.burst(e.x, e.y, e.z, { count: 16, color: this.echoColor, speed: 3.5, flatten: 0.15, size: 0.18, life: 0.5 });
    if (this.def.onEcho) this.def.onEcho(this.state, e, this.g);
    return e;
  }

  expireEcho(e, replaced = false) {
    if (e.dead) return;
    e.dead = true;
    if (e.col) { this.physics.remove(e.col); e.col.enabled = false; }
    if (e.mesh) { this.root.remove(e.mesh); e.mat.dispose(); }
    if (!replaced) audio.echoFade();
    this.g.fx.burst(e.x, e.y, e.z, { count: 18, color: this.echoColor, speed: 1.8, size: 0.14, life: 0.8, drag: 3 });
    if (this.def.onEchoEnd) this.def.onEchoEnd(this.state, e, this.g);
  }

  updateEchoes(dt) {
    for (const e of this.echoes) {
      if (e.dead) continue;
      const liq = e.col ? this.liquidAt(e.x, e.z) : null;
      if (liq && liq.liquid === 'water' && liq.y > e.y - FEEL.echoSize[1]) {
        if (!e.floating) { e.floating = true; e.life = Math.max(e.life, this.def.echoLifeWater ?? 8); e.max = e.life; audio.splash(0.2); }
      }
      if (e.floating && liq) {
        const ny = liq.y + 0.05;
        e.y += (ny - e.y) * Math.min(1, dt * 10);
        e.col.moveTo(e.x, e.y, e.z);
      }
      if (!e.frozen) e.life -= dt;
      if (e.mesh) {
        e.mesh.position.set(e.x, e.y, e.z);
        const warn = e.life < 0.9 ? 0.55 + 0.45 * Math.sign(Math.sin(e.life * 30)) : 1;
        e.mat.uniforms.uAlpha.value = Math.min(1, (e.max - e.life) * 8) * warn;
        e.mat.uniforms.uTime.value = this.t;
        const pop = Math.max(0, 1 - (e.max - e.life) * 6);
        e.mesh.scale.set(1 + pop * 0.3, 1 - pop * 0.4, 1 + pop * 0.3);
      }
      if (e.life <= 0) this.expireEcho(e);
    }
    this.echoes = this.echoes.filter((e) => !e.dead);
  }

  // ---- per step ----
  fixedUpdate(dt) {
    const g = this.g, p = g.player, P = p.pos;
    this.t += dt;
    if (this.def.fixed) this.def.fixed(this.state, dt, g);
    this.updateEchoes(dt);
    // kinematics that moved into Pip push it out
    for (const c of this.physics.kinematic) {
      if ((c.dx || c.dy || c.dz) && c !== p.body.ground && c.enabled && p.state === 'play') this.physics.depenetrate(p.body, c);
    }
    p.fixedUpdate(dt, g.stepInput, g.rig.yaw);
    this.physics.clearDeltas();
    if (p.state !== 'play' && p.state !== 'line') return;

    const c = { x: P.x, y: P.y + 0.45, z: P.z };
    for (const t of this.triggers) {
      if (t.disabled) continue;
      const inside = inBox(t, c);
      if (inside && !t.inside) { t.inside = true; if (t.enter) t.enter(g, t); if (t.once) t.disabled = true; }
      else if (!inside && t.inside) { t.inside = false; if (t.exit) t.exit(g, t); }
      if (inside && t.stay) t.stay(g, dt, t);
    }
    for (const cp of this.checkpoints) {
      if (cp !== this.cp && Math.hypot(P.x - cp.x, P.z - cp.z) < 1.4 && Math.abs(P.y - cp.y) < 2.2) this.activate(cp);
    }
    for (const pk of this.pickups) {
      if (pk.taken || pk.hidden) continue;
      const r = pk.radius ?? 1.1;
      if (Math.hypot(P.x - pk.x, P.z - pk.z) < r && P.y + 0.9 > pk.y - r && P.y < pk.y + r) this.collect(pk);
    }
  }

  collect(pk) {
    const g = this.g;
    pk.taken = true;
    if (pk.mesh.userData.setGhost) pk.mesh.userData.setGhost(true);
    g.fx.burst(pk.x, pk.y, pk.z, { count: 40, color: 0xfff0c8, speed: 5, size: 0.2, life: 0.9 });
    g.fx.ring(pk.x, pk.y, pk.z, { r0: 0.5, r1: 6, dur: 0.9, color: 0xfff0c8 });
    g.fx.hitStop(pk.kind === 'ident' ? 0.18 : 0.07);
    if (pk.kind === 'ident') { audio.ident(); g.completeLevel(this.def.id, pk); }
    else {
      audio.pickup(pk.kind);
      if (pk.kind === 'ability') g.save.giveAbility(pk.ability);
      else g.save.collect(this.def.id, pk.id);
      g.ui.collected(pk, this.def);
    }
    if (this.def.onPickup) this.def.onPickup(this.state, pk, g);
  }

  onLand(player, k) { if (this.def.onLand) this.def.onLand(this.state, player, k, this.g); }
  onLine(w) { if (this.def.onLine) this.def.onLine(this.state, w, this.g); }
  onDeath() { for (const e of this.echoes) this.expireEcho(e, true); this.echoes = []; }
  onRespawn() { if (this.def.onRespawn) this.def.onRespawn(this.state, this.g); }

  // ---- per frame ----
  // Game-time delay for level sequences: frozen while paused, dropped when the level unloads.
  after(sec, fn) { this.timers.push({ t: sec, fn }); }

  update(dt) {
    const U = this.U, t = this.t;
    if (this.timers.length) {
      const due = this.timers.filter((tm) => (tm.t -= dt) <= 0);
      this.timers = this.timers.filter((tm) => tm.t > 0);
      for (const tm of due) tm.fn();
    }
    U.uTime.value = t;
    this.sky.material.uniforms.uTime.value = t;
    this.sky.position.copy(this.g.camera.position);
    for (const w of this.waters) w.mat.uniforms.uTime.value = t;
    for (const w of this.waters) if (w.mat.uniforms.uAmp) { w.mat.uniforms.uAmp.value = w.amp; w.mat.uniforms.uFreq.value = w.freq; }
    for (const c of this.checkpoints) c.mesh.userData.tick(t, dt, c === this.cp);
    for (const p of this.pickups) if (p.mesh.userData.tick) p.mesh.userData.tick(t + p.x * 0.1, dt);
    for (const f of this.animated) f(dt, t);
    if (this.def.update) this.def.update(this.state, dt, this.g);
  }
}
