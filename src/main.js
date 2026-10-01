import * as THREE from 'three';
import { Input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { PipModel } from './pip.js';
import { CameraRig } from './camera.js';
import { FX } from './fx.js';
import { Save } from './save.js';
import { UI } from './ui.js';
import { audio } from './audio.js';
import { music } from './music.js';
import { LEVELS, ORDER } from './levels/index.js';

const STEP = 1 / 120;
const MAX_PR = Math.min(window.devicePixelRatio || 1, 1.5);

class Game {
  constructor() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.pr = MAX_PR;
    r.setPixelRatio(this.pr);
    r.setSize(innerWidth, innerHeight);
    document.getElementById('app').append(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1400);
    this.save = new Save();
    this.input = new Input(r.domElement);
    this.fx = new FX(this.scene);
    this.world = new World(this);
    this.player = new Player(this);
    this.pip = new PipModel(this.scene);
    this.pip.onHum = () => this.hum();
    this.rig = new CameraRig(this.camera);
    this.ui = new UI(this);
    this.mode = 'title';
    this.frame = 0; this.time = 0; this.acc = 0; this.fps = 60; this.ftAvg = 16;
    this.renderPos = new THREE.Vector3();
    this.stepInput = { x: 0, z: 0, jump: false, jumpHeld: false, action: false };
    this.errors = [];

    this.input.onFirstGesture = () => {
      audio.init();
      const s = this.save.data.settings;
      audio.setVolumes({ music: s.music, sfx: s.sfx });
      music.resumePending();
      if (this.world.def) music.play(this.world.def.music);
    };
    addEventListener('resize', () => this.resize());
    this.resize();

    this.loadLevel('hub');
    this.ui.showTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  get physics() { return this.world.physics; }
  set physics(p) { /* owned by world */ }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.fx.resize(innerHeight * this.pr, this.camera.fov);
  }

  // Direct load with no transition (used by the tests and internally).
  loadLevel(id, opts = {}) {
    const def = LEVELS[id];
    if (!def) throw new Error('No level ' + id);
    this.fx.clear();
    const sp = this.world.load(def, opts);
    this.player.teleport(sp.x, sp.y, sp.z, sp.yaw ?? 0);
    this.player.state = 'play';
    this.rig.setYaw((sp.yaw ?? 0) + Math.PI);
    this.rig.pitch = 0.33;
    this.rig.snap();
    this.rig.shot = null;
    this.pip.visible = true;
    this.pip.resetTrail(this.player.pos);
    if (id !== 'hub') this.save.visit(id);
    if (def.onArrive) def.onArrive(this.world.state, opts, this);
    return sp;
  }

  // Travel with the tuning transition.
  goto(id, opts = {}) {
    if (this.mode === 'transition') return Promise.resolve();
    const from = this.world.def;
    this.mode = 'transition';
    this.input.enabled = false;
    return this.ui.tune(LEVELS[id], from ? from.dial ?? 0.5 : 0.5, () => {
      this.loadLevel(id, opts);
      if (opts.checkpoint === undefined) this.save.setResume(id, null);
    }).then(() => {
      this.mode = 'play';
      this.input.enabled = true;
      this.ui.levelTitle(LEVELS[id]);
    });
  }

  begin(fresh) {
    if (fresh) this.save.reset();
    this.ui.hideTitle();
    this.save.data.started = true; this.save.write();
    const res = this.save.data.resume;
    if (!fresh && res && LEVELS[res.level]) {
      this.goto(res.level, res.cp !== null && res.cp !== undefined ? { checkpoint: res.cp } : {});
      return;
    }
    this.mode = 'play';
    this.input.enabled = true;
    this.loadLevel('hub');
    this.save.setResume('hub', null);
    const def = this.world.def;
    if (fresh && def.intro) def.intro(this.world.state, this);
    else this.ui.levelTitle(def);
  }

  toTitle() {
    this.mode = 'title';
    this.input.releasePointer();
    this.loadLevel('hub');
    this.ui.showTitle();
  }

  setPaused(p) {
    if (p && this.mode === 'play') { this.mode = 'paused'; this.input.releasePointer(); this.ui.showPause(); audio.setMuffle(0.6); }
    else if (!p && this.mode === 'paused') { this.mode = 'play'; this.ui.hidePause(); audio.setMuffle(0); }
  }

  completeLevel(id, pk) {
    if (this.completing) return;
    this.completing = true;
    this.justCompleted = id;
    this.save.giveIdent(id);
    this.save.setResume('hub', null);
    this.player.state = 'frozen';
    const c = pk ? new THREE.Vector3(pk.x, pk.y, pk.z) : this.player.pos.clone();
    const a0 = this.rig.yaw;
    this.rig.playShot({
      dur: 3.4, blendIn: 0.8, blendOut: 0.01, fov: 50,
      path: (k, out) => out.set(c.x + Math.sin(a0 + k * 1.2) * 6, c.y + 1.5 + k * 1.5, c.z + Math.cos(a0 + k * 1.2) * 6),
      look: [c.x, c.y, c.z],
    });
    const def = this.world.def;
    if (def.onComplete) def.onComplete(this.world.state, this);
    setTimeout(() => {
      this.completing = false;
      if (id === 'closedown') this.ending();
      else this.goto('hub', { from: id });
    }, 3400);
  }

  ending() {
    this.save.data.finished = true; this.save.write();
    this.mode = 'transition';
    this.ui.tune(LEVELS.hub, 0.5, () => { this.loadLevel('hub', { ending: true }); }).then(() => {
      this.mode = 'ending';
      this.input.enabled = false;
      const hub = LEVELS.hub;
      hub.ending(this.world.state, this, () => {
        this.mode = 'play';
        this.input.enabled = true;
        this.ui.hideEnding();
        this.ui.levelTitle(hub);
      });
    });
  }

  teleport(x, y, z) {
    this.player.teleport(x, y, z, this.player.facing);
    this.rig.snap();
    this.pip.resetTrail(this.player.pos);
  }

  toggleFreeCam() {
    this.rig.free = !this.rig.free;
    if (this.rig.free) this.rig.freePos.copy(this.camera.position);
    this.player.state = this.rig.free ? 'frozen' : 'play';
  }

  learned(glyph) { this.save.markSeen(glyph); }
  hum() {
    const P = this.player.pos;
    this.fx.burst(P.x, P.y + 1, P.z, { count: 3, color: 0xffe0b0, speed: 0.6, up: 1.2, size: 0.18, life: 1.4, drag: 1 });
    audio.osc({ type: 'sine', f: audio.deg([0, 2, 4, 2][Math.floor(this.time) % 4], 1), dur: 0.5, a: 0.08, g: 0.03 });
  }

  getState() {
    const p = this.player, P = p.pos, d = this.world.def;
    return {
      mode: this.mode, level: d ? d.id : null, frame: this.frame, time: this.time, fps: this.fps,
      pos: { x: P.x, y: P.y, z: P.z }, vel: { x: p.vel.x, y: p.vel.y, z: p.vel.z },
      grounded: p.body.grounded, state: p.state, swimming: p.swimming, echoReady: p.echoReady,
      checkpoint: this.world.cp ? this.world.cp.index : null, depth: this.world.depth,
      idents: { ...this.save.data.idents }, abilities: { ...this.save.data.abilities }, secrets: { ...this.save.data.secrets },
      errors: this.errors.slice(),
    };
  }

  updatePrompts() {
    const P = this.player.pos, s = this.save;
    let show = null;
    if (this.mode === 'play') {
      if (!s.seen('move') && this.world.def.id === 'hub') show = 'move';
      else if (!s.seen('look') && this.world.def.id === 'hub' && this.time > 6) show = 'look';
      for (const p of this.world.prompts) if (!s.seen(p.glyph) && Math.hypot(P.x - p.x, P.z - p.z) < p.r && Math.abs(P.y - p.y) < 4) show = p.glyph;
    }
    if (!show) return this.ui.prompt(null);
    const v = new THREE.Vector3(this.renderPos.x, this.renderPos.y + 1.6, this.renderPos.z).project(this.camera);
    this.ui.prompt(show, (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight);
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const real = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.frame++;
    this.ftAvg += (real * 1000 - this.ftAvg) * 0.05;
    this.fps = 1000 / this.ftAvg;
    if (this.frame % 90 === 0) this.adaptResolution();
    this.ui.fps(this.fps);

    const inp = this.input.poll(real);
    const set = this.save.data.settings;
    inp.lookX *= set.sens; inp.lookY *= set.sens * (set.invertY ? -1 : 1);
    if (inp.debug) this.ui.toggleDebug();
    if (inp.pause) this.setPaused(this.mode === 'play');
    if (this.mode === 'play') {
      if (inp.x || inp.z) { this.moveT = (this.moveT || 0) + real; if (this.moveT > 0.6) this.learned('move'); }
      if (Math.abs(inp.lookX) > 0.02) this.learned('look');
    }

    let dt = real;
    if (this.fx.stop > 0) { this.fx.stop -= real; dt = 0; }
    const running = this.mode === 'play' || this.mode === 'ending';
    if (running) {
      this.time += dt;
      const si = this.stepInput;
      si.x = inp.x; si.z = inp.z; si.jumpHeld = inp.jumpHeld;
      si.jump = si.jump || inp.jump; si.action = si.action || inp.action;
      this.acc += dt;
      while (this.acc >= STEP) {
        this.world.fixedUpdate(STEP);
        si.jump = false; si.action = false;
        this.acc -= STEP;
      }
      if (inp.jump) this.learned('jump');
      if (inp.action) this.learned('echo');
    } else if (this.mode === 'title') this.time += real;
    const alpha = this.acc / STEP;
    this.renderPos.copy(this.player.prev).lerp(this.player.pos, running ? alpha : 1);

    this.world.update(this.mode === 'paused' ? 0 : dt);
    if (this.mode === 'title') this.titleCamera(real);
    else this.rig.update(real, this.mode === 'play' ? inp : { lookX: 0, lookY: 0 }, this.player, this.renderPos, this.world, this.physics, this.fx.trauma, this.time);
    this.pip.update(dt, this.time, this.player, this.renderPos, this.camera, this.physics, music.beat());
    this.pip.root.visible = this.pip.visible && this.mode !== 'title';
    this.pip.shadow.visible = this.pip.shadow.visible && this.mode !== 'title';
    this.fx.update(dt);
    this.updatePrompts();
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
    audio.setListener(this.camera.position, fwd);
    this.renderer.render(this.scene, this.camera);
  }

  titleCamera(dt) {
    const def = this.world.def, a = this.time * 0.035;
    const c = def.titleShot || { center: [0, 10, 0], r: 55, h: 22 };
    this.camera.position.set(c.center[0] + Math.sin(a) * c.r, c.center[1] + c.h, c.center[2] + Math.cos(a) * c.r);
    this.camera.lookAt(c.center[0], c.center[1] + 6, c.center[2]);
  }

  adaptResolution() {
    let pr = this.pr;
    if (this.ftAvg > 19.5 && pr > 0.7) pr = Math.max(0.7, pr - 0.15);
    else if (this.ftAvg < 13.5 && pr < MAX_PR) pr = Math.min(MAX_PR, pr + 0.1);
    if (pr !== this.pr) { this.pr = pr; this.renderer.setPixelRatio(pr); this.resize(); }
  }
}

const game = new Game();
addEventListener('error', (e) => game.errors.push(String(e.message)));
window.__game = {
  loadLevel: (id, opts) => { if (game.mode === 'title') { game.ui.hideTitle(); } game.mode = 'play'; game.input.enabled = true; return game.loadLevel(id, opts); },
  teleport: (x, y, z) => game.teleport(x, y, z),
  getState: () => game.getState(),
  levels: () => ['hub', ...ORDER],
  // Virtual input for tests. {x,z} are camera-relative; {wx,wz} are world directions.
  setInput: (v) => {
    if (v && (v.wx !== undefined || v.wz !== undefined)) {
      const c = Math.cos(game.rig.yaw), s = Math.sin(game.rig.yaw), wx = v.wx || 0, wz = v.wz || 0;
      v = { ...v, x: c * wx - s * wz, z: -s * wx - c * wz };
    }
    game.input.virtual = v;
  },
  checkpoints: () => game.world.checkpoints.map((c) => ({ x: c.x, y: c.y, z: c.z })),
  pickups: () => game.world.pickups.map((p) => ({ kind: p.kind, id: p.id, x: p.x, y: p.y, z: p.z, taken: !!p.taken })),
  give: (a) => game.save.giveAbility(a),
  game,
};
