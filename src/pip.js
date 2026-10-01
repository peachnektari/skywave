import * as THREE from 'three';
import { glowSprite, shadowTexture } from './materials.js';
import { audio } from './audio.js';

// Pip's body and all of its procedural personality: squash & stretch, stride bounce,
// lean and bank, a metronome idle that ticks on the music's beat, glances, blinking,
// a spring-lagged antenna, spins, a waveform ribbon trail, and a blob shadow.

const TRAIL = 28;

export class PipModel {
  constructor(scene) {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();   // lean/bank/flip
    this.squashG = new THREE.Group(); // squash & stretch
    this.root.add(this.tilt); this.tilt.add(this.squashG);
    scene.add(this.root);

    const prof = [[0, 0], [0.17, 0.02], [0.28, 0.1], [0.325, 0.26], [0.32, 0.46], [0.28, 0.64], [0.19, 0.78], [0.08, 0.85], [0, 0.865]].map(([r, y]) => new THREE.Vector2(r, y));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uCore: { value: new THREE.Color(0xfff6e2) }, uRim: { value: new THREE.Color(0xffa24a) }, uGlow: { value: 1 }, uFlash: { value: 0 } },
      vertexShader: /* glsl */`varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */`uniform vec3 uCore, uRim; uniform float uGlow, uFlash; varying vec3 vN; varying vec3 vV;
        void main(){ float fr = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
          vec3 c = mix(uCore, uRim, pow(fr, 1.6) * 0.9);
          c *= (0.4 + 0.6 * uGlow) * (0.86 + 0.14 * normalize(vN).y);
          c += uFlash;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), this.mat);
    this.squashG.add(this.body);

    const eyeM = new THREE.MeshBasicMaterial({ color: 0x241a2e });
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeM);
      e.scale.set(1, 1.7, 0.6);
      e.position.set(sx * 0.1, 0.55, 0.3);
      this.squashG.add(e); this.eyes.push(e);
    }
    // antenna curl on a spring
    this.antenna = new THREE.Group(); this.antenna.position.y = 0.83;
    const curl = new THREE.CatmullRomCurve3([[0, 0, 0], [0, 0.14, -0.02], [0.02, 0.24, -0.09], [0, 0.27, -0.17], [-0.02, 0.21, -0.2]].map((p) => new THREE.Vector3(...p)));
    this.antenna.add(new THREE.Mesh(new THREE.TubeGeometry(curl, 16, 0.018, 5), this.mat));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    tip.position.set(-0.02, 0.21, -0.2); this.antenna.add(tip);
    this.squashG.add(this.antenna);
    // metronome ring
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 5, 40), this.ringMat);
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 0.42;
    this.root.add(this.ring);
    this.halo = glowSprite(0xffd8a0, 2.4, { opacity: 0.35 });
    this.halo.position.y = 0.45; this.root.add(this.halo);

    // blob shadow
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.renderOrder = 2;
    scene.add(this.shadow);

    // waveform ribbon trail
    this.trailPts = Array.from({ length: TRAIL }, () => new THREE.Vector3());
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(TRAIL * 2), 1));
    const idx = [];
    for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    const al = tg.attributes.alpha;
    for (let i = 0; i < TRAIL; i++) { const k = 1 - i / (TRAIL - 1); al.setX(i * 2, k); al.setX(i * 2 + 1, k); }
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xffc890) }, uOpacity: { value: 0 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ float a = vA * vA * uOpacity; gl_FragColor = vec4(uColor * a, a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.trail = new THREE.Mesh(tg, this.trailMat);
    this.trail.frustumCulled = false;
    scene.add(this.trail);

    this.sq = 1; this.sqv = 0;
    this.lean = 0; this.bank = 0; this.prevVel = new THREE.Vector3(); this.prevFacing = 0;
    this.stride = 0; this.bounceY = 0;
    this.idle = 0; this.lastBeat = 0; this.tickPulse = 0; this.look = 0; this.hum = 0;
    this.blinkT = 2; this.blink = 0;
    this.spin = 0; this.spinV = 0; this.flip = 0;
    this.ant = new THREE.Vector2(); this.antV = new THREE.Vector2();
    this.glow = 1; this.flash = 0;
    this.visible = true; this.appear = 1;
    this.onLineNow = false;
  }

  onJump() { this.sq = 1.28; this.sqv = 0; }
  onLand(k) { this.sq = 1 - 0.12 - k * 0.3; this.sqv = 0; }
  onSkip(n) { this.spinV = n === 0 ? 1 : 1.35; this.sq = 1.2; }
  onEcho() { this.flip = 1; this.flash = 0.5; this.sq = 1.3; }
  bump() { this.sq = 0.8; }
  fizzle() { this.flash = 0.15; this.antV.x += 6; }
  onLine(on) { this.onLineNow = on; }
  onDie() { this.visible = false; }
  onRespawn() { this.visible = true; this.appear = 0; this.sq = 0.4; }
  resetTrail(p) { for (const q of this.trailPts) q.copy(p); }

  update(dt, t, player, renderPos, camera, physics, beat) {
    const V = player.vel, grounded = player.body.grounded;
    const hs = Math.hypot(V.x, V.z);
    this.root.visible = this.visible;
    this.shadow.visible = this.visible;
    this.root.position.copy(renderPos);

    // squash spring
    this.sqv += ((1 - this.sq) * 190 - this.sqv * 13) * dt;
    this.sq += this.sqv * dt;
    this.appear = Math.min(1, this.appear + dt * 3);

    // stride: Pip bounces as it runs, each bounce a soft tick
    let strideY = 0;
    if (grounded && hs > 0.6 && player.state === 'play') {
      const prev = this.stride;
      this.stride += dt * (2.2 + hs * 0.28);
      if (Math.floor(this.stride) !== Math.floor(prev)) { audio.step(); this.sq = Math.min(this.sq, 0.93); }
      strideY = Math.abs(Math.sin(this.stride * Math.PI)) * 0.13 * Math.min(1, hs / 6);
    } else this.stride = 0;
    this.bounceY += (strideY - this.bounceY) * Math.min(1, dt * 20);

    // metronome idle: tick on every beat, glance around, then check on the camera, then hum
    const still = grounded && hs < 0.2 && player.state === 'play';
    this.idle = still ? this.idle + dt : 0;
    const bInt = Math.floor(beat);
    if (still && bInt !== this.lastBeat) { this.tickPulse = 1; if (this.idle > 0.5) this.sq = Math.min(this.sq, 0.9); }
    this.lastBeat = bInt;
    this.tickPulse = Math.max(0, this.tickPulse - dt * 2.2);
    this.ringMat.opacity = this.tickPulse * 0.6 * (still ? 1 : 0.3);
    this.ring.scale.setScalar(1 + (1 - this.tickPulse) * 0.6);
    let lookTarget = 0;
    if (this.idle > 4 && this.idle < 9) lookTarget = Math.sin(this.idle * 1.3) * 0.9;
    else if (this.idle >= 9) {
      const toCam = Math.atan2(camera.position.x - renderPos.x, camera.position.z - renderPos.z);
      let d = toCam - player.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      lookTarget = d;
      if (this.idle > 14) {
        this.hum -= dt;
        if (this.hum <= 0) { this.hum = 1.6; this.onHum && this.onHum(); }
      }
    }
    this.look += (lookTarget - this.look) * Math.min(1, dt * 3);

    // lean into acceleration, bank into turns
    const ax = (V.x - this.prevVel.x) / Math.max(dt, 1e-4), az = (V.z - this.prevVel.z) / Math.max(dt, 1e-4);
    this.prevVel.copy(V);
    const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
    const fwdAcc = ax * fx + az * fz;
    let turn = player.facing - this.prevFacing; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.prevFacing = player.facing;
    const leanT = Math.max(-0.35, Math.min(0.35, fwdAcc * 0.012 + hs * 0.018));
    const bankT = Math.max(-0.4, Math.min(0.4, (-turn / Math.max(dt, 1e-4)) * 0.035 * Math.min(1, hs / 4)));
    this.lean += (leanT - this.lean) * Math.min(1, dt * 10);
    this.bank += (bankT - this.bank) * Math.min(1, dt * 8);

    // spin and flip
    if (this.spinV > 0) { this.spin += dt * 2 * Math.PI * 2.8; if (this.spin >= Math.PI * 2 * this.spinV) { this.spin = 0; this.spinV = 0; } }
    if (this.flip > 0) this.flip = Math.max(0, this.flip - dt * 3.2);

    this.root.rotation.set(0, player.facing + this.look + this.spin, 0);
    let swing = 0;
    if (this.onLineNow) swing = Math.sin(t * 7) * 0.12;
    const swimRock = player.swimming ? Math.sin(t * 3) * 0.1 : 0;
    // a forward flip about Pip's middle on echo
    const fa = this.flip > 0 ? (1 - this.flip) * Math.PI * 2 : 0, c = 0.45;
    this.tilt.rotation.set(this.lean + swing + fa, 0, this.bank + swimRock, 'YXZ');
    this.tilt.position.set(0, this.bounceY + (player.swimming ? Math.sin(t * 3) * 0.05 : 0) + c - c * Math.cos(fa), -c * Math.sin(fa));
    const s = this.sq * this.appear;
    const xz = 1 / Math.sqrt(Math.max(0.3, this.sq)) * this.appear;
    this.squashG.scale.set(xz, s, xz);

    // antenna lags on a spring
    const localAx = ax * Math.cos(player.facing) - az * Math.sin(player.facing);
    this.antV.x += ((-fwdAcc * 0.004 - V.y * 0.015 - this.ant.x) * 90 - this.antV.x * 7) * dt;
    this.antV.y += ((localAx * 0.004 - this.ant.y) * 90 - this.antV.y * 7) * dt;
    this.ant.x += this.antV.x * dt; this.ant.y += this.antV.y * dt;
    this.antenna.rotation.set(Math.max(-0.9, Math.min(0.9, this.ant.x)), 0, Math.max(-0.9, Math.min(0.9, this.ant.y)));

    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 0.12; this.blinkT = 2 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt);
    for (const e of this.eyes) e.scale.y = this.blink > 0 ? 0.25 : 1.7;

    // glow = echo ready
    const target = player.echoReady ? 1 : 0.25;
    this.glow += (target - this.glow) * Math.min(1, dt * 8);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.mat.uniforms.uGlow.value = this.glow;
    this.mat.uniforms.uFlash.value = this.flash;
    this.halo.material.opacity = 0.12 + 0.28 * this.glow;

    // blob shadow
    const hit = physics.groundBelow(renderPos.x, renderPos.y + 0.2, renderPos.z, 40, 0.05);
    if (hit && this.visible) {
      const hgt = renderPos.y - hit.y;
      this.shadow.visible = true;
      this.shadow.position.set(renderPos.x, hit.y + 0.03, renderPos.z);
      const k = Math.max(0.25, 1 - hgt / 12);
      this.shadow.scale.setScalar(0.95 * k + 0.1);
      this.shadow.material.opacity = k;
    } else this.shadow.visible = false;

    this.updateTrail(dt, t, renderPos, camera, player, hs);
  }

  updateTrail(dt, t, p, camera, player, hs) {
    const pts = this.trailPts;
    for (let i = TRAIL - 1; i > 0; i--) pts[i].copy(pts[i - 1]);
    pts[0].set(p.x, p.y + 0.45, p.z);
    const fast = player.state === 'line' || player.skipChain > 0 || hs > 8 || this.flip > 0;
    const want = this.visible ? (fast ? 0.9 : Math.max(0, Math.min(0.35, (hs - 5) * 0.12))) : 0;
    this.trailMat.uniforms.uOpacity.value += (want - this.trailMat.uniforms.uOpacity.value) * Math.min(1, dt * 6);
    const pos = this.trail.geometry.attributes.position;
    const cam = camera.position;
    const side = new THREE.Vector3(), dir = new THREE.Vector3(), view = new THREE.Vector3();
    for (let i = 0; i < TRAIL; i++) {
      const a = pts[i], b = pts[Math.min(TRAIL - 1, i + 1)];
      dir.subVectors(a, b); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
      view.subVectors(cam, a);
      side.crossVectors(dir, view).normalize();
      const w = 0.16 * (1 - i / TRAIL);
      const wave = Math.sin(i * 0.8 - t * 18) * 0.09 * (1 - i / TRAIL);
      pos.setXYZ(i * 2, a.x + side.x * w, a.y + side.y * w + wave, a.z + side.z * w);
      pos.setXYZ(i * 2 + 1, a.x - side.x * w, a.y - side.y * w + wave, a.z - side.z * w);
    }
    pos.needsUpdate = true;
  }
}
