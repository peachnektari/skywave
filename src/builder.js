import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { chamferBox, cylinder, place, paint, catenary, tube, col, shade, terrainGeometry } from './geometry.js';
import { worldMaterial, glowMaterial, glowSprite, makeWaterMaterial, makeStaticMaterial } from './materials.js';
import { Ramp } from './physics.js';
import * as props from './props.js';

// The level-building helper API. Levels call these in build(L); static geometry is
// accumulated and merged into a few chunked meshes by finish().
//   block(x, y0, z, w, h, d)  — x/z centre, y0 bottom
//   plat(x, top, z, w, d)     — same, specified by its walkable top
const CHUNK = 64;

export class Builder {
  constructor(world, def) {
    this.world = world;
    this.def = def;
    this.phys = world.physics;
    this.root = world.root;
    this.pal = def.palette;
    this.buckets = { world: [], glow: [] };
    this.mat = world.worldMat;
  }

  geo(g, bucket = 'world') { this.buckets[bucket].push(g); return g; }

  block(x, y0, z, w, h, d, o = {}) {
    if (o.visible !== false) {
      const top = o.color ?? this.pal.top;
      const side = o.side ?? (o.color !== undefined ? shade(o.color, 0.66) : this.pal.side);
      const g = chamferBox(w, h, d, o.bevel ?? 0.12, top, side, o.bottom);
      place(g, x, y0 + h / 2, z, o.ry || 0);
      this.geo(g, o.glow ? 'glow' : 'world');
    }
    if (o.solid === false) return null;
    const turned = o.ry && Math.abs(Math.sin(o.ry)) > 0.5;
    const cw = turned ? d : w, cd = turned ? w : d;
    return this.phys.addBox(x - cw / 2, y0, z - cd / 2, x + cw / 2, y0 + h, z + cd / 2, o);
  }
  plat(x, top, z, w, d, o = {}) { const t = o.t ?? 1; return this.block(x, top - t, z, w, t, d, o); }
  solid(x, y0, z, w, h, d, o = {}) { return this.phys.addBox(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2, o); }

  // Round column; collider is the inscribed square unless o.solid === false.
  pillar(x, y0, z, r, h, o = {}) {
    const top = o.color ?? this.pal.top;
    const g = cylinder(o.rTop ?? r, r, h, o.seg ?? 12, top, o.side ?? shade(top, 0.66));
    place(g, x, y0, z);
    this.geo(g, o.glow ? 'glow' : 'world');
    if (o.solid === false) return null;
    const s = r * (o.fit ?? 1.5);
    return this.phys.addBox(x - s / 2, y0, z - s / 2, x + s / 2, y0 + h, z + s / 2, o);
  }

  // Footprint w×d centred at x,z; the surface rises by `rise` toward dir ('+x','-x','+z','-z').
  ramp(x, y0, z, w, d, rise, dir, o = {}) {
    const axis = dir[1], sign = dir[0] === '+' ? 1 : -1;
    const minx = x - w / 2, maxx = x + w / 2, minz = z - d / 2, maxz = z + d / 2;
    this.phys.addGround(new Ramp(minx, minz, maxx, maxz, y0, y0 + rise, axis, sign, y0 - (o.base ?? 0.6)));
    // wedge along +x, then rotate into place
    const L = axis === 'x' ? w : d, D = axis === 'x' ? d : w;
    const v = (px, py, pz) => [px - L / 2, py, pz - D / 2];
    const A = v(0, 0, 0), B = v(L, 0, 0), C = v(L, rise, 0), A2 = v(0, 0, D), B2 = v(L, 0, D), C2 = v(L, rise, D);
    const tri = [A, C, C2, A, C2, A2, B, B2, C2, B, C2, C, A, A2, B2, A, B2, B, A, B, C, A2, C2, B2];
    // wind every triangle outward from the wedge's centroid (it's convex)
    const cen = new THREE.Vector3(L * 0.66 - L / 2, rise / 3, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
    for (let i = 0; i < tri.length; i += 3) {
      a.fromArray(tri[i]); b.fromArray(tri[i + 1]); c.fromArray(tri[i + 2]);
      n.subVectors(b, a).cross(m.subVectors(c, a));
      m.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(cen);
      if (n.dot(m) < 0) { const t = tri[i + 1]; tri[i + 1] = tri[i + 2]; tri[i + 2] = t; }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3));
    geom.computeVertexNormals();
    const top = o.color ?? this.pal.top, side = shade(top, 0.62);
    const g = paint(geom, (px, py, pz, nx, ny) => (ny > 0.3 ? col(top) : col(side)));
    const ry = axis === 'x' ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? -Math.PI / 2 : Math.PI / 2);
    place(g, x, y0, z, ry);
    this.geo(g);
  }

  stairs(x, y0, z, w, d, rise, n, dir, o = {}) {
    const axis = dir[1], sign = dir[0] === '+' ? 1 : -1;
    const run = (axis === 'x' ? w : d) / n;
    for (let i = 0; i < n; i++) {
      const h = (rise * (i + 1)) / n;
      const off = -((axis === 'x' ? w : d) / 2) + run * (i + 0.5);
      if (axis === 'x') this.block(x + off * sign, y0, z, run, h, d, o);
      else this.block(x, y0, z + off * sign, w, h, run, o);
    }
  }

  terrain(hf, colorFn) {
    this.phys.addGround(hf);
    const m = new THREE.Mesh(terrainGeometry(hf, colorFn), this.mat);
    this.root.add(m);
    return m;
  }

  // Arbitrary static visual geometry (already painted), merged into the level.
  mesh(g, o = {}) { return this.geo(g, o.glow ? 'glow' : 'world'); }

  // A dynamic mesh (not merged), using the world material by default.
  dyn(g, material) {
    const m = new THREE.Mesh(g, material ?? this.mat);
    this.root.add(m);
    return m;
  }

  // A moving solid block: its mesh and kinematic collider move together via set().
  mover(x, y, z, w, h, d, o = {}) {
    const top = o.color ?? this.pal.top;
    const g = o.geometry ?? chamferBox(w, h, d, o.bevel ?? 0.12, top, o.side ?? shade(top, 0.66));
    const mesh = this.dyn(g, o.material);
    const c = o.solid === false ? null : this.phys.addBox(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2, { ...o, kinematic: true });
    const mv = {
      mesh, col: c, pos: new THREE.Vector3(x, y, z), home: new THREE.Vector3(x, y, z), size: [w, h, d],
      set(nx, ny, nz) { this.pos.set(nx, ny, nz); mesh.position.set(nx, ny, nz); if (c) c.moveTo(nx, ny, nz); },
    };
    mv.set(x, y, z);
    this.world.movers.push(mv);
    return mv;
  }

  // Many moving solid blocks drawn as one instanced mesh (a unit chamfer box scaled per
  // instance). items: [{x,y,z,w,h,d,color?,solid?}]. Each returned mover has set(x,y,z,ry,rx).
  moverSet(items, o = {}) {
    const geo = chamferBox(1, 1, 1, o.bevel ?? 0.07, 0xffffff, o.sideShade ?? 0xb0b0b0);
    const im = new THREE.InstancedMesh(geo, o.material ?? this.mat, items.length);
    im.frustumCulled = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    const movers = items.map((it, i) => {
      im.setColorAt(i, col(it.color ?? this.pal.top));
      const c = it.solid === false ? null : this.phys.addBox(it.x - it.w / 2, it.y - it.h / 2, it.z - it.d / 2, it.x + it.w / 2, it.y + it.h / 2, it.z + it.d / 2, { kinematic: true, tag: it.tag || o.tag || '' });
      const mv = {
        i, col: c, pos: new THREE.Vector3(it.x, it.y, it.z), home: new THREE.Vector3(it.x, it.y, it.z), size: [it.w, it.h, it.d], ry: 0, rx: 0, data: it,
        set(x, y, z, ry = 0, rx = 0) { this.pos.set(x, y, z); this.ry = ry; this.rx = rx; if (c) c.moveTo(x, y, z); },
      };
      if (c) c.data = mv;
      return mv;
    });
    const commit = () => {
      for (const mv of movers) {
        e.set(mv.rx, mv.ry, 0); q.setFromEuler(e);
        m4.compose(mv.pos, q, sc.set(...mv.size));
        im.setMatrixAt(mv.i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    };
    commit();
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    this.root.add(im);
    this.world.onFrame(commit);
    movers.mesh = im;
    return movers;
  }

  // Instanced props. transforms: array of [x,y,z, ry, scale|[sx,sy,sz], color?, rx?]
  instanced(g, transforms, o = {}) {
    const mat = o.material ?? (o.sway ? this.world.swayMat : this.mat);
    const im = new THREE.InstancedMesh(g, mat, transforms.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    transforms.forEach((t, i) => {
      e.set(t[6] || 0, t[3] || 0, 0, 'YXZ');
      q.setFromEuler(e);
      const sc = t[4] ?? 1;
      if (Array.isArray(sc)) s.set(...sc); else s.setScalar(sc);
      m4.compose(p.set(t[0], t[1], t[2]), q, s);
      im.setMatrixAt(i, m4);
      if (t[5] !== undefined) im.setColorAt(i, col(t[5]));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    this.root.add(im);
    return im;
  }

  water(o) {
    const mat = makeWaterMaterial(o);
    const geo = new THREE.PlaneGeometry(o.w, o.d, o.seg ?? 64, o.seg ?? 64);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(o.x ?? 0, o.y, o.z ?? 0);
    this.root.add(mesh);
    const w = { mesh, mat, level: o.y, x: o.x ?? 0, z: o.z ?? 0, w: o.w, d: o.d, amp: o.amp ?? 0.25, freq: o.freq ?? 0.18, liquid: 'water' };
    w.setLevel = (y) => { w.level = y; mesh.position.y = y; };
    this.world.waters.push(w);
    return w;
  }

  // A liquid of static: you lose signal if you fall in (unless you're skipping).
  hazard(x, top, z, w, d, o = {}) {
    const mat = makeStaticMaterial(o);
    const geo = new THREE.PlaneGeometry(w, d, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, top, z);
    this.root.add(mesh);
    const h = { mesh, mat, level: top, x, z, w, d, amp: 0, freq: 0, liquid: 'static' };
    h.setLevel = (y) => { h.level = y; mesh.position.y = y; };
    this.world.waters.push(h);
    return h;
  }

  // A sagging wire; rideable with the Line ability. Returns the wire record.
  wire(points, o = {}) {
    const pts = catenary(points, o.sag ?? 0.04, o.perSeg ?? 10);
    this.geo(tube(pts, o.radius ?? 0.035, o.color ?? 0x2a2630, 4), o.glow ? 'glow' : 'world');
    return this.world.addWire(pts, o);
  }

  spawn(x, y, z, yaw = 0) { this.world.spawnPoint = { x, y, z, yaw }; }

  checkpoint(x, y, z, o = {}) {
    const m = props.checkpoint(o.color ?? this.pal.accent ?? 0xffc070);
    m.position.set(x, y, z);
    this.root.add(m);
    return this.world.addCheckpoint({ x, y, z, yaw: o.yaw ?? null, mesh: m, depth: o.depth });
  }

  // kind: 'qsl' | 'stray' | 'harmonic' | 'ability'. `id` is unique within the level.
  secret(kind, id, x, y, z, o = {}) {
    let m;
    if (kind === 'qsl') m = props.qslCard(this.def);
    else if (kind === 'stray') m = props.stray(o.stray);
    else if (kind === 'harmonic') m = props.harmonic(o.color);
    else m = props.abilityPickup(o.ability);
    m.position.set(x, y, z);
    this.root.add(m);
    return this.world.addPickup({ kind, id, x, y, z, mesh: m, ...o });
  }

  ident(x, y, z, o = {}) {
    const m = props.ident(o.color ?? this.pal.accent ?? 0xffe7a0);
    m.position.set(x, y, z); m.userData.baseY = y;
    this.root.add(m);
    return this.world.addPickup({ kind: 'ident', id: 'ident', x, y, z, mesh: m, radius: 1.6, ...o });
  }

  trigger(x, y0, z, w, h, d, o = {}) {
    return this.world.addTrigger({ min: [x - w / 2, y0, z - d / 2], max: [x + w / 2, y0 + h, z + d / 2], ...o });
  }

  // settings: {dist, pitch, yaw, height} to bias the follow camera, or {pos, look} for a fixed shot.
  camZone(x, y0, z, w, h, d, settings) {
    return this.world.addCamZone({ min: [x - w / 2, y0, z - d / 2], max: [x + w / 2, y0 + h, z + d / 2], ...settings });
  }

  glow(x, y, z, color, size, o = {}) {
    const s = glowSprite(color, size, o);
    s.position.set(x, y, z);
    this.root.add(s);
    return s;
  }

  light(x, y, z, color, intensity = 20, distance = 30) {
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    this.root.add(l);
    return l;
  }

  // Wordless input hint the first time it's needed (glyph: 'jump' | 'echo' | 'move' | 'look').
  prompt(x, y, z, r, glyph) { this.world.addPrompt({ x, y, z, r, glyph }); }

  finish() {
    for (const [bucket, list] of Object.entries(this.buckets)) {
      if (!list.length) continue;
      const mat = bucket === 'glow' ? this.world.glowMat : this.mat;
      const chunks = new Map();
      const box = new THREE.Box3(), c = new THREE.Vector3();
      for (const g of list) {
        g.computeBoundingBox(); box.copy(g.boundingBox).getCenter(c);
        const k = Math.floor(c.x / CHUNK) + ',' + Math.floor(c.z / CHUNK);
        if (!chunks.has(k)) chunks.set(k, []);
        chunks.get(k).push(g);
      }
      for (const arr of chunks.values()) {
        const merged = mergeGeometries(arr, false);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        this.root.add(mesh);
        for (const g of arr) g.dispose();
      }
    }
    this.buckets = { world: [], glow: [] };
  }
}
