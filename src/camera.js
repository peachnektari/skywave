import * as THREE from 'three';

// Damped third-person follow with lookahead, platformer-style vertical framing, wall
// avoidance, per-zone biases (from level data) and scripted set-piece shots.

const lerp = (a, b, k) => a + (b - a) * k;
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0; this.pitch = 0.33; this.dist = 7.5; this.curDist = 7.5;
    this.base = { dist: 7.5, pitch: 0.33, height: 1.15 };
    this.p = { dist: 7.5, pitchBias: 0, height: 1.15 };
    this.target = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.ahead = new THREE.Vector3();
    this.frameY = 0;
    this.manualT = 99;
    this.shot = null; this.shotBlend = 0;
    this.fixed = null; this.fixedBlend = 0;
    this.fov = 62;
    this.free = false;
    this.freePos = new THREE.Vector3();
    this._dir = new THREE.Vector3(); this._des = new THREE.Vector3(); this._tmp = new THREE.Vector3();
    this.shotPos = new THREE.Vector3(); this.shotLook = new THREE.Vector3();
  }

  setYaw(y) { this.yaw = y; }
  snap() { this.snapNext = true; }

  // A set piece: {pos:[x,y,z], look:[x,y,z] | null (player), dur, fov, hold}
  playShot(s) { this.shot = { ...s, t: 0 }; }
  get inShot() { return !!this.shot; }

  update(dt, inp, player, renderPos, world, physics, trauma, time) {
    const cam = this.cam;
    if (this.free) return this.updateFree(dt, inp);

    // manual look
    const manual = Math.abs(inp.lookX) + Math.abs(inp.lookY) > 1e-4;
    this.yaw -= inp.lookX;
    this.pitch = Math.max(-0.35, Math.min(1.25, this.pitch + inp.lookY));
    this.manualT = manual ? 0 : this.manualT + dt;

    // zone biases
    const z = world.camZoneAt(renderPos);
    const want = { dist: z?.dist ?? this.base.dist, height: z?.height ?? this.base.height, pitch: z?.pitch };
    this.p.dist = lerp(this.p.dist, want.dist, damp(2.2, dt));
    this.p.height = lerp(this.p.height, want.height, damp(2.2, dt));
    if (want.pitch !== undefined && this.manualT > 0.8) this.pitch = lerp(this.pitch, want.pitch, damp(1.6, dt));
    if (z && z.yaw !== undefined && this.manualT > 0.8) this.yaw += angDiff(this.yaw, z.yaw) * damp(z.yawRate ?? 1.5, dt);

    // gentle auto-follow behind the direction of travel
    const V = player.vel, hs = Math.hypot(V.x, V.z);
    if (this.manualT > 1.4 && hs > 2.5 && !(z && z.yaw !== undefined)) {
      const behind = Math.atan2(-V.x, -V.z);
      const d = angDiff(this.yaw, behind);
      if (Math.abs(d) < 2.3) this.yaw += d * damp(0.5 * Math.min(1, hs / 7), dt);
    }

    // platformer framing: hold vertical position while airborne within a band
    const st = player.body.grounded || player.swimming || player.state === 'line';
    if (st || player.state !== 'play') this.frameY = lerp(this.frameY, renderPos.y, damp(8, dt));
    else if (renderPos.y < this.frameY - 0.3) this.frameY = lerp(this.frameY, renderPos.y + 0.3, damp(10, dt));
    else if (renderPos.y > this.frameY + 3) this.frameY = lerp(this.frameY, renderPos.y - 3, damp(6, dt));

    this.ahead.x = lerp(this.ahead.x, Math.max(-2.2, Math.min(2.2, V.x * 0.28)), damp(3, dt));
    this.ahead.z = lerp(this.ahead.z, Math.max(-2.2, Math.min(2.2, V.z * 0.28)), damp(3, dt));

    const tx = renderPos.x + this.ahead.x, ty = this.frameY + this.p.height, tz = renderPos.z + this.ahead.z;
    if (this.snapNext) { this.target.set(tx, ty, tz); this.frameY = renderPos.y; this.target.y = renderPos.y + this.p.height; }
    else {
      this.target.x = lerp(this.target.x, tx, damp(11, dt));
      this.target.z = lerp(this.target.z, tz, damp(11, dt));
      this.target.y = lerp(this.target.y, ty, damp(9, dt));
    }

    // desired position and wall avoidance (cast from Pip's head, not the lookahead point)
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = this._dir.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    const head = this._tmp.set(renderPos.x, renderPos.y + 0.9, renderPos.z);
    const origin = this._des.copy(this.target).lerp(head, 0.5);
    const hit = physics.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, this.p.dist + 0.4, 'echo');
    const allowed = Math.max(1.2, hit - 0.4);
    const d = Math.min(this.p.dist, allowed);
    if (this.snapNext || d < this.curDist) this.curDist = lerp(this.curDist, d, this.snapNext ? 1 : damp(18, dt));
    else this.curDist = lerp(this.curDist, d, damp(2.5, dt));
    let px = this.target.x + dir.x * this.curDist, py = this.target.y + dir.y * this.curDist, pz = this.target.z + dir.z * this.curDist;
    const gb = physics.groundBelow(px, py + 2, pz, 6, 0.1);
    if (gb && py < gb.y + 0.5) py = gb.y + 0.5;
    const liq = world.liquidAt(px, pz);
    if (liq && py < liq.y + 0.4) py = liq.y + 0.4;

    let lx = this.target.x, ly = this.target.y - 0.15, lz = this.target.z;

    // fixed framing from a zone
    const fixed = z && z.pos ? z : null;
    this.fixedBlend = lerp(this.fixedBlend, fixed ? 1 : 0, damp(2.2, dt));
    if (fixed) this.fixed = fixed;
    if (this.fixed && this.fixedBlend > 0.001) {
      const f = this.fixed, k = this.fixedBlend * this.fixedBlend * (3 - 2 * this.fixedBlend);
      px = lerp(px, f.pos[0], k); py = lerp(py, f.pos[1], k); pz = lerp(pz, f.pos[2], k);
      if (f.look) { lx = lerp(lx, f.look[0], k); ly = lerp(ly, f.look[1], k); lz = lerp(lz, f.look[2], k); }
    }

    // scripted shot
    let fov = 62 + Math.max(0, Math.min(8, (hs - 8) * 1.4));
    if (this.shot) {
      const s = this.shot; s.t += dt;
      const inT = s.blendIn ?? 1.2, outT = s.blendOut ?? 1.2, dur = s.dur ?? 4;
      let k = s.t < inT ? s.t / inT : s.t > dur - outT ? (dur - s.t) / outT : 1;
      k = Math.max(0, Math.min(1, k)); k = k * k * (3 - 2 * k);
      const sp2 = s.path ? s.path(s.t / dur, this.shotPos) : this.shotPos.set(...s.pos);
      const sl = s.look ? this.shotLook.set(...s.look) : this.shotLook.set(renderPos.x, renderPos.y + 0.6, renderPos.z);
      px = lerp(px, sp2.x, k); py = lerp(py, sp2.y, k); pz = lerp(pz, sp2.z, k);
      lx = lerp(lx, sl.x, k); ly = lerp(ly, sl.y, k); lz = lerp(lz, sl.z, k);
      fov = lerp(fov, s.fov ?? fov, k);
      if (s.t >= dur) { this.shot = null; if (s.done) s.done(); }
    }

    // shake
    const tr = trauma * trauma;
    if (tr > 0) {
      px += Math.sin(time * 47) * tr * 0.35; py += Math.sin(time * 53 + 1) * tr * 0.3; pz += Math.sin(time * 41 + 2) * tr * 0.35;
    }

    this.fov = lerp(this.fov, fov, damp(4, dt));
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    cam.position.set(px, py, pz);
    this.look.set(lx, ly, lz);
    cam.lookAt(this.look);
    this.snapNext = false;
  }

  updateFree(dt, inp) {
    const cam = this.cam;
    this.yaw -= inp.lookX; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + inp.lookY));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const sp = inp.jumpHeld ? 40 : 14;
    this.freePos.addScaledVector(fwd, inp.z * sp * dt).addScaledVector(right, inp.x * sp * dt);
    cam.position.copy(this.freePos);
    cam.lookAt(this._tmp.copy(this.freePos).add(fwd));
  }
}
