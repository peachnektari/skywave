// Tiny custom collision world. The player is an AABB; the world is AABBs (static ones in a
// spatial hash, kinematic ones in a list) plus "ground providers" (ramps, heightfields)
// that only answer "how high is the ground here?". Axis-separated moves at a fixed step.

const CELL = 8;
const EPS = 1e-4;
let nextId = 1;

const key = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

export class Collider {
  constructor(minx, miny, minz, maxx, maxy, maxz, opts = {}) {
    this.id = nextId++;
    this.min = { x: minx, y: miny, z: minz };
    this.max = { x: maxx, y: maxy, z: maxz };
    this.solid = opts.solid !== false;
    this.oneWay = !!opts.oneWay;
    this.kinematic = !!opts.kinematic;
    this.enabled = true;
    this.tag = opts.tag || '';
    this.data = opts.data || null;
    this.dx = 0; this.dy = 0; this.dz = 0;
    this._stamp = 0;
  }
  get cx() { return (this.min.x + this.max.x) / 2; }
  get cy() { return (this.min.y + this.max.y) / 2; }
  get cz() { return (this.min.z + this.max.z) / 2; }
  // Kinematic colliders accumulate their motion so riders can follow it.
  moveTo(cx, cy, cz) { this.moveBy(cx - this.cx, cy - this.cy, cz - this.cz); }
  moveBy(dx, dy, dz) {
    this.min.x += dx; this.max.x += dx; this.dx += dx;
    this.min.y += dy; this.max.y += dy; this.dy += dy;
    this.min.z += dz; this.max.z += dz; this.dz += dz;
  }
}

// Surface rises from y0 to y1 along `axis` ('x'|'z') in direction `dir` (+1|-1).
export class Ramp {
  constructor(minx, minz, maxx, maxz, y0, y1, axis, dir, base) {
    Object.assign(this, { minx, minz, maxx, maxz, y0, y1, axis, dir });
    this.minY = base ?? Math.min(y0, y1) - 1;
    this.kind = 'ramp';
    this.enabled = true;
  }
  contains(x, z) { return x >= this.minx && x <= this.maxx && z >= this.minz && z <= this.maxz; }
  surface(x, z) {
    let t = this.axis === 'x' ? (x - this.minx) / (this.maxx - this.minx) : (z - this.minz) / (this.maxz - this.minz);
    if (this.dir < 0) t = 1 - t;
    return this.y0 + (this.y1 - this.y0) * Math.min(1, Math.max(0, t));
  }
}

// Grid of heights, triangulated along the (0,0)-(1,1) diagonal (matches builder terrain mesh).
export class Heightfield {
  constructor(x0, z0, cell, nx, nz, heights) {
    Object.assign(this, { x0, z0, cell, nx, nz, heights });
    this.minY = -Infinity;
    this.kind = 'heightfield';
    this.enabled = true;
  }
  contains(x, z) {
    return x >= this.x0 && z >= this.z0 && x <= this.x0 + this.nx * this.cell && z <= this.z0 + this.nz * this.cell;
  }
  at(ix, iz) { return this.heights[iz * (this.nx + 1) + ix]; }
  surface(x, z) {
    const gx = (x - this.x0) / this.cell, gz = (z - this.z0) / this.cell;
    const ix = Math.min(this.nx - 1, Math.max(0, Math.floor(gx)));
    const iz = Math.min(this.nz - 1, Math.max(0, Math.floor(gz)));
    const fx = Math.min(1, Math.max(0, gx - ix)), fz = Math.min(1, Math.max(0, gz - iz));
    const h00 = this.at(ix, iz), h10 = this.at(ix + 1, iz), h01 = this.at(ix, iz + 1), h11 = this.at(ix + 1, iz + 1);
    if (fx >= fz) return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
    return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }
}

export class Physics {
  constructor() {
    this.grid = new Map();
    this.kinematic = [];
    this.grounds = [];
    this.stamp = 0;
    this._a = []; this._b = []; this._c = [];
  }

  addBox(minx, miny, minz, maxx, maxy, maxz, opts) {
    const c = new Collider(minx, miny, minz, maxx, maxy, maxz, opts);
    if (c.kinematic) { this.kinematic.push(c); return c; }
    const x0 = Math.floor(minx / CELL), x1 = Math.floor(maxx / CELL);
    const z0 = Math.floor(minz / CELL), z1 = Math.floor(maxz / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = key(cx, cz);
      let arr = this.grid.get(k);
      if (!arr) this.grid.set(k, arr = []);
      arr.push(c);
    }
    return c;
  }
  addGround(g) { this.grounds.push(g); return g; }
  remove(c) {
    if (c.kinematic) { const i = this.kinematic.indexOf(c); if (i >= 0) this.kinematic.splice(i, 1); return; }
    for (const arr of this.grid.values()) { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); }
  }
  clearDeltas() { for (const c of this.kinematic) { c.dx = 0; c.dy = 0; c.dz = 0; } }

  // All enabled solid colliders strictly overlapping the box.
  query(minx, miny, minz, maxx, maxy, maxz, out = []) {
    out.length = 0;
    const stamp = ++this.stamp;
    const x0 = Math.floor(minx / CELL), x1 = Math.floor(maxx / CELL);
    const z0 = Math.floor(minz / CELL), z1 = Math.floor(maxz / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const arr = this.grid.get(key(cx, cz));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        if (c._stamp === stamp) continue;
        c._stamp = stamp;
        if (c.enabled && c.solid && c.min.x < maxx && c.max.x > minx && c.min.y < maxy && c.max.y > miny && c.min.z < maxz && c.max.z > minz) out.push(c);
      }
    }
    for (const c of this.kinematic) {
      if (c.enabled && c.solid && c.min.x < maxx && c.max.x > minx && c.min.y < maxy && c.max.y > miny && c.min.z < maxz && c.max.z > minz) out.push(c);
    }
    return out;
  }

  // Highest ramp/heightfield surface at (x,z) whose solid part reaches below headY.
  groundSurface(x, z, headY) {
    let best = null, bestG = null;
    for (const g of this.grounds) {
      if (!g.enabled || !g.contains(x, z) || headY <= g.minY) continue;
      const s = g.surface(x, z);
      if (best === null || s > best) { best = s; bestG = g; }
    }
    this.lastGround = bestG;
    return best;
  }

  isFree(x, feet, z, hw, h) {
    return this.query(x - hw, feet + EPS, z - hw, x + hw, feet + h - EPS, z + hw, this._c).length === 0;
  }

  // Highest walkable surface under (x,z) between y-depth and y. Returns {y, collider} or null.
  groundBelow(x, y, z, depth, hw = 0.05) {
    let best = null, col = null;
    const list = this.query(x - hw, y - depth, z - hw, x + hw, y + 0.01, z + hw, this._c);
    for (const c of list) if (c.max.y <= y + 0.01 && (best === null || c.max.y > best)) { best = c.max.y; col = c; }
    const s = this.groundSurface(x, z, y + 0.01);
    if (s !== null && s <= y + 0.01 && s >= y - depth && (best === null || s > best)) { best = s; col = this.lastGround; }
    return best === null ? null : { y: best, collider: col };
  }

  // Segment cast against boxes and ground providers. Returns distance or maxDist.
  raycast(ox, oy, oz, dx, dy, dz, maxDist, ignoreTag) {
    const ex = ox + dx * maxDist, ey = oy + dy * maxDist, ez = oz + dz * maxDist;
    const list = this.query(Math.min(ox, ex), Math.min(oy, ey), Math.min(oz, ez), Math.max(ox, ex), Math.max(oy, ey), Math.max(oz, ez), this._c);
    let best = maxDist;
    for (const c of list) {
      if (ignoreTag && c.tag === ignoreTag) continue;
      let t0 = 0, t1 = best;
      for (const a of ['x', 'y', 'z']) {
        const o = a === 'x' ? ox : a === 'y' ? oy : oz;
        const d = a === 'x' ? dx : a === 'y' ? dy : dz;
        if (Math.abs(d) < 1e-9) { if (o < c.min[a] || o > c.max[a]) { t0 = Infinity; break; } continue; }
        let ta = (c.min[a] - o) / d, tb = (c.max[a] - o) / d;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < best) best = t0;
    }
    if (this.grounds.length) {
      const step = 0.5;
      let prevT = 0;
      for (let t = 0; t <= best; t += step) {
        const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
        const s = this.groundSurface(px, pz, py + 0.01);
        if (s !== null && py < s) {
          let lo = prevT, hi = t;
          for (let i = 0; i < 6; i++) {
            const m = (lo + hi) / 2;
            const sm = this.groundSurface(ox + dx * m, oz + dz * m, oy + dy * m + 0.01);
            if (sm !== null && oy + dy * m < sm) hi = m; else lo = m;
          }
          best = Math.min(best, lo);
          break;
        }
        prevT = t;
      }
    }
    return best;
  }

  // Push a body out of a collider it overlaps (used when kinematics move into it).
  depenetrate(b, c) {
    const P = b.pos, hw = b.hw;
    if (!(c.min.x < P.x + hw && c.max.x > P.x - hw && c.min.y < P.y + b.h && c.max.y > P.y && c.min.z < P.z + hw && c.max.z > P.z - hw)) return false;
    const up = c.max.y - P.y;
    const px = c.max.x - (P.x - hw), nx = (P.x + hw) - c.min.x;
    const pz = c.max.z - (P.z - hw), nz = (P.z + hw) - c.min.z;
    const m = Math.min(up, px, nx, pz, nz);
    if (m === up) { P.y = c.max.y; if (b.vel.y < 0) b.vel.y = 0; b.grounded = true; b.ground = c; }
    else if (m === px) P.x += px + EPS;
    else if (m === nx) P.x -= nx + EPS;
    else if (m === pz) P.z += pz + EPS;
    else P.z -= nz + EPS;
    return true;
  }

  // Move a body {pos, vel, hw, h, stepUp, grounded, ground} by vel*dt with collision.
  moveBody(b, dt) {
    const P = b.pos, V = b.vel;
    const g = b.ground;
    if (b.grounded && g && g.kinematic) { P.x += g.dx; P.y += g.dy; P.z += g.dz; }
    const wasGrounded = b.grounded;
    b.grounded = false; b.ground = null; b.hitWall = false; b.hitCeil = false;

    const canStep = wasGrounded || !!b.wading;
    this._axis(b, 'x', V.x * dt, canStep);
    this._axis(b, 'z', V.z * dt, canStep);

    const hw = b.hw - EPS, h = b.h;
    const prevFeet = P.y;
    P.y += V.y * dt;
    const list = this.query(P.x - hw, Math.min(prevFeet, P.y), P.z - hw, P.x + hw, Math.max(prevFeet, P.y) + h, P.z + hw, this._a);
    let land = null, ceil = null;
    for (const c of list) {
      const tol = 0.03 + Math.max(0, c.dy);
      if (V.y <= 0 && c.max.y <= prevFeet + tol && c.max.y >= P.y - EPS) {
        if (!land || c.max.y > land.max.y) land = c;
      } else if (!c.oneWay && V.y > 0 && c.min.y >= prevFeet + h - 0.03 && c.min.y <= P.y + h) {
        if (!ceil || c.min.y < ceil.min.y) ceil = c;
      }
    }
    if (land) { P.y = land.max.y; V.y = 0; b.grounded = true; b.ground = land; }
    else if (ceil) { P.y = ceil.min.y - h - EPS; V.y = 0; b.hitCeil = true; b.ceil = ceil; }

    const s = this.groundSurface(P.x, P.z, P.y + h);
    if (s !== null && P.y <= s + EPS && (!b.grounded || s > P.y)) {
      if (V.y <= 0 || prevFeet >= s - 0.3) {
        const gp = this.lastGround;
        P.y = s; if (V.y < 0) V.y = 0; b.grounded = true; b.ground = gp;
      }
    }

    // Stick to the ground when walking off gentle slopes, steps and descending platforms.
    if (!b.grounded && wasGrounded && V.y <= 0 && !b.noSnap) {
      const probe = 0.3 + Math.hypot(V.x, V.z) * dt * 1.2 + (g && g.kinematic ? Math.max(0, -g.dy) : 0);
      const hit = this._snapProbe(P, hw, probe);
      if (hit) { P.y = hit.y; V.y = 0; b.grounded = true; b.ground = hit.c; }
    }
    b.noSnap = false;
  }

  _snapProbe(P, hw, probe) {
    let best = null, col = null;
    const list = this.query(P.x - hw, P.y - probe, P.z - hw, P.x + hw, P.y + 0.02, P.z + hw, this._b);
    for (const c of list) if (!c.oneWay || c.max.y <= P.y + 0.02) if (c.max.y <= P.y + 0.02 && (best === null || c.max.y > best)) { best = c.max.y; col = c; }
    const s = this.groundSurface(P.x, P.z, P.y + 0.02);
    if (s !== null && s <= P.y + 0.02 && s >= P.y - probe && (best === null || s > best)) { best = s; col = this.lastGround; }
    return best === null ? null : { y: best, c: col };
  }

  _axis(b, ax, d, wasGrounded) {
    if (d === 0) return;
    const P = b.pos, hw = b.hw, h = b.h;
    const before = P[ax];
    P[ax] += d;
    const list = this.query(P.x - hw, P.y + 0.002, P.z - hw, P.x + hw, P.y + h - 0.002, P.z + hw, this._a);
    for (const c of list) {
      if (c.oneWay) continue;
      // Only resolve overlaps this move created; pre-existing ones are depenetrated elsewhere.
      if (d > 0 && before + hw > c.min[ax] + 0.01) continue;
      if (d < 0 && before - hw < c.max[ax] - 0.01) continue;
      const rise = c.max.y - P.y;
      if (wasGrounded && rise > 0 && rise <= b.stepUp && this.isFree(P.x, c.max.y, P.z, hw, h)) { P.y = c.max.y; continue; }
      if (d > 0) P[ax] = Math.min(P[ax], c.min[ax] - hw - EPS);
      else P[ax] = Math.max(P[ax], c.max[ax] + hw + EPS);
      b.vel[ax] = 0; b.hitWall = true; b.wall = c;
    }
    const s = this.groundSurface(P.x, P.z, P.y + h);
    if (s !== null && s > P.y) {
      const allow = b.stepUp + Math.abs(d) * 1.3;
      if (s - P.y <= allow && (wasGrounded || s - P.y < 0.35)) P.y = s;
      else { P[ax] = before; b.vel[ax] = 0; b.hitWall = true; b.wall = null; }
    }
  }
}
