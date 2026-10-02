import * as THREE from 'three';
import { cylinder, place, paint, col, shade, beam, chamferBox } from '../geometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Furniture of Please Hold: plazas shaped like finger holes, carpet-tile paths, chairs,
// queue barriers, ticket machines and the Now Serving board.

export const OAT = 0xe2d6c2, LILAC = 0x9a88b4, CYAN = 0x5ff0e6, PLUM = 0x5a4a6e, SAGE = 0x9aa894;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, canvas: c };
}

// A round plaza (a finger hole), its digit painted on the floor. Colliders approximate the disc.
export function plaza(L, x, top, z, digit, r = 5) {
  L.mesh(place(cylinder(r, r, 1.2, 32, OAT, LILAC), x, top - 1.2, z));
  L.mesh(place(cylinder(r * 0.92, r * 0.25, 3.4, 24, LILAC, PLUM), x, top - 4.6, z));
  L.mesh(place(paint(new THREE.TorusGeometry(r - 0.25, 0.14, 6, 40).rotateX(Math.PI / 2), 0xc8bcd8), x, top + 0.04, z));
  // six rectangles inscribed in the circle: within ~4% of the rim everywhere
  for (let i = 0; i < 6; i++) { const a = ((7.5 + i * 15) * Math.PI) / 180; L.solid(x, top - 1.2, z, 2 * r * Math.cos(a), 1.2, 2 * r * Math.sin(a)); }
  if (digit !== undefined) {
    const { tex } = canvasTex(128, 128, (g2) => {
      g2.fillStyle = '#ffffff'; g2.font = 'bold 104px Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText(String(digit), 64, 70);
    });
    const m = L.dyn(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, color: 0xb6a6cc, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, top + 0.02, z);
  }
}

// A runner of carpet tiles from a to b (tops interpolated). Works on diagonals.
export function path(L, ax, az, at, bx, bz, bt, o = {}) {
  const d = Math.hypot(bx - ax, bz - az), w = o.w ?? 2.6, n = Math.max(1, Math.ceil(d / (o.step ?? 1.5)));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    L.plat(ax + (bx - ax) * k, at + (bt - at) * k, az + (bz - az) * k, w, w, { t: o.t ?? 0.6, color: i % 2 ? OAT : 0xd2c4b4, side: LILAC, bevel: 0.06 });
  }
}

// Waiting-room chairs as one instanced mesh. rows: [x, y, z, ry][]
export function chairs(L, list) {
  const parts = [
    place(chamferBox(0.9, 0.12, 0.8, 0.04, 0xb8a8d0, 0x8a7aa4), 0, 0.5, 0),
    place(chamferBox(0.9, 0.8, 0.12, 0.04, 0xb8a8d0, 0x8a7aa4), 0, 0.9, -0.36),
    place(chamferBox(0.08, 0.5, 0.08, 0.02, 0x6a6078), -0.38, 0.22, 0.3),
    place(chamferBox(0.08, 0.5, 0.08, 0.02, 0x6a6078), 0.38, 0.22, 0.3),
    place(chamferBox(0.08, 0.5, 0.08, 0.02, 0x6a6078), -0.38, 0.22, -0.3),
    place(chamferBox(0.08, 0.5, 0.08, 0.02, 0x6a6078), 0.38, 0.22, -0.3),
  ];
  return L.instanced(mergeGeometries(parts, false), list.map(([x, y, z, ry]) => [x, y, z, ry, 1]));
}

// A row of n chairs centred at x,z facing yaw `ry`.
export function chairRow(x, y, z, ry, n, out) {
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 1.0; out.push([x + c * o, y, z - s * o, ry]); }
  return out;
}

// Queue barrier posts with belts between consecutive points.
export function barrier(L, pts, y) {
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    L.mesh(place(cylinder(0.06, 0.06, 1.0, 8, 0xd8d0e0), x, y, z));
    L.mesh(place(cylinder(0.22, 0.24, 0.06, 12, 0x6a6078), x, y, z));
    L.mesh(place(paint(new THREE.SphereGeometry(0.09, 8, 6), 0xd8d0e0), x, y + 1.02, z));
    if (i) { const [px, pz] = pts[i - 1]; L.mesh(beam([px, y + 0.92, pz], [x, y + 0.92, z], 0.07, 0x3aa8a4)); }
  }
}

// A ticket machine: a pale cabinet with a glowing screen and a ticket in its mouth.
export function ticketMachine(L, x, y, z, ry = 0) {
  L.block(x, y, z, 1.1, 1.9, 0.8, { color: 0xd8ccd8, side: 0x9a8ab0, ry });
  const c = Math.cos(ry), s = Math.sin(ry);
  const fx = x + s * 0.42, fz = z + c * 0.42;
  L.mesh(place(chamferBox(0.7, 0.45, 0.05, 0.02, CYAN, CYAN), fx, y + 1.4, fz, ry), { glow: true });
  L.mesh(place(chamferBox(0.32, 0.04, 0.3, 0.01, 0xf4ecd8, 0xf4ecd8), fx + s * 0.1, y + 0.95, fz + c * 0.1, ry));
}

export function plant(x, y, z, s, out) { out.push([x, y, z, s * 5, s]); return out; }
export function plantGeo() {
  return mergeGeometries([
    cylinder(0.32, 0.24, 0.55, 10, 0xc8b8a8, 0x9a8878),
    place(paint(new THREE.IcosahedronGeometry(0.55, 1).scale(1, 1.3, 1), SAGE), 0, 1.15, 0),
    place(paint(new THREE.IcosahedronGeometry(0.35, 1).scale(1, 1.4, 1), 0xa8b8a0), 0.25, 1.65, 0.1),
  ], false);
}

// The Now Serving board: a lit cube on a column, its numbers drawn on a canvas.
export function board(L, x, y, z, w = 8, h = 5) {
  const { tex, canvas } = canvasTex(512, 320, () => {});
  const face = new THREE.MeshBasicMaterial({ map: tex });
  const cap = new THREE.MeshLambertMaterial({ color: 0x4a3e5a });
  const m = L.dyn(new THREE.BoxGeometry(w, h, w), [face, face, cap, cap, face, face]);
  m.position.set(x, y + h / 2, z);
  L.solid(x, y, z, w, h, w);
  L.mesh(place(chamferBox(w + 0.6, 0.4, w + 0.6, 0.12, 0xd8ccd8, LILAC), x, y + h + 0.2, z));
  L.mesh(place(chamferBox(w + 0.6, 0.4, w + 0.6, 0.12, 0xd8ccd8, LILAC), x, y - 0.2, z));
  L.solid(x, y + h, z, w + 0.6, 0.4, w + 0.6);
  const draw = (n, mine, blink = true) => {
    const g2 = canvas.getContext('2d');
    g2.fillStyle = '#1c1626'; g2.fillRect(0, 0, 512, 320);
    g2.strokeStyle = '#3a3048'; g2.lineWidth = 8; g2.strokeRect(10, 10, 492, 300);
    g2.textAlign = 'center';
    g2.fillStyle = '#7ff0e8'; g2.font = '30px ui-monospace, Consolas, monospace';
    g2.fillText('NOW SERVING', 256, 62);
    g2.shadowColor = '#5ff0e6'; g2.shadowBlur = blink ? 18 : 6;
    g2.font = 'bold 150px ui-monospace, Consolas, monospace';
    g2.fillText(String(n), 256, 205);
    g2.shadowBlur = 0;
    g2.fillStyle = n === mine ? '#ffd890' : '#b8a8d0'; g2.font = '26px ui-monospace, Consolas, monospace';
    g2.fillText(n === mine ? 'YOUR NUMBER HAS BEEN CALLED' : `YOUR TICKET  ${mine}`, 256, 278);
    tex.needsUpdate = true;
  };
  return { mesh: m, draw, top: y + h + 0.4 };
}

// A phone cord: a coiled helix wound round a wire's points (visual only).
export function coil(L, pts, r = 0.16, turns = 1.6, color = 0xd8d0e8) {
  const out = [], up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1], len = p0.distanceTo(p1);
    t.subVectors(p1, p0).normalize();
    a.crossVectors(t, up); if (a.lengthSq() < 1e-4) a.set(1, 0, 0); a.normalize();
    b.crossVectors(a, t).normalize();
    const n = Math.max(2, Math.ceil(len * turns * 6));
    for (let k = 0; k < n; k++) {
      const f = k / n, th = (s + f * len) * turns * Math.PI * 2;
      out.push(p0.clone().lerp(p1, f).addScaledVector(a, Math.cos(th) * r).addScaledVector(b, Math.sin(th) * r));
    }
    s += len;
  }
  out.push(pts[pts.length - 1].clone());
  const curve = new THREE.CatmullRomCurve3(out);
  L.mesh(paint(new THREE.TubeGeometry(curve, out.length * 2, 0.035, 4, false), color));
}

// The far-below dial plate: what the plazas are floating over.
export function dialPlate(L, holes, y) {
  L.mesh(place(cylinder(58, 56, 2, 64, 0xcabed8, 0x8a7ca4), 0, y - 2, 0));
  for (const [hx, hz] of holes) L.mesh(place(cylinder(6.2, 6.2, 0.3, 28, 0x6a5c80, 0x5a4c70), hx, y - 0.05, hz));
  L.mesh(place(cylinder(15, 15, 0.3, 40, 0xf0e8f4, 0xc8bcd8), 0, y - 0.05, 0));
}

// The finger stop: a curved steel hook standing in the gap after the "0".
export function fingerStop(L, x, top, z, ry) {
  L.block(x, top - 8, z, 3.2, 8, 3.2, { color: 0xd8d0e0, side: 0x8a80a0 });
  const hook = paint(new THREE.TorusGeometry(2.2, 0.35, 8, 20, Math.PI * 1.1), 0xc8c4d4);
  L.mesh(place(hook, x, top + 2.2, z, ry, 0, 0));
}
