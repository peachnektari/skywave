import * as THREE from 'three';

// Every helper returns a non-indexed BufferGeometry with exactly position/normal/color,
// so any of them can be merged together into one draw call.

const _c = new THREE.Color();
export const col = (v) => (v instanceof THREE.Color ? v : _c.set(v)).clone();

export function shade(c, k) { return col(c).multiplyScalar(k); }
export function mix(a, b, t) { return col(a).lerp(col(b), t); }

// A box with chamfered edges; walkable tops lighter, sides darkening toward the base.
export function chamferBox(w, h, d, bevel, top, side, bottom) {
  const X = w / 2, Y = h / 2, Z = d / 2;
  const b = Math.max(0.001, Math.min(bevel, X * 0.45, Y * 0.45, Z * 0.45));
  const P = (sx, sy, sz, which) => which === 0
    ? [sx * X, sy * (Y - b), sz * (Z - b)]
    : which === 1 ? [sx * (X - b), sy * Y, sz * (Z - b)] : [sx * (X - b), sy * (Y - b), sz * Z];
  const tris = [];
  const quad = (a, b2, c, d2) => { tris.push([a, b2, c], [a, c, d2]); };
  const S = [-1, 1];
  // faces
  for (const s of S) {
    quad(P(s, -1, -1, 0), P(s, 1, -1, 0), P(s, 1, 1, 0), P(s, -1, 1, 0));
    quad(P(-1, s, -1, 1), P(1, s, -1, 1), P(1, s, 1, 1), P(-1, s, 1, 1));
    quad(P(-1, -1, s, 2), P(1, -1, s, 2), P(1, 1, s, 2), P(-1, 1, s, 2));
  }
  // edges
  for (const sx of S) for (const sy of S) quad(P(sx, sy, -1, 0), P(sx, sy, -1, 1), P(sx, sy, 1, 1), P(sx, sy, 1, 0));
  for (const sx of S) for (const sz of S) quad(P(sx, -1, sz, 0), P(sx, -1, sz, 2), P(sx, 1, sz, 2), P(sx, 1, sz, 0));
  for (const sy of S) for (const sz of S) quad(P(-1, sy, sz, 1), P(-1, sy, sz, 2), P(1, sy, sz, 2), P(1, sy, sz, 1));
  // corners
  for (const sx of S) for (const sy of S) for (const sz of S) tris.push([P(sx, sy, sz, 0), P(sx, sy, sz, 1), P(sx, sy, sz, 2)]);

  const cTop = col(top), cSide = col(side ?? shade(top, 0.62)), cBot = col(bottom ?? shade(cSide, 0.55));
  const pos = [], nor = [], colr = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  const tmp = new THREE.Color();
  for (const t of tris) {
    va.fromArray(t[0]); vb.fromArray(t[1]); vc.fromArray(t[2]);
    n.subVectors(vb, va).cross(m.subVectors(vc, va));
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    const cen = m.copy(va).add(vb).add(vc).multiplyScalar(1 / 3);
    let order = [va, vb, vc];
    if (n.dot(cen) < 0) { n.negate(); order = [va, vc, vb]; }
    for (const v of order) {
      pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z);
      const hT = (v.y + Y) / (2 * Y);
      if (n.y > 0.8) tmp.copy(cTop);
      else if (n.y < -0.8) tmp.copy(cBot);
      else if (n.y > 0.3) tmp.copy(cTop).lerp(cSide, 0.35);
      else tmp.copy(cBot).lerp(cSide, 0.45 + 0.55 * Math.min(1, hT * 1.4));
      colr.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return g;
}

// Convert any three geometry into our mergeable format, colouring it.
// `color` is a colour or fn(x,y,z,nx,ny,nz) -> THREE.Color.
export function paint(geo, color) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const p = g.attributes.position, nrm = g.attributes.normal;
  const arr = new Float32Array(p.count * 3);
  const fixed = typeof color === 'function' ? null : col(color);
  for (let i = 0; i < p.count; i++) {
    const c = fixed || color(p.getX(i), p.getY(i), p.getZ(i), nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Vertical gradient paint: darker toward the local base.
export function gradient(top, side, y0, y1) {
  const cT = col(top), cS = col(side ?? shade(top, 0.62)), cB = shade(cS, 0.55), t = new THREE.Color();
  return (x, y, z, nx, ny) => {
    if (ny > 0.8) return cT;
    const k = Math.min(1, Math.max(0, (y - y0) / Math.max(0.001, y1 - y0)));
    return t.copy(cB).lerp(cS, 0.45 + 0.55 * k);
  };
}

export function cylinder(rTop, rBot, h, seg, top, side) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);
  g.translate(0, h / 2, 0);
  return paint(g, gradient(top, side, 0, h));
}

export function place(g, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s),
  );
  g.applyMatrix4(m);
  return g;
}

// A sagging wire between points, as a thin tube. Returns {geometry, points}.
export function catenary(points, sag = 0.08, perSeg = 10) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]);
    const len = a.distanceTo(b);
    for (let k = 0; k <= perSeg; k++) {
      if (i > 0 && k === 0) continue;
      const t = k / perSeg;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(Math.PI * t) * len * sag;
      out.push(p);
    }
  }
  return out;
}

export function tube(points, radius, color, radial = 5) {
  const curve = new THREE.CatmullRomCurve3(points);
  return paint(new THREE.TubeGeometry(curve, Math.max(4, points.length * 2), radius, radial, false), color);
}

// Terrain mesh matching physics.Heightfield triangulation, with smooth normals.
export function terrainGeometry(hf, colorFn) {
  const { x0, z0, cell, nx, nz } = hf;
  const pos = [], nor = [], colr = [];
  const h = (ix, iz) => hf.at(Math.max(0, Math.min(nx, ix)), Math.max(0, Math.min(nz, iz)));
  const n = new THREE.Vector3();
  const V = (ix, iz) => {
    n.set(h(ix - 1, iz) - h(ix + 1, iz), 2 * cell, h(ix, iz - 1) - h(ix, iz + 1)).normalize();
    return [x0 + ix * cell, hf.at(ix, iz), z0 + iz * cell, n.x, n.y, n.z];
  };
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const a = V(ix, iz), b = V(ix + 1, iz), c = V(ix + 1, iz + 1), d = V(ix, iz + 1);
    for (const v of [a, c, b, a, d, c]) {
      pos.push(v[0], v[1], v[2]); nor.push(v[3], v[4], v[5]);
      const k = colorFn(v[0], v[1], v[2], v[4]);
      colr.push(k.r, k.g, k.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return g;
}

// Smoothed-normal version for organic shapes (rocks, hills).
export function rock(radius, detail, seed, color, squash = 0.7) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.18 * Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed * 1.3) + 0.08 * Math.sin(y * 5 + seed);
    p.setXYZ(i, x * k, y * k * squash, z * k);
  }
  g.computeVertexNormals();
  return paint(g, gradient(color, shade(color, 0.7), -radius * squash, radius * squash));
}

// A square-section beam from a to b (lattice members, poles, rails).
export function beam(a, b, t, top, side) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const g = chamferBox(t, A.distanceTo(B), t, t * 0.2, top, side ?? top);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
