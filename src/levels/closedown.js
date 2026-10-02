import * as THREE from 'three';
import { place, paint, beam, col, cylinder } from '../geometry.js';
import { audio } from '../audio.js';
import { music } from '../music.js';

// Close Down — the station has played its anthem and gone off air.
// Subject: the rules of the world bend. Silence is solid; an echo punches a hole in it.

const VELVET = 0x0d0a14, VIOLET = 0x8a5aff, AMBER = 0xffa040, HUM = 0x8a6238, HUM_S = 0x4a3020, RED = 0xff2a1a;
// The hole an echo punches: an upright ellipsoid around Pip. When it opens silence straight
// overhead, the shaft draws Pip up harder than an ordinary echo, through a ceiling one voxel thick.
const RH = 1.6, RV = 2.6, HOP = 16;

// Silence: velvet-black voxels that glow faintly violet along their edges.
function silenceMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uEdge: { value: new THREE.Color(VIOLET) }, uBase: { value: new THREE.Color(VELVET) } }]),
    vertexShader: /* glsl */`
      attribute float aScale; attribute vec3 aNp; attribute vec3 aNn; varying vec3 vL; varying vec3 vN; varying vec3 vW; varying float vS; varying vec3 vNb;
      #include <fog_pars_vertex>
      void main(){
        vL = position; vN = normal; vS = aScale; vNb = mix(aNn, aNp, step(0.0, position));
        vec4 w = modelMatrix * instanceMatrix * vec4(position * aScale, 1.0); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uEdge, uBase; varying vec3 vL; varying vec3 vN; varying vec3 vW; varying float vS; varying vec3 vNb;
      #include <fog_pars_fragment>
      void main(){
        // glow only along edges where silence meets air (so a hole gets a bright rim)
        vec3 a = smoothstep(0.86, 0.985, abs(vL) * 2.0) * (1.0 - step(0.5, vNb));
        float mx = max(a.x, max(a.y, a.z)), mn = min(a.x, min(a.y, a.z));
        float edge = a.x + a.y + a.z - mx - mn;
        vec3 q = smoothstep(0.9, 0.99, abs(vL) * 2.0); float grid = q.x + q.y + q.z - max(q.x, max(q.y, q.z)) - min(q.x, min(q.y, q.z));
        float fr = 1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW)));
        float pulse = 0.65 + 0.35 * sin(uTime * 0.9 + vW.y * 0.35 + vW.x * 0.11);
        vec3 col = uBase * (0.7 + 0.6 * fr) + uEdge * pow(fr, 3.0) * 0.12;
        col += uEdge * (edge * 0.6 + grid * 0.035) * pulse + uEdge * (1.0 - vS) * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
  });
}

// Fill a block of silence voxels; (x0,y0,z0) is the min corner, sizes in whole voxels.
function silence(st, L, x0, y0, z0, nx, ny, nz) {
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const x = x0 + i, y = y0 + j, z = z0 + k, key = x + ',' + y + ',' + z;
    if (st.vkeys.has(key)) continue;
    const v = { i: st.voxels.length, x: x + 0.5, y: y + 0.5, z: z + 0.5, c: L.phys.addBox(x, y, z, x + 1, y + 1, z + 1), s: 1, holds: 0, open: false, e: null };
    st.vkeys.set(key, v);
    st.voxels.push(v);
  }
}

const NB = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];
// Which of a voxel's six neighbours are present (closed silence), for the edge glow.
function refreshNb(st, v) {
  NB.forEach(([dx, dy, dz], k) => {
    const n = st.vkeys.get((v.x - 0.5 + dx) + ',' + (v.y - 0.5 + dy) + ',' + (v.z - 0.5 + dz));
    (k < 3 ? st.vnp : st.vnn).array[v.i * 3 + (k % 3)] = n && !n.open ? 1 : 0;
  });
}
function setOpen(st, v, open) {
  v.open = open; v.c.enabled = !open;
  for (const [dx, dy, dz] of NB) {
    const n = st.vkeys.get((v.x - 0.5 + dx) + ',' + (v.y - 0.5 + dy) + ',' + (v.z - 0.5 + dz));
    if (n) refreshNb(st, n);
  }
  st.vnp.needsUpdate = st.vnn.needsUpdate = true;
}

function finishSilence(st, L) {
  const n = st.voxels.length;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const sc = new Float32Array(n).fill(1);
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(sc, 1));
  st.vnp = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  st.vnn = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  geo.setAttribute('aNp', st.vnp); geo.setAttribute('aNn', st.vnn);
  for (const v of st.voxels) refreshNb(st, v);
  st.vmat = silenceMaterial();
  const im = new THREE.InstancedMesh(geo, st.vmat, n);
  const m4 = new THREE.Matrix4();
  st.voxels.forEach((v, i) => im.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z)));
  im.computeBoundingSphere();
  L.root.add(im);
  st.vscale = geo.attributes.aScale;
}

// Ordinary matter: mains hum, amber, with a glowing trim along its top edges.
function hum(L, x, top, z, w, d, t = 1, o = {}) {
  L.plat(x, top, z, w, d, { t, color: o.color ?? HUM, side: HUM_S });
  if (o.trim === false) return;
  for (const [tx, tz, tw, td] of [[x, z - d / 2, w, 0.07], [x, z + d / 2, w, 0.07], [x - w / 2, z, 0.07, d], [x + w / 2, z, 0.07, d]]) {
    L.block(tx, top - 0.09, tz, tw, 0.1, td, { glow: true, solid: false, color: AMBER, bevel: 0.01 });
  }
}

export default {
  id: 'closedown',
  name: 'Close Down',
  freq: 'off air',
  dial: 0.98,
  qsl: 'Off air. "This is the end of today\'s transmissions. Please remember to switch off your set." Nobody ever told the silence afterwards to go home, so it stayed, and set hard.',
  qslColors: ['#1c1626', '#b08aff', '#f0e4ff'],
  killY: -30,
  echoMode: 'hole',
  echoLife: 3.6,
  palette: { top: 0x3a3048, side: 0x1c1626, accent: AMBER, dust: 0x9a80d0 },
  env: {
    sky: { top: 0x020104, horizon: 0x0e0816, bottom: 0x040208, aurora1: 0x5a2aff, aurora2: 0xff3a5a, aurora: 0.12, stars: 0.12, horizonGlow: 0.15 },
    fog: [0x07050c, 18, 95],
    hemi: [0xc8a080, 0x180c10, 0.85],
    sun: [0xffb070, 0.45, [0.3, 1, 0.2]],
    rim: 0x9a5418, rimPow: 2.2, low: 0x3a2418, lowY: -14, highY: 24, groove: 0.05,
    motes: { color: 0xb090ff, count: 120, size: 0.05, opacity: 0.35, drift: [0.05, 0.12, 0.05] },
    echo: 0xd8b8ff,
  },
  music: {
    bpm: 54, root: 58, scale: 'major', steps: 64,
    layers: [
      { name: 'mains', inst: 'hum', gain: 0.7, oct: -2, notes: [[0, 0, 64]] },
      { name: 'static', inst: 'crackle', gain: 0.5, hits: 'x......x...x.........x..x.......' },
      // the station anthem, coming back a phrase at a time
      { name: 'motif', inst: 'organ', depth: 1, gain: 0.6, notes: [[0, [2, 4], 4], [4, [1, 3], 4], [8, [0, 2], 4], [12, [1, 4], 4]] },
      { name: 'phrase2', inst: 'organ', depth: 3, gain: 0.6, notes: [[16, [2, 4], 4], [20, [3, 5], 4], [24, [4, 6], 8]] },
      { name: 'phrase3', inst: 'organ', depth: 5, gain: 0.6, notes: [[32, [4, 7], 4], [36, [3, 5], 4], [40, [2, 4], 4], [44, [1, -1], 4]] },
      { name: 'choir', inst: 'pad', depth: 5, gain: 0.55, cutoff: 700, wave: 'triangle', notes: [[0, [0, 2, 4], 16], [16, [-2, 0, 2], 16], [32, [1, 3, 5], 16], [48, [-3, -1, 1], 16]] },
      { name: 'phrase4', inst: 'organ', depth: 7, gain: 0.65, notes: [[48, [2, 4], 4], [52, [1, -1], 4], [56, [0, 4, 7], 8]] },
      { name: 'bass', inst: 'bass', depth: 7, gain: 0.45, oct: -1, notes: [[0, 0, 14], [16, -2, 14], [32, 1, 14], [48, -3, 8], [56, 0, 8]] },
    ],
  },

  build(L, g) {
    const st = { t: 0, voxels: [], vkeys: new Map(), boost: false };
    // ---- the gallery: a hum landing in dead air, the transmitter's red light far ahead
    L.spawn(0, 0.05, 4, Math.PI);
    hum(L, 0, 0, 4, 8, 8);
    hum(L, 0, 0, -4.5, 6, 9);
    // teach: a wall of silence across the walk (too tall to climb, too wide to get round)
    silence(st, L, -7, 0, -9, 14, 6, 1);
    L.camZone(0, -1, 3, 10, 6, 12, { pitch: 0.06, dist: 8 });
    L.prompt(0, 0, -6, 4, 'echo');

    // ---- the low room: a silence ceiling over a hum floor, closed on every side
    hum(L, 0, 0, -16.5, 8, 15);
    L.block(-4.5, -1, -16.5, 1, 4, 15, { color: HUM, side: HUM_S });
    L.block(4.5, -1, -16.5, 1, 4, 15, { color: HUM, side: HUM_S });
    silence(st, L, -5, 3, -24, 10, 1, 15);
    L.checkpoint(2, 0, -12, { depth: 1 });
    L.camZone(0, -0.5, -16.5, 8, 3.4, 15, { dist: 4.2, pitch: 0.12, height: 0.9 });
    L.glow(0, 1.6, -22.5, AMBER, 3, { opacity: 0.35 });

    // ---- the landing above it, and the dead floor: a room whose only way on is down
    L.block(0, -5, -27, 12, 9, 6, { color: HUM, side: HUM_S });
    hum(L, 0, 4, -27, 12, 6, 0.4);
    L.checkpoint(0, 4, -26.5, { depth: 2 });
    silence(st, L, -6, 3, -42, 12, 1, 12);
    L.block(-6.5, -5, -36, 1, 15, 12, { color: HUM, side: HUM_S });
    L.block(6.5, 0, -36, 1, 10, 12, { color: HUM, side: HUM_S });
    L.block(6.5, -5, -32.5, 1, 5, 5, { color: HUM, side: HUM_S });
    L.block(6.5, -5, -40.5, 1, 5, 3, { color: HUM, side: HUM_S });
    L.block(0, 3, -42.5, 14, 7, 1, { color: HUM, side: HUM_S });

    // ---- the lower dark
    hum(L, 0, -4, -36, 12, 12, 1, { trim: false });
    L.checkpoint(-3, -4, -34, { depth: 3 });
    L.glow(-4.5, -2.2, -41, AMBER, 2.5, { opacity: 0.4 });
    // mains conduits along the walls, broken where the silence door stands
    for (const [x, y, z, w, d] of [[-5.96, -2.6, -36, 0.08, 11.6], [0, -1.2, -29.96, 11.6, 0.08], [5.96, -2.6, -32.5, 0.08, 5], [5.96, -2.6, -40.5, 0.08, 3], [-5.96, -0.4, -36, 0.08, 11.6]]) {
      L.block(x, y, z, w, 0.08, d, { glow: true, solid: false, color: AMBER, bevel: 0.01 });
    }
    // a door of silence in the east wall, and the coda in the pocket behind it
    silence(st, L, 6, -4, -39, 1, 4, 4);
    hum(L, 9.5, -4, -37, 6, 4, 1, { trim: false });
    L.block(12.8, -4, -37, 0.6, 3, 4, { color: HUM, side: HUM_S });
    L.secret('stray', 'stray', 10.5, -4, -37, { stray: 'coda', name: 'The Coda', line: 'The last bar of the anthem, the one that was cut off by the switch. It has been holding its final note in the dark, waiting to be allowed to finish.' });

    // ---- the causeway to the transmitter, and its plinth
    hum(L, 0, -4, -50, 6, 16);
    hum(L, 0, -4, -70, 18, 18, 3);
    L.checkpoint(5, -4, -62.5, { depth: 4 });
    L.solid(0, -4, -70, 9, 24, 9);
    // east face: a long stair to the north walk
    L.stairs(7.5, -4, -70, 3, 14, 6, 14, '-z', { color: HUM, side: HUM_S });
    hum(L, 7.5, 2, -79.5, 5, 5, 0.6);
    hum(L, 0, 2, -80.5, 10, 3, 0.6);
    // a wall across the walk, standing out over the void
    silence(st, L, 0, 2, -84, 1, 5, 6);
    hum(L, -7.5, 2, -79.5, 5, 5, 0.6);
    L.checkpoint(-7.5, 2, -79, { depth: 5 });
    // the QSL card, behind a double wall
    hum(L, -13.5, 2, -79.5, 7, 3, 0.6);
    silence(st, L, -11, 2, -82, 1, 4, 5);
    silence(st, L, -14, 2, -82, 1, 4, 5);
    L.block(-16.6, 2, -79.5, 0.6, 2.4, 3, { color: HUM, side: HUM_S });
    L.secret('qsl', 'qsl', -15.4, 3.1, -79.5);

    // west face: up to the landing under a roof of silence
    L.stairs(-7.5, 2, -71, 3, 12, 3, 7, '+z', { color: HUM, side: HUM_S });
    hum(L, -7.5, 5, -63, 5, 4, 0.6);
    L.checkpoint(-8.5, 5, -63, { depth: 6 });
    silence(st, L, -13, 8, -66, 8, 1, 9);

    // ---- the anthem room: a wall, a floor and a ceiling of silence all at once.
    // Echo on the floor and you drop to the ledge below; echo high and the floor survives.
    hum(L, -3.5, 9, -61.5, 3, 5, 0.6);
    silence(st, L, -2, 8, -64, 6, 1, 5);
    silence(st, L, -3, 9, -64, 1, 3, 5);
    silence(st, L, -3, 12, -65, 8, 1, 7);
    L.block(4.5, 8, -61.5, 1, 4, 7, { color: HUM, side: HUM_S });
    L.block(1, 8, -64.5, 8, 4, 1, { color: HUM, side: HUM_S });
    L.block(1, 8, -58.5, 8, 4, 1, { color: HUM, side: HUM_S });
    L.block(-3.5, 13, -61.5, 1, 3, 7, { color: HUM, side: HUM_S });
    L.block(0.5, 13, -57.5, 9, 3, 1, { color: HUM, side: HUM_S });
    L.camZone(1, 8.5, -61.5, 6, 3.6, 5, { dist: 3.4, pitch: 0.3, height: 0.8 });
    L.glow(3.3, 10.6, -61.5, AMBER, 2.2, { opacity: 0.3 });
    // the ledge that catches you, and the way back round to the roof
    hum(L, 1, 4.5, -61.5, 6, 5, 0.6);
    hum(L, -3.5, 4.75, -62.5, 3, 3, 0.5, { trim: false });

    // ---- the last climb, round the top of the transmitter
    L.stairs(8, 13, -61.5, 6, 3, 3.5, 8, '+x', { color: HUM, side: HUM_S });
    hum(L, 12.5, 16.5, -61.5, 3, 3, 0.6);
    L.stairs(12.5, 16.5, -69, 3, 12, 3.5, 8, '-z', { color: HUM, side: HUM_S });
    hum(L, 12.5, 20, -77, 3, 4, 0.6);
    hum(L, 1.5, 20, -71.5, 19, 15, 1);
    L.checkpoint(12.3, 20, -74.4, { depth: 7 });
    L.camZone(0, 19, -70, 26, 10, 18, { dist: 10, pitch: 0.38 });

    // the mast and its red light
    for (let y = 20; y < 36; y += 2) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.mesh(beam([sx * 0.8, y, -75 + sz * 0.8], [sx * 0.8, y + 2, -75 + sz * 0.8], 0.12, 0x3a2a24));
      L.mesh(beam([-0.8, y, -74.2], [0.8, y + 2, -74.2], 0.06, 0x3a2a24));
      L.mesh(beam([0.8, y, -75.8], [-0.8, y + 2, -75.8], 0.06, 0x3a2a24));
    }
    L.solid(0, 20, -75, 1.8, 16, 1.8);
    st.red = L.glow(0, 36.6, -75, RED, 9, { opacity: 0.9 });
    st.redLight = L.light(0, 35, -75, RED, 40, 40);
    L.mesh(place(paint(new THREE.SphereGeometry(0.45, 12, 8), RED), 0, 36.6, -75), { glow: true });

    // the five pips, waiting in a row, and the gap at the end that is the hour
    const prof = [[0, 0], [0.17, 0.02], [0.28, 0.1], [0.325, 0.26], [0.32, 0.46], [0.28, 0.64], [0.19, 0.78], [0.08, 0.85], [0, 0.865]].map(([r, y]) => new THREE.Vector2(r, y));
    const pipGeo = new THREE.LatheGeometry(prof, 16), eyeGeo = new THREE.SphereGeometry(0.045, 8, 6), eyeMat = new THREE.MeshBasicMaterial({ color: 0x241a2e });
    st.pips = [-5, -3, -1, 1, 3].map((x, i) => {
      const m = L.dyn(pipGeo, new THREE.MeshBasicMaterial({ color: 0xfff0d8 }));
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(eyeGeo, eyeMat); e.scale.set(1, 1.7, 0.6); e.position.set(sx * 0.1, 0.55, 0.3); m.add(e); }
      m.position.set(x, 20, -68); m.rotation.y = 2.2 - i * 0.12; m.scale.setScalar(i === 4 ? 1 : 0.92);
      L.glow(x, 20.5, -68, 0xffd8a0, 2.2, { opacity: 0.4 });
      return m;
    });
    L.ident(5, 21.2, -68, { color: 0xfff0d0 });

    // the transmitter itself: a dark core in a steel lattice, hum rings every few metres
    L.block(0, -4, -70, 8.4, 23.8, 8.4, { color: 0x2a1c18, side: 0x160e0c, solid: false });
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let y = -4; y < 20; y += 4) {
      for (let c = 0; c < 4; c++) {
        const [ax, az] = C[c], [bx, bz] = C[(c + 1) % 4];
        L.mesh(beam([ax * 4.6, y, -70 + az * 4.6], [ax * 4.6, y + 4, -70 + az * 4.6], 0.32, 0x4a362c));
        L.mesh(beam([ax * 4.6, y, -70 + az * 4.6], [bx * 4.6, y + 4, -70 + bz * 4.6], 0.14, 0x3a2a24));
        L.mesh(beam([bx * 4.6, y, -70 + bz * 4.6], [ax * 4.6, y + 4, -70 + az * 4.6], 0.14, 0x3a2a24));
      }
      if (y > -4) for (const [x, z, w, d] of [[0, -74.65, 9.3, 0.1], [0, -65.35, 9.3, 0.1], [-4.65, -70, 0.1, 9.3], [4.65, -70, 0.1, 9.3]]) L.block(x, y, z, w, 0.1, d, { glow: true, solid: false, color: AMBER, bevel: 0.01 });
    }

    // a hum cable out over the void to a lone pillar (Line), and another back to the plinth
    L.block(-10.3, 5, -62, 0.3, 2.4, 0.3, { color: HUM, side: HUM_S, solid: false });
    L.wire([[-10.3, 7.2, -62], [-33, 5.1, -62]], { sag: 0.03, radius: 0.045, color: AMBER, glow: true, oneWay: 1 });
    L.block(-35, -9, -62, 4, 12, 4, { color: HUM, side: HUM_S });
    hum(L, -35, 3, -62, 4, 4, 0.2);
    L.secret('harmonic', 'harmonic', -35.4, 4.1, -61.6, { color: 0xd8b8ff });
    L.block(-36.6, 3, -63.4, 0.3, 2.3, 0.3, { color: HUM, side: HUM_S, solid: false });
    L.wire([[-36.6, 5.2, -63.4], [-7.6, -1.5, -64]], { sag: 0.02, radius: 0.045, color: AMBER, glow: true, oneWay: 1 });
    // dead cables hanging in the dark, for scale
    L.wire([[-6.5, 10, -42.5], [-20, 2, -60], [-35, -6, -62]], { sag: 0.06, radius: 0.05, color: 0x3a2418 }).enabled = false;
    L.wire([[6.5, 10, -42.5], [26, 4, -56], [40, -8, -80]], { sag: 0.06, radius: 0.05, color: 0x3a2418 }).enabled = false;
    finishSilence(st, L);
    return st;
  },

  onEcho(st, e, g) {
    const P = g.player.pos, cy = P.y + 0.45;
    e.holes = [];
    for (const v of st.voxels) {
      const dx = (v.x - P.x) / RH, dy = (v.y - cy) / RV, dz = (v.z - P.z) / RH;
      if (dx * dx + dy * dy + dz * dz > 1) continue;
      v.holds++; v.e = e; if (!v.open) setOpen(st, v, true);
      e.holes.push(v);
      if (Math.abs(v.x - P.x) < 0.9 && Math.abs(v.z - P.z) < 0.9 && v.y > P.y + 0.9) st.boost = true;
    }
    audio.hole();
    g.fx.burst(P.x, cy, P.z, { count: 26, color: VIOLET, speed: 5, size: 0.2, life: 0.7, drag: 3 });
  },

  onComplete(st, g) { st.done = true; audio.pip(true, 0.12); },

  onEchoEnd(st, e) { for (const v of e.holes || []) v.holds = Math.max(0, v.holds - 1); },

  fixed(st, dt, g) {
    const p = g.player, P = p.pos, hw = p.body.hw + 0.04, h = p.body.h + 0.04;
    if (st.boost) { st.boost = false; if (p.vel.y > 0) p.vel.y = Math.max(p.vel.y, HOP); }
    // silence grows back once nothing holds it open, but never around Pip
    for (const v of st.voxels) {
      if (!v.open || v.holds > 0) continue;
      if (Math.abs(v.x - P.x) < 0.5 + hw && v.y + 0.5 > P.y - 0.04 && v.y - 0.5 < P.y + h && Math.abs(v.z - P.z) < 0.5 + hw) continue;
      setOpen(st, v, false);
    }
  },

  update(st, dt, g) {
    st.t += dt;
    st.vmat.uniforms.uTime.value = st.t;
    // the red light breathes; the five pips sound in turn, and the sixth beat is a gap
    const r = 0.5 + 0.5 * Math.sin(st.t * 1.1);
    st.red.material.opacity = 0.3 + 0.65 * r; st.redLight.intensity = 8 + 34 * r;
    const beat = music.beat(), n = Math.floor(beat), f = beat - n, P = g.player.pos;
    const near = Math.hypot(P.x, P.y - 20, P.z + 70) < 22;
    st.pips.forEach((m, i) => {
      const on = !st.done && ((n % 6) + 6) % 6 === i ? Math.max(0, 1 - f * 2.5) : st.done ? 0.6 : 0;
      m.material.color.setRGB(0.55 + 0.45 * on, 0.5 + 0.45 * on, 0.42 + 0.4 * on);
      m.scale.y = 0.92 + on * 0.12; m.position.y = 20 + on * 0.1;
    });
    if (near && !st.done && n !== st.lastBeat && ((n % 6) + 6) % 6 < 5) audio.pip(false, 0.035);
    st.lastBeat = n;
    const a = st.vscale.array, k = Math.min(1, dt * 14);
    let dirty = false;
    st.voxels.forEach((v, i) => {
      const warn = v.open && v.holds > 0 && v.e && v.e.life < 0.9;
      const target = !v.open ? 1 : warn ? 0.12 + 0.12 * Math.sin(st.t * 30) : 0;
      if (Math.abs(target - v.s) < 1e-3) return;
      v.s += (target - v.s) * k; a[i] = v.s; dirty = true;
    });
    if (dirty) st.vscale.needsUpdate = true;
  },
};
