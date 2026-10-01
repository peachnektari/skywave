import * as THREE from 'three';
import { audio } from './audio.js';

// Every feel constant lives here.
export const FEEL = {
  // body
  halfWidth: 0.3, height: 0.9, stepUp: 0.45,
  // running
  runSpeed: 7.4, groundAccel: 75, groundDecel: 60, turnBoost: 1.9, overspeedDecel: 14,
  airAccel: 34, airDecel: 5, airSteer: 5.5,
  // jumping (height in world units; velocity derived)
  jumpHeight: 2.6, gravity: 40, fallMult: 1.55, apexSpeed: 2.4, apexMult: 0.5,
  jumpCut: 0.45, maxFall: 24, coyoteTime: 0.1, jumpBuffer: 0.13,
  // landing
  hardLand: 17,
  // echo
  echoLife: 3.2, echoHop: 12.5, echoSize: [1.5, 0.42, 1.5],
  // skip
  skipWindow: 0.15, skipMinSpeed: 4.5, skipSpeeds: [9.6, 11.2, 12.8], skipHeights: [0.78, 0.88, 1.0],
  liquidSkipMin: 7.9, liquidSkipKeep: 0.9, liquidSkipHop: 0.55,
  // line
  lineSpeed: 14, lineCatch: 0.85, lineHang: 1.05, lineJump: 0.9, lineCooldown: 0.35,
  // water
  swimSpeed: 4.3, floatDepth: 0.55, buoyancy: 38, waterDrag: 5, waterJumpMult: 0.62,
  // respawn
  respawnDelay: 0.55,
};
FEEL.jumpVel = Math.sqrt(2 * FEEL.gravity * FEEL.jumpHeight);

const _v = new THREE.Vector3();

export class Player {
  constructor(game) {
    this.g = game;
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), hw: FEEL.halfWidth, h: FEEL.height, stepUp: FEEL.stepUp, grounded: false, ground: null };
    this.prev = new THREE.Vector3();
    this.state = 'play';
    this.facing = 0;
    this.reset();
  }
  get pos() { return this.body.pos; }
  get vel() { return this.body.vel; }
  get speed() { return Math.hypot(this.body.vel.x, this.body.vel.z); }

  reset() {
    this.coyote = 0; this.buffer = 0; this.jumping = false; this.cut = false; this.jumpHeld = false;
    this.echoReady = true; this.skipChain = 0; this.skipWindowT = 0;
    this.line = null; this.lineCooldown = 0; this.swimming = false; this.deadT = 0;
    this.stillT = 0; this.airT = 0; this.invincible = this.invincible || false;
    this.body.vel.set(0, 0, 0); this.body.grounded = false; this.body.ground = null;
  }

  teleport(x, y, z, yaw) {
    this.body.pos.set(x, y, z); this.prev.set(x, y, z);
    this.reset();
    if (yaw !== undefined && yaw !== null) this.facing = yaw;
    this.state = 'play';
  }

  has(ability) { return !!this.g.save.data.abilities[ability]; }

  fixedUpdate(dt, inp, camYaw) {
    const F = FEEL, b = this.body, V = b.vel, P = b.pos, w = this.g.world;
    this.prev.copy(P);
    if (this.state === 'dead') { this.deadT -= dt; if (this.deadT <= 0) this.respawn(); return; }
    if (this.state === 'frozen') { V.set(0, 0, 0); return; }

    if (inp.jump) this.buffer = F.jumpBuffer; else this.buffer = Math.max(0, this.buffer - dt);
    this.jumpHeld = inp.jumpHeld;
    this.lineCooldown -= dt;
    this.skipWindowT -= dt;

    // camera-relative wish direction
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    const wx = c * inp.x - s * inp.z, wz = -s * inp.x - c * inp.z;
    const wl = Math.hypot(wx, wz);
    this.wishing = wl > 0.05;

    if (this.state === 'line') { this.updateLine(dt, wx, wz); return; }

    // liquids
    const liq = w.liquidAt(P.x, P.z);
    this.swimming = false;
    if (liq && P.y < liq.y - 0.02) {
      const hs = Math.hypot(V.x, V.z);
      if (this.has('skip') && V.y <= 0 && hs >= F.liquidSkipMin && P.y > liq.y - 0.7) {
        this.liquidSkip(liq);
      } else if (liq.liquid === 'static') {
        if (!this.invincible) { this.die(); return; }
        P.y = liq.y; V.y = Math.max(V.y, 0); b.grounded = true;
      } else if (P.y < liq.y - 0.2) this.swimming = true;
    }

    const hs = Math.hypot(V.x, V.z);
    const maxS = this.swimming ? F.swimSpeed : F.runSpeed;
    if (this.swimming) {
      const target = liq.y - F.floatDepth;
      V.y += ((target - P.y) * F.buoyancy - V.y * F.waterDrag) * dt;
      V.y = Math.max(-6, Math.min(8, V.y));
      this.coyote = F.coyoteTime;
      this.echoReady = true;
      this.jumping = false;
    } else {
      let g = F.gravity;
      if (V.y < 0) g *= F.fallMult;
      else if (this.jumping && !this.jumpHeld && !this.cut) { V.y *= F.jumpCut; this.cut = true; }
      if (!b.grounded && this.jumpHeld && Math.abs(V.y) < F.apexSpeed) g *= F.apexMult;
      V.y = Math.max(V.y - g * dt, -F.maxFall);
    }

    // horizontal
    if (!b.grounded && hs > maxS + 0.1 && !this.swimming) {
      // keep momentum from skips and line launches; steer and bleed slowly
      if (wl > 0.05) {
        const a = Math.atan2(V.x, V.z), t = Math.atan2(wx, wz);
        let d = t - a; d = Math.atan2(Math.sin(d), Math.cos(d));
        const na = a + Math.max(-F.airSteer * dt, Math.min(F.airSteer * dt, d));
        const ns = Math.max(maxS, hs - F.airDecel * dt * (Math.abs(d) > 2 ? 6 : 1));
        V.x = Math.sin(na) * ns; V.z = Math.cos(na) * ns;
      } else { const k = Math.max(maxS, hs - F.airDecel * dt) / hs; V.x *= k; V.z *= k; }
    } else if (b.grounded && hs > maxS + 0.1 && this.skipWindowT > 0) {
      // hold skip speed through the landing window
    } else {
      let acc = b.grounded || this.swimming ? (wl > 0.05 ? F.groundAccel : F.groundDecel) : (wl > 0.05 ? F.airAccel : F.airDecel);
      if (wl > 0.05 && V.x * wx + V.z * wz < 0) acc *= F.turnBoost;
      if (hs > maxS + 0.1) acc = F.overspeedDecel;
      const tx = wx * maxS, tz = wz * maxS;
      const dx = tx - V.x, dz = tz - V.z, dl = Math.hypot(dx, dz);
      const step = acc * dt;
      if (dl <= step) { V.x = tx; V.z = tz; } else { V.x += (dx / dl) * step; V.z += (dz / dl) * step; }
    }

    // jump (ground, coyote, water surface, liquid skip window)
    if (this.buffer > 0 && (b.grounded || this.coyote > 0)) this.doJump();
    if (inp.action) this.tryEcho();

    const was = b.grounded, vyBefore = V.y;
    b.noSnap = V.y > 0;
    b.wading = this.swimming;
    this.g.physics.moveBody(b, dt);

    if (b.grounded) {
      if (!was) this.landed(vyBefore);
      this.coyote = F.coyoteTime;
      this.jumping = false;
      if (!b.ground || b.ground.tag !== 'echo') this.echoReady = true;
      if (this.skipWindowT <= 0) this.skipChain = 0;
      this.airT = 0;
    } else {
      if (!this.swimming) this.coyote -= dt;
      this.airT += dt;
    }
    if (b.hitCeil) this.g.pip.bump();

    const moving = Math.hypot(V.x, V.z) > 0.15 || !b.grounded || this.wishing;
    this.stillT = moving ? 0 : this.stillT + dt;

    if (!b.grounded && this.has('line') && this.lineCooldown <= 0) this.tryCatchLine();
    if (P.y < w.killY) this.die(true);

    if (Math.hypot(V.x, V.z) > 0.4) {
      const t = Math.atan2(V.x, V.z);
      let d = t - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 14);
    }
  }

  // Throw Pip into the air (speaker cones, thermals, geysers). Horizontal velocity optional.
  launch(vy, vx, vz) {
    const b = this.body, V = b.vel;
    V.y = vy;
    if (vx !== undefined) { V.x = vx; V.z = vz; }
    this.jumping = true; this.cut = true;
    b.grounded = false; b.noSnap = true;
    this.coyote = 0; this.buffer = 0;
    this.g.pip.onJump();
  }

  doJump() {
    const F = FEEL, V = this.body.vel;
    const hs = Math.hypot(V.x, V.z);
    let mult = 1;
    const skipping = this.has('skip') && this.skipWindowT > 0 && hs > F.skipMinSpeed;
    if (skipping) {
      this.skipChain = Math.min(this.skipChain + 1, 3);
      const sp = Math.max(hs, F.skipSpeeds[this.skipChain - 1]);
      V.x = (V.x / hs) * sp; V.z = (V.z / hs) * sp;
      mult = F.skipHeights[this.skipChain - 1];
      this.g.pip.onSkip(this.skipChain);
      audio.skip(this.skipChain);
    } else {
      this.skipChain = 0;
      audio.jump();
    }
    if (this.swimming) { mult = F.waterJumpMult; audio.splash(0.4); this.g.fx.burst(this.body.pos.x, this.body.pos.y + 0.5, this.body.pos.z, { count: 14, color: 0xcfe8ff, speed: 3, up: 3, gravity: 9, size: 0.18 }); }
    V.y = F.jumpVel * mult;
    this.jumping = true; this.cut = false;
    this.buffer = 0; this.coyote = 0; this.skipWindowT = 0;
    this.body.grounded = false; this.body.noSnap = true;
    this.swimming = false;
    this.g.pip.onJump();
  }

  landed(vy) {
    const k = Math.min(1, Math.max(0, -vy / FEEL.maxFall));
    const P = this.body.pos;
    this.g.pip.onLand(k);
    audio.land(k);
    const col = this.g.world.def.palette.dust ?? 0xd8d0f0;
    this.g.fx.burst(P.x, P.y + 0.05, P.z, { count: 4 + Math.round(k * 14), color: col, speed: 1.5 + k * 3, flatten: 0.2, up: 0.6, size: 0.35, life: 0.5, alpha: 0.5, drag: 4 });
    if (-vy > FEEL.hardLand) this.g.fx.shake(0.25 + k * 0.3);
    if (this.has('skip') && this.speed > FEEL.skipMinSpeed) this.skipWindowT = FEEL.skipWindow;
    this.g.world.onLand(this, k);
  }

  liquidSkip(liq) {
    const F = FEEL, V = this.body.vel, P = this.body.pos;
    V.x *= F.liquidSkipKeep; V.z *= F.liquidSkipKeep;
    V.y = F.jumpVel * F.liquidSkipHop;
    P.y = liq.y;
    this.skipChain = Math.max(1, this.skipChain);
    this.skipWindowT = F.skipWindow; this.coyote = F.skipWindow;
    this.jumping = true; this.cut = true;
    audio.skip(1); audio.splash(0.2);
    this.g.fx.ring(P.x, liq.y + 0.05, P.z, { r0: 0.3, r1: 2.2, dur: 0.7, color: liq.liquid === 'static' ? 0xc8c0ff : 0xd8f4ff, alpha: 0.6 });
    this.g.fx.burst(P.x, liq.y, P.z, { count: 10, color: 0xe0f0ff, speed: 3, up: 2.5, gravity: 10, size: 0.15 });
    this.g.pip.onSkip(0);
  }

  tryEcho() {
    if (!this.echoReady || this.state !== 'play') { this.g.pip.fizzle(); return; }
    const b = this.body;
    this.echoReady = false;
    this.g.world.spawnEcho(this);
    b.vel.y = FEEL.echoHop;
    this.jumping = true; this.cut = true;
    b.grounded = false; b.noSnap = true;
    this.coyote = 0; this.buffer = 0;
    this.g.pip.onEcho();
    audio.echo();
  }

  tryCatchLine() {
    const P = this.body.pos, V = this.body.vel;
    const hx = P.x, hy = P.y + this.body.h + 0.1, hz = P.z;
    let best = null;
    for (const wire of this.g.world.wires) {
      if (!wire.enabled) continue;
      const hit = wire.closest(hx, hy, hz);
      if (hit.d < FEEL.lineCatch && (!best || hit.d < best.d)) best = { ...hit, wire };
    }
    if (!best) return;
    const t = best.wire.tangent(best.s);
    let along = V.x * t.x + V.y * t.y + V.z * t.z;
    let dir = Math.sign(along);
    if (Math.abs(along) < 1.5) {
      dir = Math.sign(Math.sin(this.facing) * t.x + Math.cos(this.facing) * t.z) || 1;
      if (best.wire.oneWay) dir = best.wire.oneWay;
    }
    if (best.wire.oneWay) dir = best.wire.oneWay;
    this.line = { wire: best.wire, s: best.s, dir, speed: Math.max(FEEL.lineSpeed, Math.abs(along)) };
    this.state = 'line';
    this.echoReady = true;
    audio.lineOn();
    this.g.pip.onLine(true);
    this.g.world.onLine(best.wire);
  }

  updateLine(dt) {
    const L = this.line, F = FEEL, P = this.body.pos, V = this.body.vel;
    L.s += L.dir * L.speed * dt;
    const end = L.s <= 0 || L.s >= L.wire.len;
    L.s = Math.max(0, Math.min(L.wire.len, L.s));
    const p = L.wire.point(L.s, _v);
    P.set(p.x, p.y - F.lineHang, p.z);
    const t = L.wire.tangent(L.s);
    V.set(t.x * L.dir * L.speed, t.y * L.dir * L.speed, t.z * L.dir * L.speed);
    if (Math.hypot(V.x, V.z) > 0.3) this.facing = Math.atan2(V.x, V.z);
    if (this.buffer > 0 || end) {
      this.state = 'play'; this.line = null;
      this.lineCooldown = F.lineCooldown;
      V.x *= 0.75; V.z *= 0.75;
      V.y = this.buffer > 0 ? F.jumpVel * F.lineJump : Math.max(V.y, 5);
      this.buffer = 0;
      this.jumping = true; this.cut = false;
      this.body.grounded = false;
      audio.lineOff();
      this.g.pip.onLine(false);
      this.g.pip.onJump();
    }
  }

  die(fell = false) {
    if (this.state === 'dead') return;
    if (this.invincible && !fell) return;
    const P = this.body.pos;
    this.state = 'dead';
    this.deadT = FEEL.respawnDelay;
    this.line = null;
    audio.loseSignal();
    this.g.fx.burst(P.x, P.y + 0.45, P.z, { count: 40, color: 0xe8e0ff, speed: 4, size: 0.12, life: 0.6, jitter: 0.6 });
    this.g.fx.shake(0.3);
    this.g.pip.onDie();
    this.g.world.onDeath();
  }

  respawn() {
    const cp = this.g.world.respawnPoint();
    this.teleport(cp.x, cp.y, cp.z, cp.yaw);
    this.g.rig.snap();
    audio.tuneIn();
    this.g.pip.onRespawn();
    this.g.fx.burst(cp.x, cp.y + 0.5, cp.z, { count: 24, color: 0xfff0d0, speed: 2.5, size: 0.14, life: 0.5, drag: 5 });
    this.g.world.onRespawn();
  }
}
