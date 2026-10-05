import * as THREE from 'three';
import { audio } from '../audio.js';
import { music } from '../music.js';
import { mergeGeometries as mergeAll } from 'three/addons/utils/BufferGeometryUtils.js';
import { place, paint, cylinder, chamferBox, beam } from '../geometry.js';
import * as P from './holdProps.js';

// Please Hold — a phone-in's hold music, settled into a pale country of waiting.
// Subject: an abstract idea made physical (waiting). The world only moves while Pip stands
// still; an echo holds the line for you. Seen from above, the ten plazas are the finger
// holes of a rotary dial.

const R = 40, PR = 5;
const ANG = (k) => ((60 + (k - 1) * 30) * Math.PI) / 180; // k = 1..10, where 10 is the "0"
const HOLE = (k) => [R * Math.cos(ANG(k)), -R * Math.sin(ANG(k))];
const TOP = [0, 0, 0, 8, 8, 8, 8, 3, 3, 5, 6];

const OAT = 0xe2d6c2, LILAC = 0x9a88b4, CYAN = 0x5ff0e6;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cyc = (c, wait0, move, wait1) => (c < wait0 ? 0 : c < wait0 + move ? smooth(wait0, wait0 + move, c) : c < wait0 + move + wait1 ? 1 : 1 - smooth(wait0 + move + wait1, wait0 + 2 * move + wait1, c));

export default {
  id: 'hold',
  name: 'Please Hold',
  freq: '1215 kHz',
  dial: 0.55,
  qsl: '1215 kHz. "Your call is important to us." Every caller ever left on hold is still here, very patiently, and the music has never once reached the end.',
  qslColors: ['#ece4f2', '#3aa8a4', '#3a2e4a'],
  killY: -16,
  echoLife: 6.5,
  palette: { top: OAT, side: LILAC, accent: CYAN, dust: 0xece4f4 },
  env: {
    sky: { top: 0x8e84b0, horizon: 0xeadfce, bottom: 0xcac0d6, aurora1: 0x7ff0e8, aurora2: 0xc8a8ff, aurora: 0.3, stars: 0, clouds: 0.3, cloudColor: 0xf2eaf2, horizonGlow: 0.35 },
    fog: [0xd6cce0, 50, 200],
    hemi: [0xfff4ec, 0x7a6a92, 1.45],
    sun: [0xfff0e0, 0.75, [0.3, 1, 0.5]],
    rim: 0x6fd8d4, low: 0x8a7ca4, lowY: -16, highY: 10, groove: 0.035,
    motes: { color: 0xffffff, count: 120, size: 0.06, opacity: 0.4, drift: [0.05, 0.02, 0.05] },
    echo: 0x9ff8f0,
  },
  music: {
    bpm: 104, root: 60, scale: 'major', steps: 64,
    layers: [
      { name: 'pad', inst: 'pad', gain: 0.6, wave: 'triangle', cutoff: 1400, notes: [[0, [0, 2, 4, 6], 16], [16, [-2, 0, 2, 4], 16], [32, [1, 3, 5, 7], 16], [48, [-3, -1, 1, 3], 16]] },
      { name: 'motif', inst: 'marimba', gain: 0.75, oct: 1, notes: [[0, 2, 3], [3, 4, 3], [6, 6, 2], [8, 5, 4], [12, 4, 4], [16, 2, 3], [19, 0, 3], [22, -2, 2], [24, 0, 8], [32, 3, 3], [35, 5, 3], [38, 7, 2], [40, 6, 4], [44, 5, 4], [48, 4, 3], [51, 3, 3], [54, 1, 2], [56, -1, 8]] },
      { name: 'bass', inst: 'bass', depth: 1, gain: 0.55, oct: -1, notes: [[0, 0, 6], [6, 4, 2], [8, 0, 6], [14, 4, 2], [16, -2, 6], [22, 2, 2], [24, -2, 6], [30, 2, 2], [32, 1, 6], [38, 5, 2], [40, 1, 6], [46, 5, 2], [48, -3, 6], [54, 1, 2], [56, -3, 6], [62, 1, 2]] },
      { name: 'clave', inst: 'brush', depth: 2, gain: 0.8, hits: 'x..x..x...x.x...' },
      { name: 'rim', inst: 'tick', depth: 3, gain: 0.6, hits: '..x...x...x...x.' },
      { name: 'counter', inst: 'musicbox', depth: 4, gain: 0.45, oct: 2, notes: [[10, 4, 2], [26, 2, 2], [42, 5, 2], [58, 3, 2]] },
      { name: 'chime', inst: 'bell', depth: 6, gain: 0.4, oct: 1, notes: [[0, 7, 8], [32, 8, 8], [48, 6, 8]] },
    ],
  },

  build(L, g) {
    const st = { t: 0, flow: 0, mute: -1, wing: false, depthShown: 0 };
    const H = [null]; for (let k = 1; k <= 10; k++) H.push(HOLE(k));
    st.H = H;
    for (let k = 1; k <= 10; k++) P.plaza(L, H[k][0], TOP[k], H[k][1], k % 10);
    P.dialPlate(L, H.slice(1), -22);
    // the dial centre, the column and the Now Serving board on top of it
    P.plaza(L, 0, 3, 0, undefined, 13);
    L.block(0, 3, 0, 5, 17, 5, { color: 0xd8ccd8, side: LILAC });
    st.board = P.board(L, 0, 20, 0);
    L.plat(0, 13, 3.8, 4.2, 2.6, { t: 0.5, color: OAT });
    L.plat(3.45, 13, 3.0, 1.9, 2.6, { t: 0.5, color: OAT });
    L.glow(0, 22.5, 0, CYAN, 26, { opacity: 0.35 });
    L.light(0, 16, 0, 0xbff8f4, 30, 40);
    st.ident = L.ident(0, 26.6, 0);
    st.ident.hidden = true; st.ident.mesh.visible = false;
    L.trigger(0, 25.3, 0, 8.6, 3, 8.6, { once: true, enter: (gg) => this.called(st, gg) });
    // the finger stop after the "0", across the out-of-order gap
    st.stop = [38.1, -17.8];
    P.fingerStop(L, st.stop[0], -1.5, st.stop[1], 0.75);
    L.secret('harmonic', 'harmonic', st.stop[0], -0.4, st.stop[1], { color: 0xbff8f4 });
    const [x1, z1] = H[1];
    // arrive at the front of the waiting room, the camera low so the board towers overhead
    L.spawn(x1 - 0.75, 0.05, z1 + 1.3, Math.atan2(-x1, -z1));
    L.camZone(x1, -0.5, z1, 9, 4, 9, { pitch: -0.08, dist: 6.5 });
    this.ring(L, st);
    this.mechs(L, st);
    st.board.draw(1207, 1215);
    return st;
  },

  // Static furniture of the ring: paths, rooms, cords, checkpoints and secrets.
  ring(L, st) {
    const H = st.H, T = TOP;
    const toward = (k, j, d) => { const [ax, az] = H[k], [bx, bz] = H[j], l = Math.hypot(bx - ax, bz - az); return [ax + ((bx - ax) / l) * d, az + ((bz - az) / l) * d]; };
    const out = (k, d) => [H[k][0] * (1 + d / R), H[k][1] * (1 + d / R)];
    const seats = [], pots = [];

    // 1 — the waiting room you arrive in. Rows of chairs face the board.
    const [x1, z1] = H[1], face = Math.atan2(-x1, -z1);
    const px = Math.cos(face), pz = -Math.sin(face);
    for (const sd of [-1, 1]) for (let r = 0; r < 2; r++) P.chairRow(x1 + px * sd * 3.0 - Math.sin(face) * (r * 1.3 - 0.4), 0, z1 + pz * sd * 3.0 - Math.cos(face) * (r * 1.3 - 0.4), face, 3, seats);
    P.ticketMachine(L, x1 - 1.47, 0, z1 - 3.85, face);
    P.barrier(L, [[x1 - 2.2, z1 + 2.6], [x1 + 0.8, z1 + 3.4], [x1 + 2.6, z1 + 1.8]], 0);
    P.plant(x1 + 3.4, 0, z1 - 2.4, 1, pots);
    // the out-of-order pier toward the finger stop
    const [sx, sz] = st.stop, ux = (sx - x1) / Math.hypot(sx - x1, sz - z1), uz = (sz - z1) / Math.hypot(sx - x1, sz - z1);
    const pierEnd = 12.0;
    P.path(L, x1 + ux * 4.8, z1 + uz * 4.8, 0, x1 + ux * pierEnd, z1 + uz * pierEnd, 0);
    const bx = x1 + ux * (pierEnd + 1.1), bz = z1 + uz * (pierEnd + 1.1);
    P.barrier(L, [[bx - uz * 1.3, bz + ux * 1.3], [bx + uz * 1.3, bz - ux * 1.3]], 0);
    this.sign(L, bx, 1.5, bz, Math.atan2(ux, uz), 'OUT OF ORDER');
    L.wire([[sx - ux * 0.6, 1.3, sz - uz * 0.6], [x1 + ux * 6, 2.2, z1 + uz * 6]], { sag: 0.03, radius: 0.04, color: 0xd8d0e8, oneWay: 1 });
    // the staff room behind the waiting room: its door only opens if you wait
    const [rx, rz] = out(1, 8.6);
    st.room = [rx, rz - 0.2];
    L.plat(rx, 0, rz, 6, 6, { t: 0.8, color: 0xd2c4b4 });
    P.path(L, x1 + 2.2, z1 - 3.8, 0, rx, rz + 3.2, 0, { w: 2.2 });
    L.block(rx - 3.1, 0, rz, 0.4, 3.6, 6.6, { color: 0xd8ccd8 }); L.block(rx + 3.1, 0, rz, 0.4, 3.6, 6.6, { color: 0xd8ccd8 });
    L.block(rx, 0, rz - 3.1, 6, 3.6, 0.4, { color: 0xd8ccd8 });
    L.block(rx - 2.05, 0, rz + 3.1, 1.9, 3.6, 0.4, { color: 0xd8ccd8 }); L.block(rx + 2.05, 0, rz + 3.1, 1.9, 3.6, 0.4, { color: 0xd8ccd8 });
    L.block(rx, 3.0, rz + 3.1, 2.2, 0.6, 0.4, { color: 0xd8ccd8 });
    L.block(rx, 3.6, rz, 6.6, 0.4, 6.6, { color: 0xc8bcd0 });
    L.block(rx, 0, rz - 1.6, 3, 0.9, 1.2, { color: 0x8a7a9a });
    L.secret('stray', 'stray', rx, 1.0, rz - 1.5, { stray: 'engaged', name: 'The Engaged Tone', line: 'It has been trying to get through since before you were born. It is not upset. It will try again in a moment.' });
    L.glow(rx, 2.6, rz - 1.4, CYAN, 3, { opacity: 0.5 });

    // 2 — terraces of chairs, the lift up to 3
    const [x2, z2] = H[2];
    for (let i = 0; i < 3; i++) { L.block(x2 + 0.2, 0, z2 - 1 - i * 1.3, 6.4, 0.4 * (i + 1), 1.3, { color: i % 2 ? OAT : 0xd2c4b4, side: LILAC }); P.chairRow(x2 + 0.2, 0.4 * (i + 1), z2 - 1 - i * 1.3 + 0.2, 0, 6, seats); }
    L.checkpoint(x2 + 1.5, 0, z2 + 2.4, { depth: 1 });
    const m23 = [(H[2][0] + H[3][0]) / 2, (H[2][1] + H[3][1]) / 2];
    st.m23 = m23;
    const a2 = toward(2, 3, 4.6), a3 = toward(3, 2, 4.6), u23 = toward(2, 3, 1).map((v, i) => v - H[2][i]);
    P.path(L, a2[0], a2[1], 0, m23[0] - u23[0] * 3.05, m23[1] - u23[1] * 3.05, 0);
    P.path(L, a3[0], a3[1], 8, m23[0] + u23[0] * 3.05, m23[1] + u23[1] * 3.05, 8);

    // 3, 4, 5 — machines and plants on the high plazas
    L.checkpoint(H[3][0], 8, H[3][1] + 1.5, { depth: 2 });
    P.ticketMachine(L, H[3][0] - 2.5, 8, H[3][1] - 2, 0.6); P.plant(H[3][0] + 2.6, 8, H[3][1] - 2.2, 1.1, pots);
    L.checkpoint(H[4][0] + 1.5, 8, H[4][1] - 1.5, { depth: 3 });
    P.plant(H[4][0] - 2.8, 8, H[4][1] + 1.6, 0.9, pots);
    L.checkpoint(H[5][0] - 1.2, 8, H[5][1] - 2.6, { depth: 4 });
    for (let r = 0; r < 2; r++) P.chairRow(H[5][0] - 2.6 + r * 1.4, 8, H[5][1] + 1.2, Math.PI / 2, 4, seats);

    // 6 — the switchboard, where Line waits; the first cord goes down to 7
    const [x6, z6] = H[6];
    L.checkpoint(x6 + 2.2, 8, z6 - 1.6, { depth: 5 });
    L.block(x6 - 2.6, 8, z6 + 1.0, 1.2, 3.4, 5, { color: 0x6a5c80, side: 0x4a3e5a });
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) L.mesh(place(chamferBox(0.06, 0.16, 0.16, 0.02, CYAN, CYAN), x6 - 1.98, 8.8 + j * 0.7, z6 - 1.0 + i * 0.8), { glow: true });
    L.secret('ability', 'line', x6 - 0.8, 9.2, z6 + 1.0, { ability: 'line', line: 'A call is a signal running down a wire. Jump into any cord or cable and ride it; jump again to let go.' });
    const c6 = toward(6, 7, 1.8), c7 = toward(7, 6, 2.0);
    this.cord(L, [[c6[0], 10.6, c6[1]], [c7[0], 5.2, c7[1]]]);
    L.pillar(c6[0], 8, c6[1], 0.14, 2.9, { color: 0x8a7a9a, seg: 6, solid: false });

    // 7, 8 — where the callback wing begins; a walk round to 8
    { const c = toward(7, 6, -1.4); L.checkpoint(c[0], 3, c[1], { depth: 6 }); }
    const p78 = toward(7, 8, 4.6), p87 = toward(8, 7, 4.6);
    P.path(L, p78[0], p78[1], 3, p87[0], p87[1], 3);
    for (let r = 0; r < 3; r++) P.chairRow(H[8][0], 3, H[8][1] + 0.6 + r * 1.3, Math.PI, 5, seats);
    P.plant(H[8][0] - 3, 3, H[8][1] - 2, 1.2, pots); P.plant(H[8][0] + 3, 3, H[8][1] - 2, 1, pots);

    // 9, 0 — cords round to the "0", and the QSL card
    const c9 = toward(9, 10, 3.2), c0 = toward(10, 9, 2.6);
    this.cord(L, [[c9[0], 7.6, c9[1]], [c0[0], 8.1, c0[1]]]);
    L.pillar(c9[0], 5, c9[1], 0.14, 2.6, { color: 0x8a7a9a, seg: 6, solid: false });
    L.secret('qsl', 'qsl', H[10][0] + 0.5, 7.2, H[10][1] + 0.5);
    this.cord(L, [[-1.0, 15.6, 4.6], [H[10][0] - 2.6, 8.4, H[10][1] - 1.4]]);
    this.cord(L, [[H[10][0] - 0.3, 8.6, H[10][1] + 1.6], [24, 3.4, -10], [x1 + 1.2, 2.1, z1 + 3.0]]);

    P.chairs(L, seats);
    L.instanced(P.plantGeo(), pots, { sway: true });
  },

  // Your number comes up. The camera rises off the board and the level turns out to be a dial.
  called(st, g) {
    st.board.draw(1215, 1215);
    st.done = true;
    audio.bell(0, 1, 0.14); audio.bell(4, 1, 0.1); audio.bell(7, 1, 0.08);
    music.setDepth(8);
    g.player.state = 'frozen';
    const fog = g.scene.fog;
    fog.near = 140; fog.far = 480;
    g.rig.playShot({ dur: 8, blendIn: 1.4, blendOut: 1.6, fov: 56, look: [0, -10, 2], path: (k, out) => out.set(Math.sin(k * 0.8) * 8, 30 + 100 * k * k * (3 - 2 * k), 4 + 16 * k) });
    g.world.after(7.6, () => {
      fog.near = 50; fog.far = 200;
      if (g.player.state === 'frozen') g.player.state = 'play';
      st.ident.hidden = false; st.ident.mesh.visible = true;
      g.fx.burst(0, 26.6, 0, { count: 40, color: CYAN, speed: 5, size: 0.25 });
    });
  },

  // A coiled phone cord you can ride with Line (one way, from first point to last).
  cord(L, pts) {
    const w = L.wire(pts, { sag: 0.03, radius: 0.03, color: 0xc8c0d8, oneWay: 1 });
    P.coil(L, w.pts);
    return w;
  },

  sign(L, x, y, z, ry, text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g2 = c.getContext('2d');
    g2.fillStyle = '#f2ead8'; g2.fillRect(0, 0, 256, 64);
    g2.fillStyle = '#c83a3a'; g2.font = 'bold 34px ui-monospace, Consolas, monospace'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText(text, 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = L.dyn(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry;
  },

  // Everything that waits for you.
  mechs(L, st) {
    const H = st.H;
    const unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const TILE = { w: 2.6, h: 0.6, d: 2.6 };
    // 1 → 2: a gangway that feeds out of the waiting room, farthest tile first
    {
      const u = unit(H[1], H[2]), n = 7, items = [];
      for (let i = 0; i < n; i++) items.push({ x: H[1][0] + u[0] * 3.4, y: -0.33, z: H[1][1] + u[1] * 3.4, ...TILE, color: i % 2 ? P.OAT : 0xd2c4b4 });
      const tiles = L.moverSet(items);
      st.gang = { c: 0, tiles: tiles.map((mv, i) => {
        const j = n - 1 - i, d = 5.6 + j * 1.58 - 3.4;
        return { mv, delay: i * 0.4, d, sx: mv.pos.x, sz: mv.pos.z, ux: u[0], uz: u[1] };
      }) };
    }
    // 2 → 3: a lift with a long patient pause at each end
    {
      const [mx, mz] = st.m23;
      st.lift = { c: 0, mv: L.mover(mx, -0.3, mz, 3.4, 0.6, 3.4, { color: 0xd8ccd8 }), y0: 0, y1: 8 };
      st.piston = L.dyn(cylinder(0.35, 0.35, 1, 10, 0xc8bcd8, 0x8a7ca4));
      st.piston.position.set(mx, -14, mz);
    }
    // 3 → 4: a turnstile whose arms carry you round
    {
      const mx = (H[3][0] + H[4][0]) / 2, mz = (H[3][1] + H[4][1]) / 2, items = [];
      L.pillar(mx, 4, mz, 0.5, 5.6, { color: 0xd8d0e0 });
      L.mesh(place(paint(new THREE.SphereGeometry(0.6, 12, 8), CYAN), mx, 9.7, mz), { glow: true });
      for (let i = 0; i < 4; i++) items.push({ x: mx, y: 7.75, z: mz, w: 2.6, h: 0.5, d: 2.6, color: 0xd8ccd8 });
      const arms = L.dyn(new THREE.BufferGeometry());
      const ag = [];
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; ag.push(beam([0, 0, 0], [Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2], 0.16, 0xc8c0d8)); }
      arms.geometry = mergeAll(ag); arms.position.set(mx, 7.6, mz);
      st.turn = { c: 0, mx, mz, arms, plats: L.moverSet(items) };
    }
    this.mechs2(L, st, unit);
  },

  mechs2(L, st, unit) {
    const H = st.H;
    // a bridge of tiles that rise from below, one after another, while someone waits on the plate
    const rising = (a, at, b, bt) => {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5), items = [];
      for (let i = 0; i <= n; i++) { const f = i / n; items.push({ x: a[0] + (b[0] - a[0]) * f, y: at + (bt - at) * f - 7.3, z: a[1] + (b[1] - a[1]) * f, w: 2.6, h: 0.6, d: 2.6, color: i % 2 ? P.OAT : 0xd2c4b4 }); }
      return { c: 0, tiles: L.moverSet(items).map((mv, i) => { const full = mv.size.slice(); mv.size = [0, 0, 0]; mv.col.enabled = false; return { mv, full, delay: i * 0.45 }; }) };
    };
    const rim = (k, j, d) => { const u = unit(H[k], H[j]); return [H[k][0] + u[0] * d, H[k][1] + u[1] * d]; };
    // 4 → 5: footprints on the floor; stand on them and the bridge comes
    {
      const u = unit(H[4], H[5]);
      st.plate45 = this.plate(L, H[4][0] + u[0] * 2.4 - u[1] * 1.6, 8, H[4][1] + u[1] * 2.4 + u[0] * 1.6);
      st.br45 = rising(rim(4, 5, 5.6), 8, rim(5, 4, 5.6), 8);
    }
    // 5 → 6: footprints and a ferry. Leave the plate and the ferry drifts home; leave an echo on it
    {
      const u = unit(H[5], H[6]), A = rim(5, 6, 6.8), B = rim(6, 5, 6.8);
      st.plate56 = this.plate(L, H[5][0] + u[0] * 2.6 + u[1] * 2.2, 8, H[5][1] + u[1] * 2.6 - u[0] * 2.2);
      st.ferry = { s: 0, d: 1, pause: 2.6, A, B, mv: L.mover(A[0], 7.75, A[1], 3.2, 0.5, 3.2, { color: 0xd8ccd8 }) };
      for (const [D, s] of [[A, -1], [B, 1]]) L.plat(D[0] + u[0] * s * 2.5, 8, D[1] + u[1] * s * 2.5, 3.6, 1.8, { t: 0.6, color: 0xd2c4b4, bevel: 0.06 });
      L.mesh(place(cylinder(0.1, 0.1, 1.1, 6, 0xd8d0e0), A[0] - u[1] * 2.3, 8, A[1] + u[0] * 2.3));
      L.mesh(place(cylinder(0.1, 0.1, 1.1, 6, 0xd8d0e0), B[0] - u[1] * 2.3, 8, B[1] + u[0] * 2.3));
    }
    // the callback wing: 7 → the dial centre, and up the column. These move only while you do.
    {
      const u = unit(H[7], [0, 0]);
      st.spoke = rising([H[7][0] + u[0] * 5.6, H[7][1] + u[1] * 5.6], 3, [u[0] * -14.2, u[1] * -14.2], 3);
      st.spoke.c = 0.95; this.riseTo(st.spoke);
      st.liftB = { c: 0, mv: L.mover(0, 2.95, 6.9, 3.4, 0.6, 3.4, { color: 0xc8e8e4, side: 0x7aa8a8 }), y0: 3.25, y1: 13, x: 0, z: 6.9 };
      st.liftC = { c: 0, mv: L.mover(6.1, 12.95, 3.0, 3.4, 0.6, 3.4, { color: 0xc8e8e4, side: 0x7aa8a8 }), y0: 13.25, y1: 25.4, x: 6.1, z: 3.0 };
      L.checkpoint(-4.5, 3, 7.5, { depth: 7 });
    }
    // the shortcut home: once you reach the centre, a path rises back down to the waiting room
    // (it starts inside the plaza rim and outpaces a running Pip, so it never drops you)
    st.short = rising([H[1][0] * 0.3, H[1][1] * 0.3], 3, [H[1][0] * 0.86, H[1][1] * 0.86], 0);
    st.short.tiles.forEach((t, i) => { t.delay = i * 0.12; });
    st.short.on = false;
    // 8 → 9: another plate, another bridge
    {
      const u = unit(H[8], H[9]);
      st.plate89 = this.plate(L, H[8][0] + u[0] * 2.6 + u[1] * 1.4, 3, H[8][1] + u[1] * 2.6 - u[0] * 1.4);
      st.br89 = rising(rim(8, 9, 5.6), 3, rim(9, 8, 5.6), 5);
    }
    // the staff-room door
    st.door = { c: 0, mv: L.mover(st.room[0], 1.5, st.room[1] + 3.3, 2.2, 3, 0.25, { color: 0x8a7aa4, side: 0x6a5a84 }) };
  },

  riseTo(br) {
    for (const t of br.tiles) {
      const a = smooth(0, 1, (br.c - t.delay) / 0.9), sc = Math.min(1, a * 3);
      t.mv.set(t.mv.home.x, t.mv.home.y + 7.3 * a, t.mv.home.z);
      t.mv.size[0] = t.full[0] * sc; t.mv.size[1] = t.full[1] * sc; t.mv.size[2] = t.full[2] * sc;
      t.mv.col.enabled = a > 0.7;
    }
  },

  // Two cyan footprints on a dark mat.
  plate(L, x, top, z) {
    L.mesh(place(chamferBox(1.9, 0.06, 1.9, 0.02, 0x4a3e5a, 0x4a3e5a), x, top, z));
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g2 = c.getContext('2d'); g2.fillStyle = '#fff';
    for (const sx of [22, 42]) { g2.beginPath(); g2.ellipse(sx, 36, 7, 15, 0, 0, Math.PI * 2); g2.fill(); g2.beginPath(); g2.ellipse(sx, 15, 5, 5, 0, 0, Math.PI * 2); g2.fill(); }
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: CYAN, transparent: true, depthWrite: false, opacity: 0.6, blending: THREE.AdditiveBlending });
    const m = L.dyn(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), mat);
    m.position.set(x, top + 0.08, z);
    return { x, z, top, mat, on: false };
  },

  occupied(pl, g) {
    const P = g.player.pos;
    const me = g.player.body.grounded && Math.abs(P.x - pl.x) < 1.1 && Math.abs(P.z - pl.z) < 1.1 && Math.abs(P.y - pl.top) < 0.6;
    const echo = g.world.echoes.some((e) => Math.abs(e.x - pl.x) < 1.3 && Math.abs(e.z - pl.z) < 1.3 && e.y < pl.top + 1.2 && e.y > pl.top - 0.5);
    pl.on = me || echo;
    return pl.on;
  },

  fixed(st, dt, g) {
    st.t += dt;
    const p = g.player, P = p.pos, w = g.world;
    const echo = w.echoes.length > 0;
    const still = p.state === 'play' && p.body.grounded && p.stillT > 0.12;
    st.wing = Math.hypot(P.x, P.z) < 35 && P.y > -2;
    const moving = (p.state === 'play' || p.state === 'line') && !still;
    const run = echo || (st.wing ? moving : still);
    st.flow += ((run ? 1 : 0) - st.flow) * Math.min(1, dt * 9);
    const k = dt * st.flow;
    if (k <= 0) return;
    // gangway
    const gw = st.gang; gw.c += k;
    for (const t of gw.tiles) { const a = smooth(0, 1, (gw.c - t.delay) * 5 / t.d); t.mv.set(t.sx + t.ux * t.d * a, -0.33, t.sz + t.uz * t.d * a); }
    // lift: wait 2, rise 3, wait 3, fall 3
    const lf = st.lift; lf.c = (lf.c + k) % 11;
    const ly = lf.y0 + (lf.y1 - lf.y0) * (lf.c < 2 ? 0 : lf.c < 5 ? smooth(2, 5, lf.c) : lf.c < 8 ? 1 : 1 - smooth(8, 11, lf.c));
    lf.mv.set(lf.mv.pos.x, ly - 0.3, lf.mv.pos.z);
    st.piston.scale.y = ly + 13.4;
    // turnstile: a quarter turn every 3.5 s
    const tn = st.turn; tn.c += k;
    const a0 = (tn.c / 14) * Math.PI * 2;
    tn.arms.rotation.y = -a0;
    tn.plats.forEach((mv, i) => { const a = a0 + (i * Math.PI) / 2; mv.set(tn.mx + Math.cos(a) * 3.4, 7.75, tn.mz + Math.sin(a) * 3.4); });
    this.fixed2(st, k, g);
  },

  fixed2(st, k, g) {
    const P = g.player.pos;
    const rise = (br, on) => { if (on) { br.c += k; this.riseTo(br); } };
    rise(st.br45, this.occupied(st.plate45, g));
    rise(st.br89, this.occupied(st.plate89, g));
    if (!st.short.on && Math.hypot(P.x, P.z) < 12 && Math.abs(P.y - 3) < 0.6) st.short.on = true;
    rise(st.short, st.short.on);
    // the ferry runs while the plate is held; left alone it drifts home, so nobody is stranded
    const f = st.ferry;
    if (this.occupied(st.plate56, g)) {
      if (f.pause > 0) f.pause -= k;
      else { f.s += (f.d * k) / 2.6; if (f.s >= 1) { f.s = 1; f.d = -1; f.pause = 2.6; } else if (f.s <= 0) { f.s = 0; f.d = 1; f.pause = 2.6; } }
    } else { f.s = Math.max(0, f.s - k / 2.6); f.d = 1; f.pause = 2.6; }
    const e = smooth(0, 1, f.s);
    f.mv.set(f.A[0] + (f.B[0] - f.A[0]) * e, 7.75, f.A[1] + (f.B[1] - f.A[1]) * e);
    // the callback wing
    if (st.wing) rise(st.spoke, true);
    for (const [lf, T] of [[st.liftB, 4], [st.liftC, 5]]) {
      lf.c = (lf.c + k) % (5.5 + 2 * T);
      lf.mv.set(lf.x, lf.y0 + (lf.y1 - lf.y0) * cyc(lf.c, 1.5, T, 4) - 0.3, lf.z);
    }
    // the staff-room door opens for someone who waits beside it
    const d = st.door;
    if (Math.hypot(P.x - st.room[0], P.z - st.room[1] - 3) < 10) d.c += k;
    d.mv.set(d.mv.home.x, 1.5 + 3.1 * smooth(10, 11.5, d.c), d.mv.home.z);
  },

  update(st, dt, g) {
    // the hold music muffles whenever the world is frozen
    const m = st.done ? 0 : Math.round((1 - st.flow) * 20) / 20;
    if (m !== st.mute && g.mode === 'play') { st.mute = m; audio.setMuffle(m * 0.8); }
    for (const pl of [st.plate45, st.plate56, st.plate89]) pl.mat.opacity += ((pl.on ? 1 : 0.45 + 0.15 * Math.sin(st.t * 3)) - pl.mat.opacity) * Math.min(1, dt * 6);
  },

  onCheckpoint(st, cp) { st.board.draw(1207 + Math.max(cp.depth, st.depthShown), 1215); st.depthShown = Math.max(cp.depth, st.depthShown); },
  onComplete() { audio.setMuffle(0); },
};
