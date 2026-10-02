import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chamferBox, cylinder, place, paint, col, shade, rock, beam } from '../geometry.js';

// Pieces of Which Summer: the fragment system (a remembered thing flies into place when Pip
// pays attention to it), the anamorphic shards, and the lake house's set dressing.

let seed = 11;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const ease = (k) => 1 - Math.pow(1 - k, 3);

// Groups decide when their pieces want to be whole:
//   near   — Pip within R (horizontal) of the piece
//   faint  — Pip practically on it (a faded memory); only an echo brings it back properly
//   shy    — Pip further than R from gr.ref: it falls apart as you approach and returns as you back away
//   always — once active, whole for good
// Any piece within ER of a live echo is held whole: echoes remember.
export const ER = 6;
export class Fragments {
  constructor() { this.items = []; this.pieces = []; }

  group(o) { return { mode: 'near', R: 6, Ry: 9, inR: 2.4, outR: 0.9, spread: [5, 3, 5], active: () => true, ...o }; }

  add(gr, x, y, z, w, h, d, color, o = {}) {
    const [sx, sy, sz] = o.spread ?? gr.spread;
    const a = rnd() * Math.PI * 2, r = 0.45 + rnd() * 0.55;
    const p = {
      gr, home: [x, y, z], k: o.k ?? 0, ph: rnd() * 6.28,
      off: [Math.cos(a) * sx * r, (rnd() * 1.4 - 0.4) * sy, Math.sin(a) * sz * r],
      ry0: (rnd() - 0.5) * 3, rx0: (rnd() - 0.5) * 1.6, hrx: o.rx ?? 0,
    };
    if (o.away) p.off[2] = Math.abs(p.off[2]) * o.away;
    this.items.push({ x, y, z, w, h, d, color, solid: o.solid });
    this.pieces.push(p);
    return p;
  }

  finish(L) {
    const mvs = L.moverSet(this.items, { bevel: 0.06 });
    this.pieces.forEach((p, i) => { p.mv = mvs[i]; });
    this.mesh = mvs.mesh;
  }

  update(dt, t, P, echoes) {
    for (const p of this.pieces) {
      const gr = p.gr, [hx, hy, hz] = p.home;
      let want = 0, fast = false;
      if (gr.active()) {
        const dP = Math.hypot(P.x - hx, P.z - hz), dy = P.y - hy;
        if (gr.mode === 'near') want = dP < gr.R && Math.abs(dy) < gr.Ry;
        else if (gr.mode === 'faint') want = p.k > 0.5 && dP < gr.R && dy > -0.6 && dy < 2.5; // Pip can hold it, not bring it back
        else if (gr.mode === 'shy') want = Math.hypot(P.x - gr.ref[0], P.z - gr.ref[2]) > gr.R;
        else want = true;
        for (const e of echoes) if (!e.dead && Math.hypot(e.x - hx, e.z - hz) < ER && Math.abs(e.y - hy) < 7) { want = true; fast = true; }
      }
      want = want ? 1 : 0;
      const rate = want > p.k ? (fast ? 3.5 : gr.inR) : gr.outR;
      p.k += Math.max(-rate * dt, Math.min(rate * dt, want - p.k));
      const mv = p.mv, whole = p.k > 0.9;
      if (whole) mv.set(hx, hy, hz, 0, p.hrx);
      else {
        const e = 1 - ease(p.k), s = t * 0.5 + p.ph;
        mv.set(hx + (p.off[0] + Math.sin(s) * 0.5) * e, hy + (p.off[1] + Math.sin(s * 1.3) * 0.35) * e, hz + (p.off[2] + Math.cos(s * 0.9) * 0.5) * e, p.ry0 * e + Math.sin(s) * 0.2 * e, p.rx0 * e + p.hrx * (1 - e));
      }
      if (mv.col) mv.col.enabled = whole;
    }
  }
}

// The anamorphic image: from one spot on the jetty, shards hung over the lake line up into
// two people dancing in a kitchen window. Each shard sits on a ray from the eye through a
// point of the silhouette, at a random depth, scaled so they all look the same size.
function inside(u, v) {
  const ell = (cx, cy, rx, ry) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 < 1;
  const cap = (ax, ay, bx, by, r) => {
    const dx = bx - ax, dy = by - ay, k = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(u - ax - dx * k, v - ay - dy * k) < r;
  };
  // him: upright, arm raised to hold her hand, the other round her waist
  if (ell(-1.75, 2.75, 0.5, 0.58) || ell(-1.8, 0.95, 0.7, 1.35) || cap(-2.0, -0.3, -2.4, -3.7, 0.28) || cap(-1.55, -0.3, -1.1, -3.7, 0.28)) return true;
  if (cap(-1.35, 1.75, 0.05, 3.55, 0.19) || cap(-1.25, 0.8, 0.9, 0.5, 0.18)) return true;
  // her: leaning back, skirt flaring mid-turn
  if (ell(2.05, 2.35, 0.46, 0.52) || ell(1.75, 0.85, 0.56, 1.05) || cap(1.45, 1.55, 0.05, 3.55, 0.17) || cap(1.35, 1.3, -0.95, 1.7, 0.17)) return true;
  if (v < -0.1 && v > -2.8) { const k = (-0.1 - v) / 2.7, l = 1.2 - k * 1.1, r = 2.35 + k * 1.6 + Math.sin(k * 3) * 0.3; if (u > l && u < r) return true; }
  if (cap(1.45, -2.7, 1.4, -3.7, 0.16) || cap(2.2, -2.7, 2.65, -3.6, 0.16)) return true;
  return false;
}

export function dancerShards(L, eye, look, color) {
  const E = new THREE.Vector3(...eye), fwd = new THREE.Vector3(...look).sub(E).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd);
  const D = 22, pts = [];
  while (pts.length < 780) { const u = rnd() * 7.4 - 3.4, v = rnd() * 7.8 - 4; if (inside(u, v)) pts.push([u, v]); }
  // the window frame and sill around them
  for (let i = 0; i < 150; i++) {
    const s = rnd() * 4, k = rnd();
    pts.push(s < 1 ? [-5 + k * 10, 5] : s < 2 ? [-5 + k * 10, -4.6] : s < 3 ? [-5, -4.6 + k * 9.6] : [5, -4.6 + k * 9.6]);
  }
  for (let i = 0; i < 30; i++) pts.push([-5.6 + rnd() * 11.2, -5.1]);
  // thin plates turned to face the eye: whole from the jetty, edge-on slivers from anywhere else
  const T = [], dir = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [u, v] of pts) {
    dir.copy(fwd).multiplyScalar(D).addScaledVector(right, u).addScaledVector(up, v).normalize();
    let t = 9 + rnd() * 30;
    if (E.y + dir.y * t < -2.2) t = (E.y + 2.2) / -dir.y;
    p.copy(E).addScaledVector(dir, t);
    const s = 0.27 * (t / D) * (0.8 + rnd() * 0.4);
    T.push([p.x, p.y, p.z, Math.atan2(-dir.x, -dir.z), [s, s, s * 0.18], color, Math.asin(dir.y)]);
  }
  return L.instanced(chamferBox(1, 1, 1, 0.12, 0xffffff, 0xd8d0d8), T, { material: L.world.glowMat });
}

// ---- set dressing ----
const BARK = 0xa88a8c, LEAF = 0x6e8a82, LEAF2 = 0x9aa08a, WOODC = 0xc8987a;

// The big tree on the west shore, its tree house, and the plank spiral that climbs it.
export function tree(L, F, x, z) {
  L.pillar(x, 1, z, 0.95, 14, { color: BARK, rTop: 0.6, seg: 10 });
  for (const [a, y, l] of [[0.6, 7, 4], [2.4, 9.5, 3.6], [4.1, 12, 3.2], [5.3, 6, 3]]) {
    L.mesh(beam([x, y, z], [x + Math.cos(a) * l, y + 2.2, z + Math.sin(a) * l], 0.32, BARK));
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = i ? 2.2 + (i % 3) * 1.1 : 0, y = 14.5 + (i % 4) * 0.9 - (i ? 1 : -1.2);
    L.mesh(place(rock(2.6 + (i % 3) * 0.6, 1, i * 1.7, i % 2 ? LEAF : LEAF2, 0.72), x + Math.cos(a) * r, y, z + Math.sin(a) * r));
  }
  // the tree house: a deck round the trunk, rails on three sides, a roof, open to the north
  L.plat(x, 10.2, z, 5, 5, { t: 0.35, color: WOODC });
  L.block(x, 10.2, z + 2.4, 5, 0.7, 0.2, { color: 0xb48a74 });
  L.block(x + 2.4, 10.2, z, 0.2, 0.7, 5, { color: 0xb48a74 });
  L.block(x - 2.4, 10.2, z, 0.2, 0.7, 5, { color: 0xb48a74 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.pillar(x + sx * 2.3, 10.2, z + sz * 2.3, 0.08, 2.5, { color: 0xb48a74, seg: 5, solid: false });
  for (const s of [-1, 1]) L.mesh(place(chamferBox(5.8, 0.2, 3.2, 0.06, 0xa87088, 0x7a5068), x, 13.2, z + s * 1.35, 0, s * 0.45));
  const spiral = F.group({ R: 5, spread: [3, 2, 3] });
  for (let i = 0; i < 7; i++) {
    const a = 1.3 + i * 0.6;
    F.add(spiral, x + Math.cos(a) * 4.6, 2.15 + i * 1.3, z + Math.sin(a) * 4.6, 1.5, 0.3, 1.5, i % 2 ? WOODC : 0xd8aa8a);
  }
}

// The boathouse on the east shore: a slipway up out of the lake, crates, a loft.
export function boathouse(L) {
  L.ramp(33, -4.5, -25.5, 4, 5, 5.5, '+x', { color: 0xb08a74 });
  const plank = 0xd8aa8a;
  for (const z of [-29.6, -21.4]) L.block(35.5, -4, z, 9, 9.4, 0.4, { color: plank });
  L.block(39.8, 1, -27.9, 0.4, 4.4, 3.0, { color: plank });
  L.block(39.8, 1, -23, 0.4, 4.4, 2.8, { color: plank });
  L.block(39.8, 3.6, -25.45, 0.4, 1.8, 2.1, { color: plank });
  L.block(31.2, 4.2, -25.5, 0.4, 1.2, 8.6, { color: plank, solid: false });
  for (const s of [-1, 1]) L.mesh(place(chamferBox(10, 0.25, 5.2, 0.08, 0x9a6a82, 0x6a4a5e), 35.5, 6.5, -25.5 + s * 2.2, 0, s * 0.5));
  L.block(36.5, 1, -26.9, 1.4, 1.2, 1.4, { color: 0xc4a07e });
  L.block(36.4, 1, -28.6, 1.2, 2.4, 1.2, { color: 0xb89470 });
  L.plat(38.7, 4.2, -25.5, 2.2, 7.6, { t: 0.3, color: WOODC });
  L.glow(40.3, 4.2, -25.4, 0xffc070, 2.2, { opacity: 0.85 });
  L.camZone(35.5, -4, -25.5, 8.6, 11, 7.8, { dist: 4.6, pitch: 0.12, yaw: -Math.PI / 2 }); // inside, under the roof, facing the loft
}

// Flowers, reeds, birches, a fence along the lane, lily pads, and the washing line.
export function garden(L, swayMat) {
  const lands = [[-17, 17, 16, 34, 1], [-50, 50, -2, 7, 1], [-50, -35, -44, -2, 1], [35, 50, -44, -2, 1], [-50, 44, -68, -60, 1], [-26, 26, -98, -68, 8]];
  const bloom = mergeGeometries([paint(new THREE.CylinderGeometry(0.01, 0.014, 0.3, 4).translate(0, 0.15, 0), 0x9aa888), paint(new THREE.SphereGeometry(0.11, 6, 4).scale(1, 0.6, 1).translate(0, 0.32, 0), 0xffffff)]);
  const cols = [0xc8a8e8, 0xf0b8a0, 0xfff0e0, 0xe890a8, 0xb8c8f0];
  const T = [];
  for (const [x0, x1, z0, z1, y] of lands) {
    const n = Math.round((x1 - x0) * (z1 - z0) * 0.16);
    let cx = 0, cz = 0, c = 0;
    for (let i = 0; i < n; i++) {
      if (i % 9 === 0) { cx = x0 + 1.5 + rnd() * (x1 - x0 - 3); cz = z0 + 1.5 + rnd() * (z1 - z0 - 3); c = cols[Math.floor(rnd() * cols.length)]; }
      const x = cx + (rnd() - 0.5) * 2.6, z = cz + (rnd() - 0.5) * 2.6;
      if (y === 8 && Math.abs(x) < 9.6 && z < -73.5 && z > -88.5) continue;
      if (Math.abs(x) < 2.5 && z > -2 && z < 34) continue;
      T.push([x, y, z, rnd() * 6, 0.7 + rnd() * 0.6, rnd() < 0.8 ? c : 0xfff0e0]);
    }
  }
  L.instanced(bloom, T, { material: swayMat });
  // reeds where the shore meets the lake
  const reed = paint(new THREE.CylinderGeometry(0.006, 0.02, 1.3, 3).translate(0, 0.65, 0), 0xdcbc94);
  const R = [], edge = (x0, z0, x1, z1, n) => { for (let i = 0; i < n; i++) { const k = rnd(), x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k; for (let j = 0; j < 4; j++) R.push([x + (rnd() - 0.5) * 0.5, 1, z + (rnd() - 0.5) * 0.5, rnd() * 6, 0.6 + rnd() * 0.7, undefined, (rnd() - 0.5) * 0.25]); } };
  edge(-35.6, -43, -35.6, -3, 120); edge(35.6, -20, 35.6, -3, 60); edge(35.6, -43, 35.6, -31, 40);
  edge(-34, -60.6, -4, -60.6, 80); edge(4, -60.6, 34, -60.6, 80); edge(-46, -1.4, -16, -1.4, 70); edge(16, -1.4, 46, -1.4, 70);
  L.instanced(reed, R, { material: swayMat });
  // birches
  for (const [x, z, y, h] of [[-12, 22, 1, 7], [13, 28, 1, 6], [-10, 6, 1, 8], [38, 5, 1, 7], [46, -8, 1, 8], [-20, -64, 1, 7], [20, -90, 8, 7], [-18, -78, 8, 8], [44, -38, 1, 6]]) {
    L.pillar(x, y, z, 0.28, h, { color: 0xeee4ec, rTop: 0.18, seg: 7 });
    for (let i = 0; i < 4; i++) L.mesh(place(rock(1.5 + (i % 2) * 0.5, 1, x + i, i % 2 ? LEAF2 : LEAF, 0.8), x + Math.cos(i * 1.9) * 1.1, y + h - 0.5 + (i % 3) * 0.7, z + Math.sin(i * 1.9) * 1.1));
  }
  // a picket fence either side of the lane
  const P = [];
  for (let z = 17.5; z < 33.5; z += 0.7) for (const x of [-15.5, 15.5]) P.push([x, 1, z, 0, [0.14, 1 + (Math.round(z / 0.7) % 2) * 0.12, 0.08]]);
  L.instanced(chamferBox(1, 1, 1, 0.03, 0xfff4ea, 0xd8c8c8).translate(0, 0.5, 0), P);
  for (const x of [-15.5, 15.5]) L.block(x, 1.55, 25.5, 0.08, 0.12, 16, { color: 0xf4e8e0, solid: false });
  // lily pads by the shore
  const pad = paint(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 10, 1).translate(0, 0, 0), 0x6a9a7a);
  const LP = [];
  for (let i = 0; i < 40; i++) { const s = rnd(), x = s < 0.5 ? -33 + rnd() * 3 : 31 - rnd() * 3, z = -55 + rnd() * 50; LP.push([x, WATER_Y + 0.05, z, rnd() * 6, 0.6 + rnd() * 0.7]); }
  L.instanced(pad, LP);
  // the washing line on the meadow (rideable, if Pip ever learns to ride a line)
  for (const x of [20, 32]) L.pillar(x, 1, 3, 0.09, 3.2, { color: 0xe8dcd4, seg: 6, solid: false });
  L.wire([[20, 4.0, 3], [32, 4.0, 3]], { sag: 0.04, radius: 0.025, color: 0xe8dcd4 });
  const sheets = [];
  for (const [x, c] of [[22.5, 0xfff6ee], [25.5, 0xf0c8d8], [28.6, 0xd8e4f4]]) {
    const m = L.dyn(new THREE.PlaneGeometry(2.2, 1.6, 4, 3).translate(0, -0.8, 0), new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, 3.85, 3); sheets.push(m);
  }
  return sheets;
}
const WATER_Y = -3;
