import * as THREE from 'three';
import { Heightfield } from '../physics.js';
import { col, mix, rock, cylinder, place, paint, gradient } from '../geometry.js';
import { qslTexture, stray as makeStray } from '../props.js';
import { swayGlowMaterial } from '../materials.js';
import { audio } from '../audio.js';
import { music } from '../music.js';
import { LEVELS, ORDER, UNLOCK, isUnlocked } from './index.js';
import * as P from './hubProps.js';

// Longwave Heath — the hub. Subject: reception. A night heath where people used to listen.

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

const LAKE = { x: -58, z: 8, rx: 24, rz: 20, y: -1.2 };
export function H(x, z) {
  const r0 = Math.hypot(x, z);
  let h = (1.0 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.4) + 0.6 * Math.sin(x * 0.11 + z * 0.07) + 0.35 * Math.sin(z * 0.19 - x * 0.05)) * smooth(6, 14, r0);
  h += 11.5 * smooth(30, 7, r0);
  const rl = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
  const basin = smooth(1.25, 0.55, rl);
  h -= 7 * basin;
  h += 9 * smooth(6, 2.5, Math.hypot(x + 52, z - 4)) * basin;
  h += 8.5 * smooth(17, 5, segDist(x, z, -78, -26, -30, -62));
  h += 21 * smooth(22, 11, Math.hypot(x, (z + 88) * 1.1));
  const rk = Math.hypot(x, z - 64);
  h -= 2.3 * smooth(8.5, 6.5, rk);
  h += 14 * smooth(94, 118, Math.max(Math.abs(x), Math.abs(z)));
  return h;
}

const PATHS = [[0, 58, 16, 46], [16, 46, 24, 42], [16, 46, 8, 32], [8, 32, 0, 10], [16, 46, -26, 20], [-26, 20, -31, 17], [16, 46, 44, 24],
  [24, 42, 36, 18], [36, 18, 47, -6], [47, -6, 58, -40], [0, 10, -20, -20], [-20, -20, -46, -44], [0, 10, 0, -64]];
const pathDist = (x, z) => Math.min(...PATHS.map((p) => segDist(x, z, p[0], p[1], p[2], p[3])));

const ENTR = {
  tide: { door: null, face: 0 },
  wireless: {}, hold: {}, summer: {}, meantime: {}, closedown: {},
};

const QSL_TEXT = 'Longwave Heath, all night, every night. You are listening to the space between stations. It has been listening to you.';

export default {
  id: 'hub',
  name: 'Longwave Heath',
  freq: 'between stations',
  dial: 0.5,
  qsl: QSL_TEXT,
  qslColors: ['#e6dcf0', '#5a3a7a', '#241a30'],
  killY: -30,
  palette: { top: 0x6a5878, side: 0x44384e, accent: 0xffb866, dust: 0xb8a8d8 },
  env: {
    sky: { top: 0x05040c, horizon: 0x2e1c40, bottom: 0x1a1024, aurora1: 0x2affa8, aurora2: 0x6a5cff, aurora3: 0xff7ab0, aurora: 1.6, stars: 1 },
    fog: [0x1e1428, 45, 230],
    hemi: [0x7a90b8, 0x2a1824, 1.15],
    sun: [0x6affc8, 0.55, [-0.3, 1, -0.6]],
    rim: 0x8a5ac0, low: 0x6a6078, lowY: -10, highY: 10, groove: 0.04,
    motes: { color: 0xc8b8ff, count: 160, size: 0.07, opacity: 0.5 },
    echo: 0xffe2b8,
  },
  titleShot: { center: [0, 14, 0], r: 62, h: 18 },
  music: {
    bpm: 64, root: 50, scale: 'dorian', steps: 64,
    layers: [
      { name: 'drone', inst: 'pad', gain: 0.9, cutoff: 650, notes: [[0, [0, 4, 7], 16], [16, [-1, 1, 3], 16], [32, [0, 2, 4], 16], [48, [3, 5, 7], 16]] },
      { name: 'bass', inst: 'bass', gain: 0.45, oct: -1, notes: [[0, 0, 12], [16, -1, 12], [32, 0, 12], [48, 3, 12]] },
      { name: 'bell', inst: 'bell', gain: 0.35, oct: 1, notes: [[4, 4, 4], [20, 2, 4], [36, 4, 4], [44, 7, 4], [52, 5, 8]] },
      { name: 'q_tide', flag: 'tide', inst: 'musicbox', oct: 1, gain: 0.55, notes: [[0, 4, 3], [3, 4, 3], [6, 3, 3], [9, 2, 3], [12, 0, 4]] },
      { name: 'q_wireless', flag: 'wireless', inst: 'pluck', oct: 1, gain: 0.5, notes: [[16, 0, 2], [18, 2, 2], [20, 4, 2], [22, 5, 2], [24, 4, 6]] },
      { name: 'q_hold', flag: 'hold', inst: 'marimba', oct: 1, gain: 0.6, notes: [[32, 2, 2], [34, 4, 2], [36, 6, 2], [38, 4, 2], [40, 3, 6]] },
      { name: 'q_summer', flag: 'summer', inst: 'piano', oct: 1, gain: 0.5, notes: [[48, 0, 4], [52, 4, 2], [54, 7, 2], [56, 6, 4], [60, 4, 4]] },
      { name: 'q_meantime', flag: 'meantime', inst: 'bell', oct: 2, gain: 0.35, notes: [[8, 7, 2], [10, 4, 2], [40, 7, 2], [42, 4, 2]] },
      { name: 'q_closedown', flag: 'closedown', inst: 'organ', gain: 0.6, notes: [[0, 0, 8], [8, 1, 8], [16, -1, 8], [24, 0, 8], [32, 2, 8], [40, 1, 8], [48, 0, 16]] },
    ],
  },

  build(L, g) {
    const s = g.save, st = { strays: [], cards: [], leaks: null, t: 0 };
    const dawn = s.data.finished;
    if (dawn) this.dawn(L);

    // terrain
    const nx = 120, cell = 2, x0 = -120, z0 = -120;
    const hs = new Float32Array((nx + 1) * (nx + 1));
    for (let iz = 0; iz <= nx; iz++) for (let ix = 0; ix <= nx; ix++) hs[iz * (nx + 1) + ix] = H(x0 + ix * cell, z0 + iz * cell);
    const heather = col(0x4a3440), heather2 = col(0x6a4a4a), moss = col(0x3c4a44), rockC = col(0x5e5868), frost = col(0xa8a8c8), pathC = col(0x2a2026), bed = col(0x1a1422);
    const tmp = new THREE.Color();
    L.terrain(new Heightfield(x0, z0, cell, nx, nx, hs), (x, y, z, ny) => {
      const n = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.23) * 2) * Math.cos(z * 0.27);
      tmp.copy(heather).lerp(heather2, n * 0.8).lerp(moss, Math.max(0, Math.sin(x * 0.05 - z * 0.04)) * 0.5);
      if (ny < 0.78) tmp.lerp(rockC, Math.min(1, (0.78 - ny) * 4));
      if (y > 9 && ny > 0.8) tmp.lerp(frost, Math.min(0.5, (y - 9) * 0.05));
      const pd = pathDist(x, z);
      if (pd < 1.8) tmp.lerp(pathC, (1 - pd / 1.8) * 0.85);
      if (y < LAKE.y + 0.3) tmp.lerp(bed, 0.8);
      return tmp;
    });
    L.hazard(LAKE.x, LAKE.y, LAKE.z, LAKE.rx * 2.6, LAKE.rz * 2.6, { a: 0x160f22, b: 0xb0a4d8 });
    L.solid(0, -20, -123, 260, 60, 4); L.solid(0, -20, 123, 260, 60, 4); L.solid(-123, -20, 0, 4, 60, 260); L.solid(123, -20, 0, 4, 60, 260);

    // landing crater: steep sides, stepping stones out to the north
    const cf = H(0, 64);
    L.spawn(0, cf + 0.1, 64, Math.PI);
    L.block(0, cf - 1, 57.2, 2.4, 2.2, 1.8, { color: 0x7a6a88 });
    L.block(0, cf - 1, 55.4, 2.4, 3.2, 1.8, { color: 0x7a6a88 });
    L.prompt(0, cf, 59, 3.5, 'jump');
    L.checkpoint(-2.5, H(-2.5, 52), 52, { depth: 0 });

    // the Listening Hut, its board and the strays that gather at its lamp
    const hx = 16, hz = 50, hy = H(hx, hz);
    const hut = P.hut(L, hx, hy, hz);
    L.pillar(11, H(11, 56) - 0.5, 56, 0.12, 3.6, { color: 0x4a4050, seg: 6 });
    L.glow(11, H(11, 56) + 3.2, 56, 0xffc070, 3.5, { opacity: 0.9 });
    this.buildBoard(L, st, hut.board, s);
    this.buildStrays(L, st, s, 11, H(11, 56), 56);

    // the listening terrace (teaches echo on the way up to the mast)
    const ty = H(8, 30);
    L.block(8, ty - 2, 27.5, 13, 5.8, 5, { color: 0x8a7a98 });
    L.prompt(8, ty, 32, 4, 'echo');
    L.checkpoint(12, ty + 3.8, 27.5, { depth: 1 });

    // the mast
    const by = 12.4;
    L.block(0, by - 3, 0, 11, 3, 11, { color: 0x6e6680 });
    const m = st.mast = P.mast(L, 0, by, 0);
    L.block(0, by, 4.8, 3.2, 2.6, 2.2, { color: 0x5a5268 });
    const idents = s.identCount() + (s.hasIdent('closedown') ? 1 : 0);
    m.lamps.forEach((lp, i) => lp.set(dawn || i < idents && !(g.justCompleted && i === idents - 1) ? 1 : 0));
    const cd = isUnlocked('closedown', s);
    L.block(0, by, 5.95, 1.2, 2, 0.1, { color: cd ? 0xffd8a0 : 0x2c2634, glow: cd, solid: false });
    ENTR.closedown = { door: [0, by, 6.6], open: cd, spawn: [0, by, 9], yaw: 0 };
    const platY = m.platY;
    st.guys = [[21, 13], [-23, 9], [-3, -23]].map(([ax, az]) => {
      const d = Math.hypot(ax, az);
      return P.guy(L, ax, H(ax, az), az, (ax / d) * 3, platY + 1.6, (az / d) * 3);
    });
    L.secret('harmonic', 'harmonic', 1.8, platY + 1, 1.8);
    L.camZone(0, platY - 0.5, 0, 7, 4, 7, { dist: 15, height: 1.5, pitch: 0.42 });
    L.checkpoint(-2.5, by, 8, { depth: 1 });

    // the static lake and its island
    const iy = H(-52, 4);
    L.secret('qsl', 'qsl', -52, iy + 1, 4);
    L.block(-51, iy - 1, 5.5, 1.2, 2, 1.2, { color: 0x8a7a98 });

    // Fair, Becoming Poor: a wreck on the lake shore, radio still on
    const b = P.boat(L, -31, H(-31, 16) - 0.4, 16);
    ENTR.tide = { door: b.door, open: isUnlocked('tide', s), spawn: [-25, 19], yaw: Math.PI / 2 };
    L.checkpoint(-25, H(-25, 21), 21, { depth: 1 });

    // The Wireless: a caravan with a wireless on the table
    const cv = P.caravan(L, 48, H(48, 22), 22);
    ENTR.wireless = { door: cv.door, open: isUnlocked('wireless', s), spawn: [45.8, 28], yaw: 0 };

    // Please Hold: the telegraph road ends at a phone box
    const road = [[24, 42], [30, 30], [36, 18], [42, 6], [47, -6], [51, -18], [55, -30], [58, -38]];
    st.tele = P.telegraph(L, road, H);
    const [px, py, pz] = st.tele.poles[3];
    L.block(px, py - 0.3, pz, 1.3, 0.4, 1.3, { color: 0x5a4a44 });
    L.secret('stray', 'stray', px, py + 0.2, pz, { stray: 'morse', name: 'Morse', line: 'A dot-dash creature that lived on the telegraph wires. It says the same thing over and over: <i>here, here, here</i>.' });
    L.pillar(44.4, H(44.4, 8.6) - 0.2, 8.6, 1.3, 2.9, { color: 0x6a4a3a, seg: 14, fit: 1.4 });
    const hold = isUnlocked('hold', s);
    const pb = P.phoneBox(L, 60, H(60, -44), -44, hold);
    ENTR.hold = { door: pb.door, open: hold, spawn: [59, -40], yaw: 0 };
    st.phoneRing = hold && !s.hasIdent('hold');

    // Which Summer: a car in the lay-by up on the ridge, headlights on
    const summer = isUnlocked('summer', s);
    const carP = P.car(L, -50, H(-50, -46) + 0.1, -46, summer);
    ENTR.summer = { door: carP.door, open: summer, spawn: [-50, -42], yaw: 0 };

    // Mean Time: the observatory on the crag, reached by steps cut into the rock
    const dy = H(0, -88);
    const mt = isUnlocked('meantime', s);
    const dm = P.dome(L, 0, dy, -88, mt);
    ENTR.meantime = { door: dm.door, open: mt, spawn: [0, -80], yaw: 0 };
    this.cragSteps(L);
    L.checkpoint(3, H(3, -60), -60, { depth: 2 });
    L.camZone(0, dy - 2, -86, 26, 12, 22, { dist: 11, pitch: 0.4 });

    // entrances: walking into a receiving thing tunes you in
    for (const id of ORDER) {
      const e = ENTR[id];
      if (!e || !e.door || !e.open || !LEVELS[id]) continue;
      L.trigger(e.door[0], e.door[1], e.door[2], 1.8, 2.8, 1.8, { enter: (gg) => { if (!gg.completing) gg.goto(id); } });
    }

    this.decorate(L);
    st.ENTR = ENTR;
    return st;
  },

  cragSteps(L) {
    let z = -62, x = -3, top = H(x, z) + 1.2;
    for (let i = 0; i < 16; i++) {
      top += i % 5 === 4 ? 0.4 : 1.35;
      let zz = z;
      while (H(x, zz - 0.5) < top - 1.6 && zz > -80) zz -= 0.5;
      const gap = i % 5 === 4 ? 3.4 : 2.3;
      z = zz;
      const base = H(x, z) - 1;
      L.block(x, base, z, 2.4, top - base, 2.4, { color: 0x8a8098, bevel: 0.2 });
      x = x > 0 ? x - gap : x + gap;
      if (Math.abs(x) > 5) x = Math.sign(x) * 5;
      if (top > H(0, -80) + 1) break;
    }
  },

  buildBoard(L, st, pos, s) {
    let i = 0;
    for (const id of ['hub', ...ORDER]) {
      const d = LEVELS[id];
      if (!d || !s.has(id, 'qsl')) { i++; continue; }
      const m = L.dyn(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshBasicMaterial({ map: qslTexture(d) }));
      m.position.set(pos[0] - 1.05 + (i % 4) * 0.7, pos[1] - Math.floor(i / 4) * 0.55 + 0.1, pos[2]);
      m.rotation.z = (i % 3 - 1) * 0.06;
      i++;
    }
  },

  buildStrays(L, st, s, x, y, z) {
    const kinds = { hub: 'morse', tide: 'foghorn', wireless: 'crackle', hold: 'engaged', summer: 'kettle', meantime: 'cuckoo', closedown: 'coda' };
    let i = 0;
    for (const id of ['hub', ...ORDER]) {
      if (!s.has(id, 'stray')) continue;
      const a = i * 0.9 + 0.4, r = 2.6 + (i % 2) * 0.9;
      const m = makeStray(kinds[id]);
      const sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
      m.position.set(sx, H(sx, sz), sz);
      m.rotation.y = Math.atan2(x - sx, z - sz);
      L.root.add(m);
      st.strays.push({ m, kind: kinds[id], next: 3 + i * 2.3 });
      i++;
    }
  },

  decorate(L) {
    // aerial reeds: old telescopic aerials standing in the heath, swaying
    const parts = [];
    for (let k = 0; k < 3; k++) { const c = new THREE.CylinderGeometry(0.022 - k * 0.005, 0.026 - k * 0.005, 0.8, 5); c.translate(0, 0.4 + k * 0.8, 0); parts.push(paint(c, 0xb0a8c4)); }
    const reed = mergeParts(parts);
    const tip = paint(new THREE.SphereGeometry(0.055, 6, 4).translate(0, 2.42, 0), 0xffc890);
    const T = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2600 && T.length < 1500; i++) {
      const x = rnd() * 220 - 110, z = rnd() * 220 - 110, y = H(x, z);
      if (y < LAKE.y + 0.4 || pathDist(x, z) < 2.5 || Math.hypot(x, z) < 8 || Math.hypot(x, z - 64) < 8 || Math.hypot(x - 16, z - 50) < 7 || (Math.abs(x) < 8 && z < -60)) continue;
      T.push([x, y - 0.05, z, rnd() * 6, 0.6 + rnd() * 0.8]);
    }
    L.instanced(reed, T, { sway: true });
    L.instanced(tip, T, { material: swayGlowMaterial(L.world.U) });
    // cooled-sound stones
    const R = [];
    for (let i = 0; i < 90; i++) {
      const x = rnd() * 200 - 100, z = rnd() * 200 - 100, y = H(x, z);
      if (y < LAKE.y || pathDist(x, z) < 3) continue;
      R.push([x, y, z, rnd() * 6, 0.25 + rnd() * 0.35]);
    }
    L.instanced(rock(1, 1, 3, 0x6a5e7a, 0.6), R);
  },

  dawn(L) {
    const e = { ...this.env };
    e.sky = { ...e.sky, top: 0x2a3a6a, horizon: 0xffb8a0, bottom: 0x6a5a78, aurora: 0.35, stars: 0.2, sun: 1, sunDir: [0.2, 0.08, -1], sunColor: 0xffd0a0, horizonGlow: 0.5 };
    e.fog = [0xb89aa8, 50, 260];
    e.hemi = [0xffe0d0, 0x5a4a6a, 1.5];
    e.sun = [0xffd0a8, 1.4, [0.2, 0.5, -1]];
    e.rim = 0xff9a6a;
    L.world.applyEnv(e);
    const u = L.world.sky.material.uniforms, sk = e.sky;
    u.uTop.value.set(sk.top); u.uHorizon.value.set(sk.horizon); u.uBottom.value.set(sk.bottom); u.uAurora.value = sk.aurora;
    u.uStars.value = sk.stars; u.uSun.value = sk.sun; u.uSunDir.value.set(...sk.sunDir).normalize(); u.uSunColor.value.set(sk.sunColor); u.uHorizonGlow.value = sk.horizonGlow;
    L.world.U.uRim.value.set(e.rim);
  },

  spawnFor(st, from) {
    const e = ENTR[from];
    if (!e || !e.spawn) return null;
    const [x, z] = e.spawn.length === 3 ? [e.spawn[0], e.spawn[2]] : e.spawn;
    const y = e.spawn.length === 3 ? e.spawn[1] : H(x, z);
    return { x, y: y + 0.1, z, yaw: e.yaw };
  },

  onArrive(st, opts, g) {
    const s = g.save;
    const u = g.world.sky.material.uniforms, n = s.count('harmonic');
    u.uAuroraBands.value = n; u.uAurora.value = (s.data.finished ? 0.35 : 1.1) + n * 0.08;
    if (opts.from) { const sp = this.spawnFor(st, opts.from); if (sp) { g.player.teleport(sp.x, sp.y, sp.z, sp.yaw); g.rig.setYaw(sp.yaw + Math.PI); g.rig.snap(); } }
    st.flags = Object.keys(s.data.idents);
    st.pendingShot = g.justCompleted && opts.from === g.justCompleted ? g.justCompleted : null;
    g.justCompleted = null;
  },

  intro(st, g) {
    const sp = g.world.spawnPoint;
    g.teleport(sp.x, sp.y + 46, sp.z);
    g.player.facing = Math.PI;
    g.input.enabled = false;
    st.intro = true;
    g.rig.playShot({ dur: 60, blendIn: 0.01, pos: [sp.x + 5, sp.y + 1.6, sp.z + 7], fov: 70 });
  },

  ending(st, g, done) {
    const m = st.mast;
    g.player.state = 'frozen';
    g.rig.playShot({ dur: 9, blendIn: 1.5, blendOut: 1.5, fov: 55, path: (k, out) => out.set(Math.sin(k * 1.4 + 2.2) * 30, 30 + k * 8, Math.cos(k * 1.4 + 2.2) * 30), look: [0, 36, 0] });
    setTimeout(() => g.rig.playShot({ dur: 9, blendIn: 1.5, blendOut: 2, fov: 58, path: (k, out) => out.set(20 - k * 6, 5 + k * 20, 90 - k * 20), look: [0, 10, 0] }), 9000);
    g.ui.ending([
      { text: 'The sixth pip took its place.', wait: 3000 },
      { text: 'And the hour began, exactly on time.', wait: 3400 },
      { text: 'SKYWAVE', cls: 'big', wait: 3600 },
      { text: 'Thank you for listening.', wait: 5000 },
    ], () => { g.player.state = 'play'; g.rig.shot = null; done(); });
    m.beacon.set(1);
  },

  update(st, dt, g) {
    st.t += dt;
    const m = st.mast, t = st.t, s = g.save;
    if (st.flags) { music.setFlags(st.flags); if (audio.ctx) st.flags = null; }
    m.beacon.set(s.data.finished ? 0.8 + 0.2 * Math.sin(t * 2) : Math.sin(t * 2.4) > 0.3 ? 1 : 0.05);
    if (!st.leaks && audio.ctx && audio.ctx.state === 'running' && g.mode !== 'title') {
      st.leaks = [];
      for (const id of ORDER) {
        const e = ENTR[id];
        if (e && e.open && LEVELS[id] && !s.hasIdent(id)) st.leaks.push(music.spatial(LEVELS[id].music, ['motif'], e.door[0], e.door[1] + 1.5, e.door[2], 6));
      }
    }
    if (st.intro && g.player.body.grounded) {
      st.intro = false;
      if (g.rig.shot) g.rig.shot.dur = g.rig.shot.t + 1.2;
      g.input.enabled = true;
      audio.thud(); g.fx.shake(0.6);
      g.ui.levelTitle(this);
    }
    if (st.pendingShot && g.mode === 'play') this.lampShot(st, g);
    if (st.phoneRing && Math.floor(t / 4) !== Math.floor((t - dt) / 4)) {
      const e = ENTR.hold, p = audio.panner(e.door[0], e.door[1] + 2, e.door[2], 5);
      if (p) for (let k = 0; k < 2; k++) { audio.osc({ type: 'sine', f: 800, t0: k * 0.4, dur: 0.3, g: 0.2, dest: p, curve: 'lin' }); audio.osc({ type: 'sine', f: 1000, t0: k * 0.4, dur: 0.3, g: 0.12, dest: p, curve: 'lin' }); }
    }
    for (const sy of st.strays) {
      sy.m.userData.tick(t + sy.next);
      sy.next -= dt;
      if (sy.next < 0) { sy.next = 6 + Math.random() * 8; audio.strayCall(sy.kind, audio.panner(sy.m.position.x, sy.m.position.y + 0.5, sy.m.position.z, 4)); }
    }
  },

  // The moment a lamp on the mast lights, and (if it opens something) where to look next.
  lampShot(st, g) {
    const id = st.pendingShot; st.pendingShot = null;
    const i = g.save.identCount() - 1;
    const lampP = st.mast.lamps[Math.max(0, i)];
    const y = lampP.bulb.position.y;
    g.player.state = 'frozen';
    g.rig.playShot({ dur: 4.2, blendIn: 1.2, blendOut: 1.2, fov: 50, pos: [9, y - 3, 24], look: [0, y, 0] });
    setTimeout(() => { lampP.set(1); audio.bell(0, 1, 0.14); audio.bell(4, 1, 0.1); g.fx.burst(0, y, lampP.bulb.position.z, { count: 40, color: 0xffc070, speed: 5, size: 0.3 }); }, 1700);
    const opened = ORDER.find((k) => UNLOCK[k] === g.save.identCount() && LEVELS[k] && ENTR[k] && ENTR[k].door);
    setTimeout(() => {
      if (opened) {
        const d = ENTR[opened].door;
        g.rig.playShot({ dur: 3.6, blendIn: 1.2, blendOut: 1.2, fov: 55, pos: [d[0] + 8, d[1] + 5, d[2] + 10], look: [d[0], d[1] + 1.5, d[2]] });
        setTimeout(() => { g.player.state = 'play'; }, 3600);
      } else g.player.state = 'play';
    }, 4200);
  },
};

function mergeParts(parts) {
  const pos = [], nor = [], colr = [];
  for (const p of parts) { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); colr.push(...p.attributes.color.array); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return g;
}
