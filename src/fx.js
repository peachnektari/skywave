import * as THREE from 'three';

// Juice: one pooled additive particle system, expanding rings, screen shake, hit-stop.

const N = 2400;

export class FX {
  constructor(scene) {
    this.scene = scene;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3);
    this.col = new Float32Array(N * 4);
    this.size = new Float32Array(N);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.max = new Float32Array(N);
    this.grav = new Float32Array(N);
    this.drag = new Float32Array(N);
    this.size0 = new Float32Array(N);
    this.alpha0 = new Float32Array(N);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: /* glsl */`
        attribute float aSize; attribute vec4 aColor; uniform float uScale; varying vec4 vC;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`
        varying vec4 vC;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vC.a; gl_FragColor = vec4(vC.rgb * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.cursor = 0;
    this.alive = 0;

    this.rings = [];
    const rg = new THREE.RingGeometry(0.9, 1, 48);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 11;
      scene.add(m);
      this.rings.push({ m, t: 0, dur: 1, r0: 0, r1: 1, a: 1 });
    }
    this.trauma = 0;
    this.stop = 0;
    this._c = new THREE.Color();
  }

  resize(heightPx, fov) { this.mat.uniforms.uScale.value = heightPx / (2 * Math.tan((fov * Math.PI) / 360)); }

  // o: {count, color, speed, spread(0..1 of sphere), up, size, life, gravity, drag, jitter}
  burst(x, y, z, o = {}) {
    const n = o.count ?? 12;
    const c = this._c.set(o.color ?? 0xffffff);
    for (let k = 0; k < n; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % N;
      const j = o.jitter ?? 0.1;
      this.pos[i * 3] = x + (Math.random() - 0.5) * j;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * j;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * j;
      let vx = Math.random() * 2 - 1, vy = Math.random() * 2 - 1, vz = Math.random() * 2 - 1;
      if (o.flat) vy = 0;
      const l = Math.hypot(vx, vy, vz) || 1;
      const sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.6);
      this.vel[i * 3] = (vx / l) * sp + (o.vx ?? 0);
      this.vel[i * 3 + 1] = (vy / l) * sp * (o.flatten ?? 1) + (o.up ?? 0);
      this.vel[i * 3 + 2] = (vz / l) * sp + (o.vz ?? 0);
      this.max[i] = this.life[i] = (o.life ?? 0.7) * (0.6 + Math.random() * 0.6);
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 2;
      this.size0[i] = (o.size ?? 0.25) * (0.6 + Math.random() * 0.8);
      this.alpha0[i] = o.alpha ?? 1;
      this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b;
    }
  }

  ring(x, y, z, o = {}) {
    const r = this.rings.find((q) => !q.m.visible) || this.rings[0];
    r.m.visible = true; r.t = 0; r.dur = o.dur ?? 0.6; r.r0 = o.r0 ?? 0.3; r.r1 = o.r1 ?? 3; r.a = o.alpha ?? 0.8;
    r.m.material.color.set(o.color ?? 0xffffff);
    r.m.position.set(x, y, z);
    if (o.vertical) { r.m.rotation.set(0, o.yaw ?? 0, 0); } else r.m.rotation.set(-Math.PI / 2, 0, 0);
  }

  shake(k) { this.trauma = Math.min(1, this.trauma + k); }
  hitStop(sec) { this.stop = Math.max(this.stop, sec); }

  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) { if (this.size[i] !== 0) this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt; this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.size0[i] * (0.4 + 0.6 * k);
      this.col[i * 4 + 3] = this.alpha0[i] * Math.min(1, k * 1.6);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true; a.aColor.needsUpdate = true; a.aSize.needsUpdate = true;
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.m.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3);
      r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e);
      r.m.material.opacity = r.a * (1 - k);
    }
  }

  clear() { this.life.fill(0); for (const r of this.rings) r.m.visible = false; this.trauma = 0; }
}
