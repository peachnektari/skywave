import * as THREE from 'three';
import { cylinder, place, paint, beam, col, chamferBox } from '../geometry.js';
import { audio } from '../audio.js';
import { music } from '../music.js';

// Mean Time — the hilltop observatory where the hour is kept.
// Subject: a place. Machinery here moves only on the pips: once a second, everything steps.

const BONE = 0xe4dccb, NAVY = 0x3a4460, NAVY_S = 0x232a40, BRASS = 0xd8a850, RED = 0xe0302a, STONE = 0xc6beb0;
const EASE = 0.15;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ping = (n, len) => { const p = n % (2 * len); return p <= len ? p : 2 * len - p; };

export default {
  id: 'meantime',
  name: 'Mean Time',
  freq: '60 kHz',
  dial: 0.02,
  qsl: '60 kHz. The hour is not kept anywhere in particular; it is kept by being said, once a second, all night. Somebody has to keep saying it. Until you fell, it was you.',
  qslColors: ['#e8e2d4', '#1e2a4a', '#b8863a'],
  killY: -30,
  palette: { top: BONE, side: NAVY, accent: BRASS, dust: 0xc8d0e0 },
  env: {
    sky: { top: 0x040818, horizon: 0x1a2848, bottom: 0x0a1020, aurora1: 0x5a8aff, aurora2: 0x8a6aff, aurora: 0.12, stars: 1.6, starSpin: 0.015, horizonGlow: 0.3 },
    fog: [0x0e1830, 70, 280],
    hemi: [0xa8bce8, 0x2a2838, 1.4],
    sun: [0xd8e4ff, 1.0, [0.3, 1, 0.55]],
    rim: 0x6a8ad0, low: 0x3a4058, lowY: -4, highY: 40, groove: 0.035, grooveScale: 5,
    motes: { color: 0xd8e0ff, count: 120, size: 0.05, opacity: 0.4, drift: [0.05, 0.02, 0.05] },
    echo: 0xfff0d0,
  },
  titleShot: { center: [0, 25, -40], r: 70, h: 20 },
  music: {
    bpm: 60, root: 52, scale: 'minor', steps: 64,
    layers: [
      { name: 'tick', inst: 'tick', gain: 0.45, hits: 'X...x...x...x...' },
      { name: 'pad', inst: 'pad', gain: 0.6, cutoff: 700, notes: [[0, [0, 2, 4], 16], [16, [-1, 1, 3], 16], [32, [-4, -2, 0], 16], [48, [-3, -1, 1], 16]] },
      // the theme: a rising E-G-B that settles on F#, answered by B-C-B-A-G-F#-D-E. One note a pip.
      { name: 'motif', inst: 'bell', depth: 1, gain: 0.6, oct: 1, notes: [[0, 0, 4], [4, 2, 4], [8, 4, 4], [12, 3, 2], [14, 2, 2], [16, 1, 12], [32, 4, 4], [36, 5, 4], [40, 4, 2], [42, 3, 2], [44, 2, 4], [48, 1, 4], [52, -1, 4], [56, 0, 8]] },
      { name: 'bass', inst: 'bass', depth: 2, gain: 0.5, oct: -1, notes: [[0, 0, 8], [16, -1, 8], [32, -4, 8], [48, -3, 8]] },
      // deeper in, the theme answers itself two pips behind, an octave up
      { name: 'counter', inst: 'musicbox', depth: 3, gain: 0.4, oct: 2, notes: [[0, 0, 4], [8, 0, 2], [12, 2, 2], [16, 4, 2], [20, 3, 1], [22, 2, 1], [24, 1, 6], [40, 4, 2], [44, 5, 2], [48, 4, 1], [50, 3, 1], [52, 2, 2], [56, 1, 2], [60, -1, 2]] },
      { name: 'pips', inst: 'pip', depth: 4, gain: 0.35, notes: [[0, 0, 1], [4, 0, 1], [8, 0, 1], [12, 0, 1]] },
      { name: 'organ', inst: 'organ', depth: 5, gain: 0.5, notes: [[0, [0, 4, 7], 16], [16, [-1, 3, 6], 16], [32, [-4, 0, 3], 16], [48, [-3, 1, 4], 16]] },
      { name: 'chime', inst: 'bell', depth: 6, gain: 0.35, oct: 2, notes: [[20, 4, 2], [22, 5, 2], [24, 6, 4], [28, 4, 4], [60, 7, 2], [62, 4, 2]] },
    ],
  },

  build(L, g) {
    const st = { t: 0, ticks: 0, lastB: null, stopped: false, rc: 0, machines: [], room: [], M: null };
    const items = [];
    const add = (x, y, z, w, h, d, color = BRASS) => { items.push({ x, y, z, w, h, d, color }); return items.length - 1; };
    // A machine: f(count) gives its notch value; pose(value) places its movers. Stepped by ticks
    // (or, in the chronometer room, by echoes) with a short snap ease.
    const machine = (f, pose, o = {}) => { const m = { f, pose, v: f(0), pv: f(0), tT: -9, ease: o.ease ?? EASE }; (o.room ? st.room : st.machines).push(m); return m; };
    st.add = add; st.machine = machine;

    // ---- the park (start)
    L.plat(0, 0, 30, 70, 50, { t: 4, color: 0x5a6a78, side: 0x2a3244 });
    L.spawn(0, 0.05, 46, Math.PI);
    for (const [x, z] of [[-30, 50], [-28, 30], [-31, 14], [29, 48], [31, 26], [27, 12]]) {
      L.pillar(x, 0, z, 0.35, 3, { color: 0x3a3a48, seg: 7 });
      L.mesh(place(paint(new THREE.IcosahedronGeometry(2.2, 1).scale(1, 1.25, 1), 0x2a3a4a), x, 4.6, z));
    }
    // the park lift: up one notch a second, a pause at the top, down again
    const lift = add(0, 0, 6.6, 3, 0.5, 3);
    machine((n) => [0, 1, 2, 3, 4, 5, 6, 6, 6, 5, 4, 3, 2, 1, 0, 0][n % 16], (v) => st.M[lift].set(0, v - 0.25, 6.6));
    for (const s of [-1, 1]) L.block(s * 2.1, 0, 6.6, 0.4, 7.4, 0.4, { color: NAVY, side: NAVY_S });

    // ---- the first terrace
    L.plat(0, 6, -10, 70, 30, { t: 10, color: STONE, side: NAVY });
    L.checkpoint(4, 6, 1.5, { depth: 1 });
    // terrace fronts: bone coping, stone pilasters, and the warm windows of rooms kept awake all night
    const facade = (x0, x1, z, y0, y1, rows) => {
      L.block((x0 + x1) / 2, y1 - 0.35, z + 0.15, x1 - x0 + 0.4, 0.35, 0.6, { color: BONE, solid: false, bevel: 0.05 });
      for (let x = x0 + 3.5; x < x1; x += 7) L.block(x, y0, z + 0.12, 0.7, y1 - y0 - 0.35, 0.3, { color: STONE, side: 0x8a8478, solid: false, bevel: 0.04 });
      for (let x = x0 + 7; x < x1 - 1; x += 7) for (let r = 0; r < rows; r++) {
        if (Math.abs(x) < 3 && y0 < 1) continue;
        L.block(x, y0 + 1.4 + r * 4, z + 0.03, 1.1, 1.9, 0.1, { color: (x + r) % 3 ? 0xf0c880 : 0x2a3450, glow: (x + r) % 3 !== 0, solid: false, bevel: 0.02 });
      }
    };
    facade(-35, 35, 5, 0, 6, 1);
    facade(-14, 14, -24, 6, 18, 2);

    // ---- Dome A: its shutter leaves spiral round it and turn one notch a second
    const DX = 20, DZ = -10;
    L.pillar(DX, 6, DZ, 5.5, 3, { color: BONE, seg: 28 });
    L.mesh(place(paint(new THREE.SphereGeometry(5.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), (x, y, z) => col(Math.abs(Math.atan2(x, z)) < 0.18 ? NAVY_S : 0xc8c4bc)), DX, 9, DZ));
    L.solid(DX, 9, DZ, 7.6, 2.6, 7.6); L.solid(DX, 11.6, DZ, 5, 2.6, 5);
    for (let i = 0; i < 6; i++) L.mesh(place(paint(new THREE.TorusGeometry(5.56, 0.07, 4, 20, Math.PI).rotateY((i / 6) * Math.PI), BRASS), DX, 9, DZ));
    L.mesh(place(paint(new THREE.TorusGeometry(5.6, 0.14, 4, 40).rotateX(Math.PI / 2), BRASS), DX, 9, DZ));
    const leaves = [];
    for (let i = 0; i < 10; i++) leaves.push(add(DX, 0, DZ, 2.8, 0.5, 2.8, i % 2 ? BRASS : 0xc89a48));
    machine((n) => n, (v) => leaves.forEach((k, i) => {
      const a = 1.2 + i * 0.628 - v * 0.157;
      st.M[k].set(DX + Math.cos(a) * 7.2, 7.2 + i * 0.92 - 0.25, DZ + Math.sin(a) * 7.2, -a);
    }));
    // the dome's gallery: a ring walk at the top of the spiral, joining the balcony
    L.mesh(place(paint(new THREE.LatheGeometry([[9.3, -0.4], [11.1, -0.4], [11.1, 0], [9.3, 0], [9.3, -0.4]].map(([r, y]) => new THREE.Vector2(r, y)), 48), (x, y, z) => col(y > -0.05 ? BONE : NAVY)), DX, 15.2, DZ));
    L.mesh(place(paint(new THREE.TorusGeometry(10.95, 0.06, 4, 64).rotateX(Math.PI / 2), BRASS), DX, 16.2, DZ));
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; L.solid(DX + Math.cos(a) * 10.2, 14.8, DZ + Math.sin(a) * 10.2, 1.8, 0.4, 1.8); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; L.pillar(DX + Math.cos(a) * 10.2, 6, DZ + Math.sin(a) * 10.2, 0.28, 8.8, { color: NAVY, seg: 8 }); }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, x = DX + Math.cos(a) * 10.95, z = DZ + Math.sin(a) * 10.95; L.mesh(beam([x, 15.2, z], [x, 16.2, z], 0.05, BRASS)); }
    L.plat(DX, 15.2, -20, 6, 3, { t: 0.5, color: BONE });
    L.block(DX, 6, -20.5, 1.2, 8.7, 1.2, { color: NAVY, side: NAVY_S });
    for (const s of [-1, 1]) L.mesh(beam([DX + s * 2.9, 15.2, -21.4], [DX + s * 2.9, 16.2, -21.4], 0.08, BRASS));
    L.mesh(beam([DX - 2.9, 16.2, -21.4], [DX + 2.9, 16.2, -21.4], 0.08, BRASS));
    L.checkpoint(DX + 1.5, 15.2, -19.5, { depth: 2 });

    // ---- telescope arms: each eyepiece end steps up or down a notch per pip
    st.arms = [];
    const arm = (ex, ez, lo, phase, pivot) => {
      const k = add(ex, lo, ez, 3, 0.5, 3, BONE);
      const tube = L.dyn(paint(new THREE.CylinderGeometry(0.42, 0.55, 1, 14).rotateX(Math.PI / 2).translate(0, 0, 0.5), (x, y, z) => col(z > 0.8 ? BRASS : NAVY)));
      const a = { k, tube, pivot: new THREE.Vector3(...pivot), end: new THREE.Vector3() };
      st.arms.push(a);
      machine((n) => ping(n + phase, 4), (v) => { st.M[k].set(ex, lo + v - 0.25, ez); a.end.set(ex, lo + v - 0.5, ez); });
    };
    L.block(27, 6, -24, 2, 6, 2, { color: NAVY, side: NAVY_S });
    arm(20, -25, 14.2, 0, [27, 12.4, -24]);
    L.block(23, -4, -33, 2.2, 18, 2.2, { color: NAVY, side: NAVY_S });
    arm(17, -29.4, 15.5, 4, [23, 14.4, -33]);

    // ---- the transit room (west): its shutter opens a notch a pip, waits, and shuts again
    const TX = -22, TZ = -12, TW = { color: BONE, side: NAVY };
    L.block(TX, 6, TZ - 5, 10, 5, 1, TW); L.block(TX, 6, TZ + 5, 10, 5, 1, TW); L.block(TX - 5, 6, TZ, 1, 5, 9, TW);
    L.block(TX + 5, 6, TZ - 3.25, 1, 5, 2.5, TW); L.block(TX + 5, 6, TZ + 3.25, 1, 5, 2.5, TW);
    L.block(TX - 2.7, 11, TZ, 4.6, 0.6, 11, { color: NAVY, side: NAVY_S }); L.block(TX + 2.7, 11, TZ, 4.6, 0.6, 11, { color: NAVY, side: NAVY_S });
    const sh = add(TX + 5, 8.5, TZ, 0.6, 5, 4, NAVY);
    machine((n) => [0, 1, 2, 3, 3, 3, 3, 2, 1, 0, 0, 0][n % 12], (v) => st.M[sh].set(TX + 5, 8.5 + v * 1.07, TZ));
    L.block(TX, 6, TZ, 1.6, 2, 1.6, { color: STONE, side: NAVY });
    L.mesh(place(paint(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 10).rotateX(Math.PI / 2 - 0.5), BRASS), TX, 8.9, TZ));
    L.mesh(place(paint(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8).rotateZ(Math.PI / 2), NAVY_S), TX, 8.9, TZ));
    L.secret('qsl', 'qsl', TX, 9.2, TZ + 0.8);
    L.glow(TX, 10.4, TZ, 0xffd8a0, 4, { opacity: 0.6 });

    // ---- the escapement stair (west): alternate steps rise on alternate pips — step across each time
    for (let i = 0; i < 8; i++) {
      const up = 7.5 + i * 1.5, x = -29.5 + i * 2;
      const k = add(x, up - (up - 4.5) / 2, -22.5, 2, up - 4.5, 2, i % 2 ? STONE : 0xa8a092);
      machine((n) => ((n + i) % 2 ? 0 : 1), (v) => st.M[k].set(x, up - 1.5 + v * 1.5 - (up - 4.5) / 2, -22.5));
    }

    // ---- the clock terrace
    L.plat(0, 18, -34, 28, 20, { t: 22, color: STONE, side: NAVY });
    L.checkpoint(9, 18, -28, { depth: 3 });
    // the shortcut lift down to the first terrace: parked at the top until its catch is released
    st.lever = null;
    const sl = add(-6, 18, -22.4, 3, 0.5, 3);
    machine((n) => (st.lever === null ? 8 : ping(n - st.lever + 8, 8)), (v) => st.M[sl].set(-6, 6 + v * 1.5 - 0.25, -22.4));
    L.block(-6, 18, -26.2, 1.4, 0.15, 1.4, { color: BRASS });
    L.trigger(-6, 18, -26.2, 1.4, 1.2, 1.4, { once: true, enter: () => { st.lever = st.ticks; audio.bell(0, 0, 0.12); audio.thud(); } });

    // ---- the great clock: ride its hands. Minute hand: one notch (7.5°) a pip; hour hand: one per twelve.
    const CY = 27, CZ = -46;
    L.block(0, 18, -50, 22, 17, 8, { color: BONE, side: NAVY });
    L.mesh(place(paint(new THREE.CircleGeometry(8.9, 48), 0xd8ccb0), 0, CY, CZ + 0.04), { glow: true });
    L.mesh(place(paint(new THREE.TorusGeometry(8.95, 0.28, 6, 48), BRASS), 0, CY, CZ + 0.1));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r0 = i % 3 ? 7.6 : 7.0;
      L.mesh(beam([Math.sin(a) * r0, CY + Math.cos(a) * r0, CZ + 0.12], [Math.sin(a) * 8.4, CY + Math.cos(a) * 8.4, CZ + 0.12], i % 3 ? 0.18 : 0.32, NAVY_S));
    }
    L.mesh(place(cylinder(0.6, 0.6, 1.4, 16, BRASS).rotateX(Math.PI / 2), 0, CY, CZ));
    const handBar = (len, w, z, c) => {
      const m = L.dyn(chamferBox(w, len, 0.16, 0.05, c, c));
      m.geometry.translate(0, len / 2 - 0.6, 0); m.position.set(0, CY, z); return m;
    };
    st.minBar = handBar(8.9, 0.36, -44.75, NAVY_S); st.hourBar = handBar(7.6, 0.5, -45.5, NAVY_S);
    const minute = [2.4, 4.4, 6.4, 8.2].map((r) => ({ r, k: add(0, CY, -43.9, 1.3, 0.5, 1.2, BRASS) }));
    const hour = [2.2, 3.9, 5.5, 6.9].map((r) => ({ r, k: add(0, CY, -45.0, 1.2, 0.5, 0.8, 0xc89a48) }));
    const handPose = (blocks, th) => { for (const b of blocks) st.M[b.k].set(Math.sin(th) * b.r, CY + Math.cos(th) * b.r, st.M[b.k].pos.z); };
    machine((n) => n, (v) => { st.minA = Math.PI * 1.3 + v * (Math.PI / 24); handPose(minute, st.minA); });
    machine((n) => Math.floor(n / 12), (v) => { st.hourA = -Math.PI / 3 + v * (Math.PI / 24); handPose(hour, st.hourA); });
    st.hourTip = 6.9;
    st.cuckoo = L.secret('stray', 'stray', 0, CY, -45, { stray: 'cuckoo', radius: 2.2, name: 'The Cuckoo', line: 'It lived in a clock that was always slightly fast, and has been apologising for it ever since. It rides the hour hand to keep an eye on the time.' });

    // the west stair to the nine o'clock ledge
    for (const [x, top, z] of [[-12, 19.6, -30], [-12.6, 21.2, -33], [-13.2, 22.8, -36], [-13.2, 24.4, -39], [-13.2, 26, -41.6]]) L.block(x, 18, z, 2.2, top - 18, 2.2, { color: STONE, side: NAVY });
    L.block(-12.8, 18, -44.2, 4, 9, 3.6, { color: STONE, side: NAVY });

    // the tower roof
    L.checkpoint(5, 35, -50, { depth: 4 });
    for (const s of [-1, 1]) L.block(s * 10.4, 35, -50, 1.2, 1.4, 8, { color: BONE, side: NAVY });

    // ---- the chronometer room: stopped. No pips reach in here; each echo is a tick.
    const W = { color: 0x8a8478, side: NAVY_S };
    L.plat(0, 35, -64.5, 22, 21, { t: 39, color: 0x6a5e50, side: NAVY });
    // open to the sky (walls too tall to echo over), so the camera can look down into it
    L.block(-6, 35, -56.5, 9, 15.5, 1, W); L.block(6, 35, -56.5, 9, 15.5, 1, W); L.block(0, 38.2, -56.5, 3, 12.3, 1, W);
    L.block(-1.5, 35, -74.5, 17, 15.5, 1, W); L.block(9.5, 35, -74.5, 1, 15.5, 1, W); L.block(8, 35, -74.5, 2, 10, 1, W); L.block(8, 48, -74.5, 2, 2.5, 1, W);
    L.block(-9.5, 35, -65.5, 1, 15.5, 17, W); L.block(9.5, 35, -65.5, 1, 15.5, 17, W);
    L.camZone(0, 35, -65.5, 18, 15.5, 17.4, { dist: 13, pitch: 1.2, height: 0.6 });
    L.block(-6, 35, -70, 6, 10, 8, { color: 0x9a9080, side: NAVY_S });
    L.block(8, 35, -71, 2, 10, 6, { color: 0x9a9080, side: NAVY_S });
    L.checkpoint(3, 35, -60, { depth: 5 });
    L.light(0, 44, -64, 0xffd8a0, 16, 24);
    const rl = add(-6, 35.2, -63.5, 3, 0.4, 3);
    machine((n) => ping(n, 5), (v) => st.M[rl].set(-6, 35.2 + v * 2, -63.5), { room: true });
    const br = add(-1.75, 44.75, -71, 2.5, 0.5, 2.5, BONE);
    machine((n) => ping(n, 3), (v) => st.M[br].set(-1.75 + v * 2.5, 44.75, -71), { room: true });
    // the stopped regulator on the east wall, its pendulum moved only by echoes
    L.mesh(place(paint(new THREE.CircleGeometry(2.4, 32), 0xd8ccb0), 8.95, 43, -63, -Math.PI / 2), { glow: true });
    L.mesh(place(paint(new THREE.TorusGeometry(2.45, 0.15, 6, 32), BRASS), 8.9, 43, -63, -Math.PI / 2));
    L.mesh(beam([8.85, 43, -63], [8.85, 44.9, -63.4], 0.14, NAVY_S)); L.mesh(beam([8.85, 43, -63], [8.85, 41.8, -61.9], 0.18, NAVY_S));
    st.pend = new THREE.Group(); L.root.add(st.pend); st.pend.position.set(8.7, 40.4, -63);
    st.pend.add(new THREE.Mesh(paint(new THREE.CylinderGeometry(0.05, 0.05, 5, 6).translate(0, -2.5, 0), BRASS), L.mat));
    st.pend.add(new THREE.Mesh(paint(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 18).rotateZ(Math.PI / 2).translate(0, -4.6, 0), BRASS), L.mat));
    machine((n) => n, (v) => { st.pendA = Math.sin(v * Math.PI / 2) * 0.35; }, { room: true });
    for (const [z, y, r] of [[-60, 46, 1.6], [-58.6, 44.2, 0.9], [-68, 39, 2.2]]) L.mesh(place(paint(new THREE.TorusGeometry(r, 0.18, 6, 14), BRASS), -8.9, y, z, Math.PI / 2));
    L.trigger(0, 35, -65.5, 18, 15.5, 17.4, {
      enter: (gg) => { st.stopped = true; this.roomMusic(st, true); },
      exit: (gg) => { st.stopped = false; this.roomMusic(st, false); audio.pip(true, 0.08); audio.bell(0, 1, 0.1); gg.fx.shake(0.15); },
    });

    // ---- the summit
    L.plat(10, 45, -95, 50, 40, { t: 49, color: STONE, side: NAVY });
    L.checkpoint(8, 45, -78, { depth: 6 });

    // the meridian: one bright line through everything, out to the horizon
    for (const [y, z0, z1] of [[0, 55, 5], [6, 5, -24], [18, -24, -46], [35, -46, -56], [35, -57, -74], [45, -75, -115], [44.9, -115, -900]]) {
      L.block(0, y + 0.01, (z0 + z1) / 2, 0.22, 0.05, Math.abs(z1 - z0), { color: 0xffe6b0, glow: true, solid: false, bevel: 0.01 });
    }

    // the great telescope on the meridian; from its platform the camera looks along the line
    L.block(0, 45, -86.6, 2.6, 1.6, 2, { color: STONE, side: NAVY }); L.block(0, 45, -88.4, 2.6, 3.2, 1.6, { color: STONE, side: NAVY });
    L.plat(0, 49, -92, 7, 5, { t: 4, color: BONE, side: NAVY });
    L.mesh(place(paint(new THREE.CylinderGeometry(0.9, 1.25, 16, 18).rotateX(-Math.PI / 2 + 0.42).translate(0, 3.2, -6.5), (x, y, z) => col(z < -12 ? BRASS : z > -2 ? NAVY_S : 0x2c3a5a)), 0, 49, -92));
    L.mesh(place(cylinder(0.5, 0.8, 2.6, 10, NAVY), 0, 49, -92.8));
    L.camZone(0, 49, -92, 7, 4, 5, { pos: [0, 54, -86], look: [0, 40, -260] });
    L.trigger(0, 49, -92, 7, 3, 5, { once: true, enter: (gg) => gg.rig.playShot({ dur: 7, blendIn: 1.4, blendOut: 1.8, fov: 58, path: (k, out) => out.set(8 - k * 8, 58 + k * 26, -100 - k * 34), look: [0, 14, -10] }) });

    // the time-ball mast. The red ball climbs a notch a pip, waits for the hour, and drops.
    const MX = 22, MZ = -96;
    L.pillar(MX, 45, MZ, 0.5, 23, { color: NAVY, seg: 10 });
    for (const s of [-1, 1]) L.mesh(beam([MX + s * 4, 45, MZ - 3], [MX, 66, MZ], 0.16, NAVY_S));
    L.block(MX, 45, -91.2, 2.2, 1.4, 1.6, { color: STONE, side: NAVY });
    L.plat(MX, 59.4, -96.9, 5, 4.2, { t: 0.5, color: BONE });
    for (const s of [-1, 1]) L.mesh(beam([MX + s * 2.4, 59.4, -98.9], [MX + s * 2.4, 60.4, -98.9], 0.08, BRASS));
    L.mesh(beam([MX - 2.4, 60.4, -98.9], [MX + 2.4, 60.4, -98.9], 0.08, BRASS));
    st.ball = L.mover(MX, 46.3, -93.6, 2.2, 2.6, 2.2, { geometry: paint(new THREE.SphereGeometry(1.3, 24, 14), RED), material: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x501008 }), tag: 'machine' });
    st.ballGlow = L.glow(MX, 46.3, -93.6, 0xff4030, 10, { opacity: 0.7 });
    const BALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 10, 0, 0];
    machine((n) => BALL[n % BALL.length], (v) => { st.ball.set(MX, 46.3 + v * 1.2, -93.6); st.ballGlow.position.set(MX, 46.3 + v * 1.2, -93.6); }, { ease: 0.3 });
    L.ident(MX - 1.5, 60.7, -96.4);

    // the time-ball cable, from its anchor to the masthead (Line)
    L.block(31.5, 45, -84.6, 1.4, 1.8, 1.4, { color: NAVY, side: NAVY_S });
    const c0 = new THREE.Vector3(31, 47.2, -85), c1 = new THREE.Vector3(MX + 0.6, 68.6, MZ);
    L.wire([c0.toArray(), c1.toArray()], { sag: 0.01, radius: 0.05, color: 0x8a8070, oneWay: 1 });
    const hp = c0.clone().lerp(c1, 1 - 1.6 / c0.distanceTo(c1));
    L.secret('harmonic', 'harmonic', hp.x, hp.y - 0.6, hp.z);

    // the clock face holds the camera while you ride its hands
    L.camZone(0, 18, -40, 22, 20, 8, { yaw: 0, dist: 13, pitch: 0.12 });
    // a small dome on the summit, and warm lamps along the way
    L.pillar(-8, 45, -102, 3.2, 2.2, { color: BONE, seg: 20 });
    L.mesh(place(paint(new THREE.SphereGeometry(3.2, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), (x, y, z) => col(Math.abs(x) < 0.3 ? NAVY_S : 0xc8c4bc)), -8, 47.2, -102));
    const lamps = [[-5, 0, 34], [5, 0, 20], [-6, 6, -4], [10, 6, -16], [-9, 18, -27], [11, 18, -40], [-6, 45, -80], [14, 45, -88]];
    L.instanced(cylinder(0.06, 0.08, 2.6, 6, NAVY_S), lamps.map(([x, y, z]) => [x, y, z, 0, 1]));
    for (const [x, y, z] of lamps) L.glow(x, y + 2.7, z, 0xffd090, 2.4, { opacity: 0.85 });

    st.M = L.moverSet(items, { tag: 'machine' });
    for (const m of st.machines.concat(st.room)) m.pose(m.v);
    return st;
  },

  // In the chronometer room the beat drops out of the music: no ticks, no pips, only the held chord.
  roomMusic(st, on) {
    const tr = music.main;
    if (!tr || tr.def !== this.music) return;
    for (const l of tr.layers) if (['tick', 'pips', 'bass', 'counter'].includes(l.name)) l.g.gain.setTargetAtTime(on || !l.on ? 0.0001 : l.gain ?? 0.8, audio.t, 0.25);
  },

  onCheckpoint(st) { if (st.stopped) this.roomMusic(st, true); },

  onComplete(st, g) { st.stopped = true; },

  tick(st, g) {
    st.ticks++;
    for (const m of st.machines) { m.pv = m.v; m.v = m.f(st.ticks); m.tT = st.t; }
    audio.pip(false, 0.025);
  },

  // Pip is a tick: in the chronometer room each echo steps the machinery.
  onEcho(st, e, g) {
    if (!st.stopped) return;
    st.rc++;
    for (const m of st.room) { m.pv = m.v; m.v = m.f(st.rc); m.tT = st.t; }
    audio.pip(true, 0.06); audio.tick(true);
  },

  fixed(st, dt, g) {
    st.t += dt;
    const live = audio.ctx && audio.ctx.state === 'running' && music.main && music.main.def === this.music;
    const b = live ? Math.floor(music.beat()) : Math.floor(st.t);
    if (b !== st.lastB) { const first = st.lastB === null; st.lastB = b; if (!first && !st.stopped) this.tick(st, g); }
    for (const m of st.machines.concat(st.room)) m.pose(m.pv + (m.v - m.pv) * smooth(0, m.ease, st.t - m.tT));
    // the cuckoo rides the hour hand's tip
    const c = st.cuckoo, top = 27 + Math.cos(st.hourA) * st.hourTip + 0.25;
    c.x = Math.sin(st.hourA) * st.hourTip; c.y = top + 0.4; c.z = -45;
    c.mesh.position.set(c.x, top, c.z);
  },

  update(st, dt, g) {
    st.minBar.rotation.z = -st.minA; st.hourBar.rotation.z = -st.hourA;
    st.pend.rotation.x = st.pendA;
    for (const a of st.arms) {
      const d = a.pivot.distanceTo(a.end);
      a.tube.position.copy(a.pivot); a.tube.lookAt(a.end); a.tube.scale.set(1, 1, d + 1.2);
    }
  },
};
