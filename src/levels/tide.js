import * as THREE from 'three';
import { cylinder, place, paint, beam, gradient, col, chamferBox } from '../geometry.js';
import { makeBeamMaterial } from '../materials.js';
import { audio } from '../audio.js';
import { music } from '../music.js';

// Fair, Becoming Poor — the shipping forecast, settled into a sea.
// Subject: a natural process (the tide). Pip can barely jump from water, but echoes float:
// the tide decides what you can reach, and your echo is your raft.

const LOW = -1.5, HIGH = 4.8, CYCLE = 28;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function tideAt(t) {
  const c = (t + 4) % CYCLE;
  if (c < 8) return LOW;
  if (c < 14) return LOW + (HIGH - LOW) * smooth(8, 14, c);
  if (c < 22) return HIGH;
  return HIGH + (LOW - HIGH) * smooth(22, 28, c);
}

const ROCK = 0x8c979c, ROCK_S = 0x4c5860, SAND = 0xc2b08e, STONE = 0xa29a8a, SODIUM = 0xffa040;
// The rip rings the outer wreck: swimmers and floating echoes are carried away from it on
// every side, except over the reef it sits on. Only skipping gets you across.
const RIP = { x: -62, z: -8, x0: -84, x1: -43, z0: -34, z1: 20 };
const inRip = (x, z) => x > RIP.x0 && x < RIP.x1 && z > RIP.z0 && z < RIP.z1 && !(x > -68.5 && x < -53.5 && z > -15.5 && z < -0.5);
function ripPush(o, dt) {
  const dx = o.x - RIP.x, dz = o.z - RIP.z, d = Math.hypot(dx, dz) || 1;
  o.x += (dx / d) * 6 * dt; o.z += (dz / d) * 6 * dt;
}

export default {
  id: 'tide',
  name: 'Fair, Becoming Poor',
  freq: '198 kHz',
  dial: 0.08,
  qsl: '198 kHz. "And now the shipping forecast." The names of the sea areas have worn smooth from being read aloud every night for a hundred years. The sea here is made of them.',
  qslColors: ['#e4e8e0', '#2a5a6a', '#1a2a30'],
  killY: -60,
  echoLifeWater: 8,
  palette: { top: ROCK, side: ROCK_S, accent: SODIUM, dust: 0xd8d0c0 },
  env: {
    sky: { top: 0x161c24, horizon: 0x6a7a80, bottom: 0x2a3438, aurora1: 0x5affc0, aurora2: 0x3a8aff, aurora: 0.35, stars: 0.3, clouds: 0.75, cloudColor: 0x3a464c, horizonGlow: 0.35 },
    fog: [0x56666c, 40, 170],
    hemi: [0xa8bcc4, 0x3a3230, 1.35],
    sun: [0xffd0a0, 0.7, [0.6, 0.5, 0.4]],
    rim: 0x6a9aa8, low: 0x5a6466, lowY: -6, highY: 10, groove: 0.05, grooveScale: 6,
    motes: { color: 0xdfe8e8, count: 140, size: 0.06, opacity: 0.45, drift: [0.6, -0.2, 0.3] },
    echo: 0xd8fff4,
  },
  music: {
    bpm: 84, root: 57, scale: 'minor', steps: 48,
    layers: [
      { name: 'swell', inst: 'pad', gain: 0.85, cutoff: 800, notes: [[0, [0, 2, 4], 12], [12, [-2, 0, 2], 12], [24, [-5, -3, 0], 12], [36, [-3, -1, 1], 12]] },
      { name: 'motif', inst: 'lead', depth: 1, gain: 0.7, oct: 1, echo: true, notes: [[0, 4, 2], [2, 4, 2], [4, 3, 2], [6, 2, 4], [12, 0, 2], [14, 1, 2], [16, 2, 6], [24, 4, 2], [26, 3, 2], [28, 2, 2], [30, 1, 4], [36, -1, 2], [38, 0, 2], [40, 1, 6]] },
      { name: 'bass', inst: 'bass', depth: 2, gain: 0.6, oct: -1, notes: [[0, 0, 6], [6, 4, 6], [12, -2, 6], [18, 2, 6], [24, -5, 6], [30, -1, 6], [36, -3, 6], [42, 1, 6]] },
      { name: 'wind', inst: 'wind', depth: 4, until: 8, gain: 0.9, notes: [[0, 0, 24], [24, 2, 24]] },
      { name: 'counter', inst: 'musicbox', depth: 5, gain: 0.5, oct: 2, notes: [[3, 0, 2], [9, 2, 2], [15, -1, 2], [21, 0, 2], [27, -3, 2], [33, -1, 2], [39, -2, 2], [45, -1, 2]] },
      { name: 'perc', inst: 'brush', depth: 6, gain: 0.7, hits: 'x..x..x..x.x' },
      { name: 'spring', inst: 'organ', depth: 8, gain: 0.7, notes: [[0, [0, 4, 7], 12], [12, [-2, 2, 5], 12], [24, [-5, 0, 2], 12], [36, [-3, 1, 4], 12]] },
    ],
  },

  build(L, g) {
    const st = { t: 0, storm: 0, spring: null, rain: null, buoys: [], beam: null };
    const water = st.water = L.water({ x: 0, z: -30, w: 420, d: 420, y: LOW, seg: 72, deep: 0x0d2a2c, shallow: 0x2c5a54, sky: 0x8a9ea0, amp: 0.18, freq: 0.12, glint: 0xffd8a8 });
    st.level = LOW;

    // the deep basin and the far sea floor (revealed by the spring tide)
    L.plat(0, -46, -60, 200, 120, { t: 4, color: 0x5a6a62, side: 0x3a4440 });
    L.block(-40, -46, -70, 60, 44.8, 60, { color: SAND, side: 0x6a6252 });
    L.plat(0, -4, 20, 200, 100, { t: 42, color: 0x7a7060, side: 0x4a463e });

    // ---- the cove (start). Low tide: dry sand. The stair out begins at the high-water mark.
    L.plat(0, 0, 40, 26, 26, { t: 4, color: SAND, side: 0x8a7a64 });
    L.block(-17, -6, 40, 8, 18, 30, { color: ROCK });
    L.block(0, -6, 57, 42, 18, 8, { color: ROCK });
    L.block(17, -6, 44, 8, 18, 22, { color: ROCK });
    L.spawn(0, 0.05, 47, Math.PI);
    for (let i = 0; i < 6; i++) L.block(11.6, -1, 34 - i * 2.1, 2.4, 5.9 + i * 1.3, 2.1, { color: STONE });
    L.checkpoint(16.5, 12, 30, { depth: 1 });
    // tide gauge, mooring post, a sodium lamp
    L.mesh(place(paint(new THREE.CylinderGeometry(0.18, 0.18, 9, 8).translate(0, 4.5, 0), (x, y) => col(Math.floor(y + 0.0001) % 2 ? 0x2a2a2a : 0xe8e0d0)), -6, 0, 30));
    L.pillar(-9, 0, 35, 0.35, 5.4, { color: 0x5a4a3a, seg: 8 });
    L.mesh(place(cylinder(0.08, 0.1, 6, 6, 0x4a4a50), 9, 0, 46));
    L.glow(9, 6.1, 46, SODIUM, 5, { opacity: 0.9 });
    L.light(9, 5.5, 46, SODIUM, 25, 22);

    // ---- the headland (cliff path), hollowed by the sea cave
    L.block(18.25, -0.5, 1, 4.5, 12.5, 14, { color: ROCK });
    L.block(25.75, -0.5, 1, 4.5, 12.5, 14, { color: ROCK });
    L.block(22, 2.6, 1, 3, 9.4, 14, { color: ROCK });
    L.block(17, -0.5, 11.5, 2, 12.5, 7, { color: ROCK });
    L.block(27, -0.5, 11.5, 2, 12.5, 7, { color: ROCK });
    L.block(22, 10, 11.5, 8, 2, 7, { color: ROCK });
    L.block(22, -0.5, 25, 12, 12.5, 20, { color: ROCK });
    L.plat(22, -0.5, 1.5, 12, 27, { t: 3.5, color: SAND });
    L.block(19.0, -0.5, 11.5, 1.3, 1.8, 3, { color: STONE });
    L.block(20.4, -0.5, 11.5, 1.3, 3.1, 3, { color: STONE });
    L.block(21.8, -0.5, 11.5, 1.3, 4.4, 3, { color: STONE });
    L.block(24.6, -0.5, 11.5, 2.8, 5.7, 7, { color: STONE });
    L.secret('qsl', 'qsl', 24.6, 6.2, 11.2);
    L.glow(22, 2, 11, 0x7affe0, 4, { opacity: 0.5 });
    L.checkpoint(22, 12, -4, { depth: 2 });

    // ---- the flats: sand at low tide, sea at high; rock stacks to climb
    L.plat(-7, -0.5, -12, 46, 36, { t: 4, color: SAND, side: 0x8a7a64 });
    for (const [x, z, r, h] of [[-4, -2, 2.2, 6], [7, -14, 1.8, 4.5], [-15, -18, 2.4, 8.5], [-20, 0, 1.6, 3.2], [3, 4, 1.4, 2.4], [-9, -24, 1.7, 5.2]]) L.pillar(x, -0.5, z, r, h, { color: ROCK, seg: 9 });
    L.checkpoint(-2, -0.5, -10, { depth: 3 });

    // the Long Stack, out in the gut: only an echo-raft at high water gets you up
    L.block(0, -46, -36, 14, 53.2, 10, { color: ROCK });
    L.prompt(0, -0.5, -27, 5, 'echo');
    L.checkpoint(-3, 7.2, -36, { depth: 4 });
    L.camZone(0, -2, -36, 16, 14, 12, { dist: 9.5 });

    // ---- west: the skipping-stone beach, the rip, the outer wreck
    L.plat(-36, 1, -10, 14, 14, { t: 5, color: SAND });
    L.block(-36, -1, -17.5, 12, 7, 3.5, { color: ROCK });
    L.block(-31, -1, -14.6, 2, 3.2, 2, { color: STONE });
    L.block(-33.4, -1, -14.6, 2, 4.6, 2, { color: STONE });
    L.secret('ability', 'skip', -38, 7.2, -17.5, { ability: 'skip', line: 'Skywaves travel by skipping off the sky. Jump the instant you land and keep going; go fast enough and water will hold you up.' });
    for (let i = 0; i < 7; i++) L.mesh(place(paint(new THREE.SphereGeometry(0.3, 8, 4).scale(1, 0.3, 0.8), 0x8a8e94), -40 + i * 1.3, 1.08, -6 + Math.sin(i) * 1.5));
    L.block(-62, -46, -8, 12, 50, 14, { color: ROCK });
    L.block(-55, -46, -6, 2, 47, 3, { color: STONE });
    L.block(-62, 4, -8, 9, 2.5, 3.2, { color: 0x4a6a68, bevel: 0.4 });
    L.block(-59.5, 6.5, -8, 2.6, 2.2, 2.6, { color: 0xd8c8a8 });
    L.secret('stray', 'stray', -64, 7, -8, { stray: 'foghorn', name: 'The Foghorn calf', line: 'A note from a lightship that went out of service long ago. It still warns everyone about everything, very kindly.' });

    // ---- the storm: a broken breakwater to the lighthouse
    for (const [x, z, w, d, top] of [[0, -58, 5, 5, 7.4], [0, -63, 4, 4.5, 9.4], [-6, -71, 5, 5, 7.0], [5, -48, 3, 3, 3.6]]) L.block(x, -46, z, w, top + 46, d, { color: STONE });
    L.checkpoint(0, 9.4, -63, { depth: 5 });
    L.camZone(0, -2, -62, 30, 20, 34, { dist: 10.5, pitch: 0.42 });
    for (const [x, z] of [[-10, -50], [9, -66], [-14, -78]]) {
      const b = L.dyn(paint(new THREE.CylinderGeometry(0.5, 0.8, 1.6, 10), (px, py) => col(py > 0.2 ? 0xc8402a : 0xe8d8c0)));
      st.buoys.push({ m: b, x, z, next: Math.random() * 6 });
    }

    // ---- the lighthouse rock, the lighthouse, and what it stands on
    L.block(0, -8, -92, 24, 17.5, 22, { color: ROCK });
    L.block(13, -8, -86, 4, 13, 3, { color: STONE });
    L.block(13.5, -8, -89.6, 3, 15.2, 3, { color: STONE });
    L.checkpoint(-4, 9.5, -84, { depth: 6 });
    for (let i = 0; i < 6; i++) {
      const r0 = 3.2 - (i / 6) * 0.6, r1 = 3.2 - ((i + 1) / 6) * 0.6, c = i % 2 ? 0xb83a2a : 0xece4d4;
      L.mesh(place(cylinder(r1, r0, 22 / 6, 18, c, c), 0, 9.5 + (i * 22) / 6, -92));
    }
    L.solid(0, 9.5, -92, 4.4, 22, 4.4);
    for (let i = 0; i < 15; i++) {
      const a = i * 0.62 + Math.PI * 0.5, top = 9.5 + 1.42 * (i + 1);
      const x = Math.cos(a) * 7, z = -92 + Math.sin(a) * 7;
      L.block(x, top - 0.6, z, 2.1, 0.6, 2.1, { color: STONE });
    }
    const gy = 31.4;
    for (const [x, z, w, d] of [[0, -96.2, 9, 2.4], [0, -87.8, 9, 2.4], [-4.2, -92, 2.4, 6], [4.2, -92, 2.4, 6]]) L.plat(x, gy, z, w, d, { t: 0.4, color: STONE });
    L.mesh(place(paint(new THREE.CylinderGeometry(2.3, 2.3, 3.4, 16, 1, true).translate(0, 1.7, 0), 0xfff2c8), 0, gy, -92), { glow: true });
    L.mesh(place(cylinder(0.3, 2.8, 1.6, 16, 0x3a3a3a), 0, gy + 3.4, -92));
    L.solid(0, gy, -92, 4.4, 5, 4.4);
    L.glow(0, gy + 1.8, -92, 0xfff0c0, 14, { opacity: 0.9 });
    const bm = L.dyn(new THREE.ConeGeometry(9, 70, 24, 1, true).translate(0, -35, 0).rotateZ(Math.PI / 2), makeBeamMaterial(0xfff0c8, 0.16));
    bm.position.set(0, gy + 1.8, -92); st.beam = bm;
    // the bell on the gallery: ring it to call the spring tide
    const bellGeo = paint(new THREE.LatheGeometry([[0, 0.9], [0.25, 0.85], [0.42, 0.55], [0.5, 0.1], [0.62, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 14), 0xc8a050);
    const bell = L.dyn(bellGeo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x402a10 }));
    bell.position.set(0, gy + 1.0, -86.9); st.bell = bell;
    L.mesh(beam([-1, gy, -86.9], [-1, gy + 2.1, -86.9], 0.12, 0x5a5a5a)); L.mesh(beam([1, gy, -86.9], [1, gy + 2.1, -86.9], 0.12, 0x5a5a5a));
    L.mesh(beam([-1, gy + 2.1, -86.9], [1, gy + 2.1, -86.9], 0.12, 0x5a5a5a));
    L.trigger(0, gy, -86.9, 2.4, 3, 2.4, { once: true, enter: (gg) => this.ringBell(st, gg) });
    // the cable to the far rock (Line)
    // the far rock stands above anything a swimmer can reach, even on a storm crest
    L.wire([[3.4, gy + 2.6, -94], [38, 14, -104]], { sag: 0.02, radius: 0.06, color: 0x6a6a6a, oneWay: 1 });
    L.block(40, -46, -105, 8, 58, 8, { color: ROCK });
    L.block(40, 12, -105, 2, 0.6, 2, { color: STONE });
    L.secret('harmonic', 'harmonic', 40, 13.6, -105);
    L.block(30, -46, -98, 3, 50.6, 3, { color: STONE });
    L.block(22, -46, -94, 3, 50.2, 3, { color: STONE });

    // the colossal mast beneath the lighthouse rock, and the transmitter hall at its foot
    const ML = (y) => 7 - ((y + 46) / 38) * 3;
    for (let y = -46; y < -8; y += 4.75) {
      const w0 = ML(y), w1 = ML(y + 4.75);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        L.mesh(beam([sx * w0, y, -92 + sz * w0], [sx * w1, y + 4.75, -92 + sz * w1], 0.6, 0x6a6a72));
        L.mesh(beam([sx * w0, y, -92 + sz * w0], [-sz * w1, y + 4.75, -92 + sx * w1], 0.25, 0x5a5a62));
      }
    }
    for (let i = 0; i < 17; i++) {
      const a = i * 0.36, y = 6 - i * 3;
      L.plat(Math.cos(a) * 15, y, -92 + Math.sin(a) * 15, 4, 4, { t: 0.6, color: STONE });
    }
    L.block(0, -46, -92, 10, 7, 10, { color: 0x6a7068, side: 0x4a504a });
    L.block(0, -46, -85.5, 4, 5, 3, { color: 0x2a2e2c, solid: false });
    L.solid(-3.5, -46, -85.6, 3, 5, 3); L.solid(3.5, -46, -85.6, 3, 5, 3);
    L.checkpoint(-4, -46, -76, { depth: 8 });
    L.ident(0, -44.8, -84.6);
    st.hallLight = L.glow(0, -43.5, -86, SODIUM, 8, { opacity: 0 });

    // rain for the storm
    const N = 700, rg = new THREE.BufferGeometry(), rp = new Float32Array(N * 6);
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xc8d8e0, transparent: true, opacity: 0 }));
    rain.frustumCulled = false; L.root.add(rain);
    st.rain = { m: rain, p: rp, N, seed: Array.from({ length: N }, () => [Math.random(), Math.random(), Math.random()]) };
    return st;
  },

  ringBell(st, g) {
    if (st.spring) return;
    audio.bell(0, -1, 0.3); audio.bell(4, 0, 0.2); audio.thud();
    g.fx.shake(0.5); g.fx.hitStop(0.12);
    st.spring = { t: 0, from: st.level };
    music.setDepth(8);
    g.rig.playShot({ dur: 9, blendIn: 1.4, blendOut: 1.8, fov: 58, look: [0, -24, -88], path: (k, out) => out.set(26 + k * 18, 44 - k * 10, -50 + k * 10) });
    g.player.state = 'frozen';
    g.world.after(8.2, () => { if (g.player.state === 'frozen') g.player.state = 'play'; });
  },

  onCheckpoint(st, cp) {
    if (cp.depth >= 4) st.storm = 1;
    // resuming on the seabed: the spring tide has already gone out
    if (cp.depth >= 8 && !st.spring) { st.spring = { t: 99, from: -47 }; st.level = -47; }
  },

  onComplete(st, g) {
    st.returning = 0;
    const P = g.player.pos;
    g.rig.playShot({ dur: 3.4, blendIn: 0.6, blendOut: 0.01, fov: 60, path: (k, out) => out.set(P.x + 12, P.y + 5, P.z + 14) });
  },

  fixed(st, dt, g) {
    st.t += dt;
    const w = st.water;
    let target;
    if (st.returning !== undefined) { st.returning += dt; target = Math.min(HIGH, -46 + st.returning * 16); }
    else if (st.spring) { st.spring.t += dt; target = st.spring.from + (-47 - st.spring.from) * smooth(1.5, 9, st.spring.t); }
    else if (st.storm) target = HIGH;
    else target = tideAt(st.t);
    const prev = st.level;
    st.level += (target - st.level) * Math.min(1, dt * (st.spring ? 6 : 2));
    w.setLevel(st.level);
    w.amp += ((st.storm && !st.spring ? 1.15 : 0.18) - w.amp) * dt * 0.4;
    // a whoosh and the buoys' bells when the tide turns
    if (!st.storm && Math.sign(st.level - prev) !== Math.sign(st.lastDir || 0) && Math.abs(st.level - prev) > 1e-4) { st.lastDir = Math.sign(st.level - prev); audio.whoosh(1.4); }
    // the rip pulls swimmers (and floating echoes) out to sea
    const p = g.player, P = p.pos;
    if (p.swimming && inRip(P.x, P.z)) ripPush(P, dt);
    for (const e of g.world.echoes) if (e.floating && inRip(e.x, e.z)) { ripPush(e, dt); e.col.moveTo(e.x, e.y, e.z); }
    if (st.returning !== undefined && P.y < st.level - 0.5) { P.y = st.level - 0.5; p.vel.y = 0; }
  },

  update(st, dt, g) {
    const t = st.t, w = st.water, world = g.world;
    if (st.beam) st.beam.rotation.y = t * 0.6;
    if (st.bell && st.spring) st.bell.rotation.z = Math.sin(st.spring.t * 6) * 0.4 * Math.max(0, 1 - st.spring.t / 4);
    if (st.spring) st.hallLight.material.opacity = Math.min(0.9, st.spring.t / 6);
    for (const b of st.buoys) {
      const y = world.liquidAt(b.x, b.z)?.y ?? w.level;
      b.m.position.set(b.x, y + 0.3, b.z);
      b.m.rotation.set(Math.sin(t * 1.3 + b.x) * 0.25 * (0.3 + w.amp), 0, Math.cos(t * 1.1 + b.z) * 0.25 * (0.3 + w.amp));
      b.next -= dt;
      if (b.next < 0 && !st.spring) { b.next = 5 + Math.random() * 6; audio.bell(4, 1, 0.07, audio.panner(b.x, y + 1, b.z, 6)); }
    }
    // weather: fair, becoming poor
    const s = st.storm && !st.spring ? 1 : 0;
    st.wx = (st.wx ?? 0) + (s - (st.wx ?? 0)) * Math.min(1, dt * 0.5);
    const fog = g.scene.fog, k = st.wx;
    fog.near = 40 - 25 * k; fog.far = (st.spring ? 300 : 170) - 85 * k;
    fog.color.set(0x56666c).lerp(col(0x2e3a3e), k);
    g.renderer.setClearColor(fog.color);
    const u = world.sky.material.uniforms;
    u.uCloud.value = 0.75 + 0.25 * k; u.uHorizon.value.set(0x6a7a80).lerp(col(0x34424a), k);
    const r = st.rain, cp = g.camera.position;
    r.m.material.opacity = 0.35 * k;
    if (k > 0.01) {
      for (let i = 0; i < r.N; i++) {
        const sd = r.seed[i];
        const x = cp.x + (sd[0] - 0.5) * 50, z = cp.z + (sd[1] - 0.5) * 50;
        const y = cp.y + 20 - (((t * 22 + sd[2] * 40) % 40));
        r.p.set([x, y, z, x - 0.25, y - 1.2, z - 0.1], i * 6);
      }
      r.m.geometry.attributes.position.needsUpdate = true;
    }
  },
};
