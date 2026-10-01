import * as THREE from 'three';
import { chamferBox, cylinder, place, paint, col, shade, beam, gradient } from '../geometry.js';
import { glowSprite, makeBeamMaterial } from '../materials.js';

// Set pieces of Longwave Heath: the mast, and the six things that receive broadcasts.

const STEEL = 0x6a5f7c, RUST = 0x7a4a3a, CREAM = 0xe8dcc0, WARM = 0xffb866;

export function lamp(L, x, y, z, color = WARM, size = 2.4) {
  const bulb = L.dyn(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0x2a2432 }));
  bulb.position.set(x, y, z);
  const halo = L.glow(x, y, z, color, size, { opacity: 0 });
  const on = new THREE.Color(color), off = new THREE.Color(0x2a2432);
  return { bulb, halo, set(v) { bulb.material.color.copy(off).lerp(on, v); halo.material.opacity = v * 0.9; } };
}

export function mast(L, bx, by, bz) {
  const H = 46, top = by + H, levels = [];
  const hw = (y) => 2.3 - ((y - by) / H) * 1.7;
  for (let i = 0; i <= 8; i++) levels.push(by + (H * i) / 8);
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i], y1 = levels[i + 1], w0 = hw(y0), w1 = hw(y1);
    for (let c = 0; c < 4; c++) {
      const [sx, sz] = C[c], [tx, tz] = C[(c + 1) % 4];
      L.mesh(beam([bx + sx * w0, y0, bz + sz * w0], [bx + sx * w1, y1, bz + sz * w1], 0.26, STEEL));
      L.mesh(beam([bx + sx * w1, y1, bz + sz * w1], [bx + tx * w1, y1, bz + tz * w1], 0.16, STEEL));
      L.mesh(beam([bx + sx * w0, y0, bz + sz * w0], [bx + tx * w1, y1, bz + tz * w1], 0.09, STEEL));
      L.mesh(beam([bx + tx * w0, y0, bz + tz * w0], [bx + sx * w1, y1, bz + sz * w1], 0.09, STEEL));
    }
  }
  L.solid(bx, by, bz, 1.4, H, 1.4);
  for (const [sx, sz] of C) L.solid(bx + sx * 2.15, by, bz + sz * 2.15, 0.45, 5, 0.45);
  // service platform, reached only up the guy-wires
  const platY = by + 14;
  L.plat(bx, platY, bz, 6.6, 6.6, { t: 0.3, color: 0x8a8098 });
  for (const [sx, sz] of C) L.mesh(beam([bx + sx * 3.2, platY, bz + sz * 3.2], [bx + sx * 3.2, platY + 1, bz + sz * 3.2], 0.08, STEEL));
  for (let c = 0; c < 4; c++) {
    const [sx, sz] = C[c], [tx, tz] = C[(c + 1) % 4];
    L.mesh(beam([bx + sx * 3.2, platY + 1, bz + sz * 3.2], [bx + tx * 3.2, platY + 1, bz + tz * 3.2], 0.07, STEEL));
  }
  const lamps = [];
  for (let i = 0; i < 6; i++) {
    const y = by + 7 + i * 6.2 + (i >= 1 ? 2 : 0);
    lamps.push(lamp(L, bx, y, bz + hw(y) + 0.3, WARM, 3.2));
  }
  const beacon = lamp(L, bx, top + 0.4, bz, 0xff3a2a, 5);
  return { lamps, beacon, platY, top };
}

// Guy-wire from a ground anchor up to the platform's edge (rideable with Line).
export function guy(L, ax, ay, az, bx, by, bz) {
  L.block(ax, ay - 1, az, 1.4, 1.8, 1.4, { color: 0x7a7088 });
  return L.wire([[ax, ay + 0.9, az], [bx, by, bz]], { sag: 0.01, radius: 0.05, color: 0x9a90a8, oneWay: 1 });
}

// A side profile extruded across its beam; used for the boat hull.
function hullGeo(len, height, beamW, color) {
  const sh = new THREE.Shape();
  sh.moveTo(-len / 2, height);
  sh.lineTo(len / 2 + 0.6, height + 0.35);
  sh.quadraticCurveTo(len / 2 - 0.2, 0.2, len / 2 - 1.6, 0);
  sh.lineTo(-len / 2 + 0.6, 0);
  sh.quadraticCurveTo(-len / 2, 0.1, -len / 2, height);
  const g = new THREE.ExtrudeGeometry(sh, { depth: beamW, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -beamW / 2);
  return paint(g, gradient(color, shade(color, 0.6), 0, height));
}

export function boat(L, x, y, z) {
  const hull = 0x4a7472, trim = 0xd8c8a8;
  // bow points west, out over the static; the deck is walkable
  L.mesh(place(hullGeo(7.2, 1.8, 2.4, hull), x, y, z, Math.PI));
  L.solid(x, y, z, 7.4, 1.9, 3);
  L.block(x, y + 1.85, z, 7.2, 0.1, 2.9, { color: 0x8a7458, solid: false });
  L.block(x + 2.1, y + 1.9, z, 2.4, 2.1, 2.3, { color: trim, side: 0xa89a80, bevel: 0.18 });
  L.block(x + 2.1, y + 4.0, z, 2.9, 0.25, 2.7, { color: 0x6a4a40 });
  L.block(x + 0.86, y + 1.95, z, 0.08, 1.6, 0.95, { color: WARM, glow: true, solid: false });
  for (const s of [-1, 1]) L.block(x + 2.1, y + 3.1, z + s * 1.16, 1.6, 0.55, 0.06, { color: 0xffd08a, glow: true, solid: false });
  L.mesh(place(cylinder(0.06, 0.08, 4.5, 6, 0x8a8090), x - 1.6, y + 1.9, z));
  L.mesh(beam([x - 1.6, y + 6.2, z], [x + 3.4, y + 4.2, z], 0.03, 0x8a8090));
  L.glow(x + 1.3, y + 2.9, z, WARM, 4.5, { opacity: 0.85 });
  return { door: [x + 0.4, y + 1.9, z] };
}

export function caravan(L, x, y, z) {
  const cream = 0xe6dac0, teal = 0x4e8c88;
  L.block(x, y - 0.6, z, 7.2, 1.4, 2.8, { color: 0x2c2632, solid: false });
  L.block(x, y + 0.6, z, 8, 3.1, 3.4, { color: cream, side: 0xc8bca4, bevel: 0.6 });
  L.block(x, y + 1.35, z, 8.08, 0.38, 3.48, { color: teal, solid: false, bevel: 0.1 });
  for (const s of [-1, 1]) L.block(x + 1.4, y + 2.25, z + s * 1.72, 3.6, 0.75, 0.06, { color: 0xffcf88, glow: true, solid: false });
  // door on the long south side, its window lit
  L.block(x - 2.2, y + 0.65, z + 1.73, 1.0, 2.1, 0.06, { color: 0x8a6a50, solid: false });
  L.block(x - 2.2, y + 1.95, z + 1.77, 0.6, 0.5, 0.04, { color: 0xffd08a, glow: true, solid: false });
  L.block(x - 2.2, y - 0.1, z + 2.3, 1.4, 0.75, 1.0, { color: 0x6a6070 });
  L.glow(x - 2.2, y + 1.6, z + 2.4, WARM, 4, { opacity: 0.7 });
  L.glow(x + 1.4, y + 2.4, z + 2.2, WARM, 4, { opacity: 0.5 });
  L.mesh(beam([x + 2.5, y + 3.6, z], [x + 3.2, y + 7.4, z - 0.6], 0.05, 0xc0b8c8));
  return { door: [x - 2.2, y + 0.6, z + 2.6] };
}

export function phoneBox(L, x, y, z, lit) {
  const red = 0xb8322a;
  L.block(x, y, z, 1.7, 3, 1.7, { color: red, bevel: 0.08 });
  L.block(x, y + 3, z, 1.9, 0.35, 1.9, { color: red });
  L.block(x, y + 3.35, z, 1.2, 0.35, 1.2, { color: red, solid: false });
  const glass = lit ? 0xfff0c0 : 0x3a3442;
  for (const [dx, dz, w, d] of [[0, 0.87, 1.2, 0.05], [0, -0.87, 1.2, 0.05], [0.87, 0, 0.05, 1.2], [-0.87, 0, 0.05, 1.2]]) L.block(x + dx, y + 0.9, z + dz, w, 1.8, d, { color: glass, glow: lit, solid: false });
  L.block(x, y + 2.55, z + 0.9, 1.3, 0.3, 0.06, { color: lit ? 0xfff8e8 : 0x6a6470, glow: true, solid: false });
  if (lit) L.glow(x, y + 1.6, z, 0xfff0c0, 5, { opacity: 0.8 });
  return { door: [x, y, z + 1.3] };
}

export function car(L, x, y, z, lit) {
  const body = 0x6a2e3a;
  L.block(x, y + 0.4, z, 4.6, 1.0, 2, { color: shade(body, 1.3), side: body, bevel: 0.35 });
  L.block(x - 0.2, y + 1.4, z, 2.5, 0.85, 1.8, { color: 0x3a3040, bevel: 0.3 });
  for (const [dx, dz] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]]) {
    L.mesh(place(cylinder(0.42, 0.42, 0.3, 12, 0x1e1a22), x + dx, y + 0.42, z + dz - Math.sign(dz) * 0.15, 0, Math.PI / 2));
  }
  const hl = lit ? 0xfff4d0 : 0x4a4452;
  for (const s of [-0.65, 0.65]) L.block(x + 2.31, y + 0.9, z + s, 0.06, 0.3, 0.4, { color: hl, glow: true, solid: false });
  let beams = null;
  if (lit) {
    beams = [];
    for (const s of [-0.65, 0.65]) {
      const g = new THREE.ConeGeometry(2.6, 16, 16, 1, true);
      g.translate(0, -8, 0); g.rotateZ(Math.PI / 2);
      const m = L.dyn(g, makeBeamMaterial(0xfff0c8, 0.22));
      m.position.set(x + 2.35, y + 0.9, z + s); m.rotation.z = -0.08;
      beams.push(m);
    }
    L.glow(x - 0.2, y + 1.7, z, WARM, 3, { opacity: 0.8 });
  }
  return { door: [x - 0.4, y, z - 1.4], beams };
}

export function dome(L, x, y, z, open) {
  L.pillar(x, y, z, 4.4, 3.4, { color: 0xd8d0c8, fit: 1.35 });
  const g = new THREE.SphereGeometry(4.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  L.mesh(place(paint(g, gradient(0xeae4dc, 0xb8b0b8, 0, 4)), x, y + 3.4, z));
  L.mesh(place(chamferBox(1, 4.6, 0.3, 0.05, open ? 0xfff0c0 : 0x2a2632), x, y + 5.4, z + 2.6, 0, -0.55), { glow: open });
  L.block(x, y, z + 4.3, 1.8, 2.6, 0.3, { color: open ? 0xffe0a0 : 0x4a4250, glow: open, solid: false });
  if (open) L.glow(x, y + 7, z + 2.2, 0xfff0c0, 6, { opacity: 0.6 });
  return { door: [x, y, z + 4.6] };
}

export function hut(L, x, y, z) {
  L.block(x, y - 0.5, z, 4.6, 3.3, 3.8, { color: 0x6a5a58, side: 0x4a3c40 });
  // pitched roof
  for (const s of [-1, 1]) {
    const g = chamferBox(5.2, 0.25, 2.4, 0.05, 0x3a3038);
    place(g, x, y + 3.35, z + s * 1.05, 0, s * 0.5);
    L.mesh(g);
  }
  L.solid(x, y + 2.8, z, 4.6, 1.2, 3.8);
  L.block(x - 1, y + 1.1, z + 1.92, 1.2, 0.9, 0.06, { color: 0xffc47a, glow: true, solid: false });
  L.block(x + 1.1, y - 0.1, z + 1.92, 1.0, 2.0, 0.06, { color: 0x3a2c2a, solid: false });
  L.glow(x - 1, y + 1.5, z + 2.2, WARM, 3.5, { opacity: 0.7 });
  // the board for QSL cards
  L.mesh(beam([x - 3.6, y - 0.5, z + 2.6], [x - 3.6, y + 2.2, z + 2.6], 0.14, 0x5a4a40));
  L.mesh(beam([x - 6.2, y - 0.5, z + 2.6], [x - 6.2, y + 2.2, z + 2.6], 0.14, 0x5a4a40));
  L.block(x - 4.9, y + 0.7, z + 2.6, 2.9, 1.4, 0.12, { color: 0x9a7a5a, solid: false });
  return { board: [x - 4.9, y + 1.4, z + 2.68] };
}

// Telegraph poles along a polyline; returns the two rideable wires.
export function telegraph(L, pts, Hf) {
  const poles = [];
  for (const [x, z] of pts) {
    const y = Hf(x, z);
    L.pillar(x, y - 0.5, z, 0.2, 7.5, { color: 0x5a4a44, seg: 7 });
    L.block(x, y + 6.5, z, 0.25, 0.25, 2.4, { color: 0x5a4a44, solid: false });
    poles.push([x, y + 6.85, z]);
  }
  const wires = [];
  for (const s of [-1, 1]) wires.push(L.wire(poles.map(([x, y, z]) => [x, y, z + s * 1.05]), { sag: 0.035, perSeg: 8, color: 0x3a3440 }));
  return { poles, wires };
}
