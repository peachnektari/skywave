import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { col, beam, place, paint, cylinder, tube } from '../geometry.js';
import { audio } from '../audio.js';
import { music } from '../music.js';
import { worldMaterial } from '../materials.js';
import { valve, terminals, magicEye, dialTexture, kitchen } from './wirelessProps.js';

// The Wireless — the inside of a 1950s valve radio, Pip the size of a crumb.
// Subject: an ordinary object at the wrong scale. The set is playing: the speaker pumps on
// the beat, warm valves throw thermals, preset keys swing the tuning vanes into stairways,
// and an echo laid across two terminals closes a circuit.

const WALNUT = 0x5a3420, WALNUT_S = 0x341c10, CHASSIS = 0xb4a684, CHASSIS_S = 0x6a5c44;
const CREAM = 0xe8dcc0, AMBER = 0xffa040, EYE = 0x6aff8a, BRASS = 0xc8a050, COPPER = 0xc87a3a;
const SHAFT = [6, -12], VR = 3.4;
// vane angles per preset (0 faces the deck, +x is east): A climbs to the left gantry,
// B to the right, C — once the set is properly warm — all the way to the dial.
const VANES = {
  off: () => Math.PI,
  A: (i) => (i < 6 ? i * 0.9 : -0.9),
  B: (i) => (i < 6 ? -i * 0.9 : 0.9),
  C: (i) => (i * (2.54 + Math.PI * 2)) / 11,
};

export default {
  id: 'wireless',
  name: 'The Wireless',
  freq: '909 kHz',
  dial: 0.35,
  qsl: '909 kHz. "This is the Light Programme." Somebody turned this set on in 1953 and never turned it off. The valves have been warm for so long that the dance band has started to live in them.',
  qslColors: ['#efe2c4', '#7a3a1c', '#2a1a10'],
  killY: -40,
  palette: { top: CHASSIS, side: CHASSIS_S, accent: AMBER, dust: 0xe0c8a0 },
  env: {
    sky: { top: 0x05040c, horizon: 0x1c2a48, bottom: 0x0c0a14, aurora1: 0x3affb0, aurora2: 0x7a5cff, aurora: 1.8, stars: 1 },
    fog: [0x4a3020, 40, 150],
    hemi: [0xffe0b8, 0x5a3820, 1.55],
    sun: [0xffc080, 0.6, [0.2, 0.8, -0.6]],
    rim: 0xff9a40, low: 0x8a6448, lowY: -6, highY: 16, groove: 0.05, grooveScale: 5,
    motes: { color: 0xffe0b0, count: 220, size: 0.07, opacity: 0.5, drift: [0.05, 0.25, 0.04] },
    echo: 0xfff0c8,
  },
  music: {
    bpm: 108, root: 53, scale: 'major', steps: 32,
    layers: [
      { name: 'motif', inst: 'lead', gain: 0.6, oct: 1, cutoff: 1800, notes: [[0, 4, 3], [3, 5, 1], [4, 7, 4], [8, 6, 2], [10, 5, 2], [12, 4, 4], [16, 3, 3], [19, 4, 1], [20, 5, 4], [24, 4, 2], [26, 2, 2], [28, 0, 4]] },
      { name: 'comp', inst: 'piano', depth: 1, gain: 0.45, notes: [[2, [0, 2, 4], 1], [6, [0, 2, 4], 1], [10, [0, 2, 5], 1], [14, [0, 2, 4], 1], [18, [3, 5, 7], 1], [22, [3, 5, 7], 1], [26, [1, 4, 6], 1], [30, [1, 4, 6], 1]] },
      { name: 'bass', inst: 'bass', depth: 2, gain: 0.6, oct: -1, notes: [[0, 0, 3], [4, 2, 3], [8, 4, 3], [12, 5, 3], [16, 3, 3], [20, 5, 3], [24, 4, 3], [28, 6, 3]] },
      { name: 'brush', inst: 'brush', depth: 3, gain: 0.7, hits: 'X..x' },
      { name: 'clarinet', inst: 'lead', depth: 4, gain: 0.4, cutoff: 1200, notes: [[6, 9, 2], [14, 7, 2], [22, 8, 2], [30, 6, 2]] },
      { name: 'brass', inst: 'brass', depth: 5, gain: 0.5, notes: [[0, [2, 4, 7], 2], [16, [3, 5, 7], 2]] },
      { name: 'eye', inst: 'bell', depth: 6, gain: 0.35, oct: 2, notes: [[0, 0, 4], [12, 4, 4], [24, 2, 4]] },
      // the three preset stations, each adding its own voice to the set
      { name: 'kA', flag: 'kA', inst: 'marimba', gain: 0.5, oct: 1, notes: [[0, 7, 1], [3, 9, 1], [6, 11, 1], [8, 9, 1], [11, 7, 1], [16, 8, 1], [19, 10, 1], [22, 12, 1], [24, 10, 1], [27, 8, 1]] },
      { name: 'kB', flag: 'kB', inst: 'organ', gain: 0.6, notes: [[0, [0, 2, 4], 16], [16, [3, 5, 7], 16]] },
      { name: 'kC', flag: 'kC', inst: 'musicbox', gain: 0.5, oct: 2, notes: [[0, 4, 2], [4, 2, 2], [8, 0, 2], [12, 2, 2], [16, 3, 2], [20, 5, 2], [24, 4, 4]] },
    ],
  },

  build(L, g) {
    const st = { t: 0, preset: null, flagsDirty: true, valves: [], circuits: [], beat: 0, pulse: 0, outside: 0 };
    // ---- the cabinet: walnut box, chassis tray inside, the dial window in the front
    L.plat(0, 0, 0, 72, 60, { t: 10, color: CHASSIS, side: CHASSIS_S });
    const wall = (x, y0, z, w, h, d) => L.block(x, y0, z, w, h, d, { color: WALNUT, side: WALNUT_S, bevel: 0.4 });
    wall(-37, -10, 0, 2, 56, 64); wall(37, -10, 0, 2, 56, 64);
    wall(0, -10, 31, 72, 56, 2); wall(0, 44, 0, 76, 2.4, 66);
    wall(0, -10, -31, 72, 39.5, 2); wall(0, 38, -31, 72, 8, 2);
    wall(-30, 29.5, -31, 12, 8.5, 2); wall(30, 29.5, -31, 12, 8.5, 2);
    // vent holes in the back panel: the kitchen's aurora light leaks through
    const vents = [];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) vents.push([-16 + i * 4, 30 + j * 3.2, 29.95, 0, 1]);
    L.instanced(new THREE.CircleGeometry(0.55, 12).rotateY(Math.PI), vents, { material: new THREE.MeshBasicMaterial({ color: 0x6a7ad8, fog: false }) });
    // plywood lining inside, and the face the kitchen sees: grille cloth, knobs, a brass badge
    const ply = (x, y0, z, w, h, d) => L.block(x, y0, z, w, h, d, { color: 0x9a7450, side: 0x7a5838, solid: false, bevel: 0.05 });
    ply(-35.9, 0, 0, 0.2, 44, 60); ply(35.9, 0, 0, 0.2, 44, 60); ply(0, 0, 29.9, 72, 28, 0.2); ply(0, 43.8, 0, 72, 0.2, 60);
    L.block(-17, 2, -32.3, 30, 24, 0.6, { color: 0xc8a870, side: 0xa88a58, solid: false, bevel: 0.1 });
    for (let i = 0; i < 9; i++) L.block(-29 + i * 3, 2, -32.7, 0.5, 24, 0.4, { color: 0x6a3c22, solid: false, bevel: 0.05 });
    for (const x of [12, 26]) {
      L.mesh(place(cylinder(3.4, 3.8, 2.4, 28, CREAM, 0xb0a488), x, 12, -32, 0, -Math.PI / 2));
      L.mesh(place(cylinder(0.25, 0.25, 0.3, 6, 0x3a2414), x, 14.2, -34.45, 0, -Math.PI / 2));
    }
    L.block(19, 20, -32.25, 8, 2.4, 0.5, { color: BRASS, side: 0x8a6a30, solid: false, bevel: 0.2 });
    L.block(0, 28.8, -32.3, 50, 0.7, 0.8, { color: BRASS, side: 0x8a6a30, solid: false, bevel: 0.2 });

    // ---- the back: Pip comes in through a vent. The first valve is lit and its heat rises.
    L.spawn(0, 0.05, 26, Math.PI);
    L.checkpoint(4, 0, 22, { depth: 1 });
    st.valves.push(valve(L, 0, 0, 14.5, 1.6, 5.2, { warm: 1, always: true, lift: 6.8 }));
    L.prompt(0, 0, 18, 4, 'move');
    for (const [x, z, on] of [[-20, 20, 0.35], [-26, 14, 0.25], [22, 22, 0.3]]) st.valves.push(valve(L, x, 0, z, 1.3, 4.2, { warm: on, thermal: false }));
    L.pillar(-28, 0, 24, 2.4, 11, { color: 0xc8ccd0, seg: 18 });
    L.pillar(27, 0, 26, 2, 9, { color: 0xc8ccd0, seg: 18 });

    // ---- the deck: a raised chassis shelf across the middle, the preset keys at its front
    L.block(0.5, 0, 2.5, 37, 9, 17, { color: CHASSIS, side: CHASSIS_S });
    L.checkpoint(-8, 9, 6, { depth: 2 });
    L.pillar(-15, 9, 8, 2.1, 7.5, { color: 0xc8ccd0, seg: 18 });
    L.pillar(-10.5, 9, 9.2, 1.4, 5, { color: 0x8a2a20, seg: 14 });
    L.pillar(7, 9, 8.5, 1.6, 4.4, { color: 0x2a4a6a, seg: 14 });
    // the second valve is dark: lay an echo across its terminals to close the circuit
    const v2 = valve(L, 17, 9, 6, 1.6, 3.6, { lift: 8.6 });
    st.valves.push(v2);
    terminals(L, 14.6, 9, 5.4, 14.6, 9, 6.6, 17, 9, 6);
    st.circuits.push({ x: 14.6, y: 9.2, z: 6, r: 1.3, valve: v2 });
    L.prompt(14.6, 9, 6, 3, 'echo');
    st.keys = this.buildKeys(L);
    this.buildMiddle(L, st);
    this.buildFront(L, st, g);
    kitchen(L);
    return st;
  },

  // The tuning capacitor, the gantries either side of it, the output transformer, the speaker.
  buildMiddle(L, st) {
    // twelve rotor vanes on a brass shaft; each preset swings them into a different stair
    L.pillar(SHAFT[0], 0, SHAFT[1], 0.45, 30.5, { color: BRASS, seg: 10 });
    L.block(SHAFT[0], 0, SHAFT[1] - 3.6, 9, 8.6, 3, { color: 0x9a9aa0 });
    for (let i = 0; i < 6; i++) L.block(SHAFT[0], 1 + i * 1.3, SHAFT[1] - 2, 7.4, 0.25, 2.6, { color: 0xd0d0d4, solid: false });
    const items = [];
    for (let i = 0; i < 12; i++) items.push({ x: SHAFT[0], y: 10.3 + i * 1.5, z: SHAFT[1] - VR, w: 2.6, h: 0.4, d: 2.6, color: 0xd8d8dc, tag: 'vane' });
    st.vanes = L.moverSet(items, { bevel: 0.1 });
    st.vanes.forEach((v) => (v.a = Math.PI));

    // left gantry (to the speaker) and right gantry (to the transformer)
    L.plat(-9.8, 18, -12.5, 20.4, 7, { t: 0.8 });
    L.plat(23.3, 18, -12.5, 23.4, 7, { t: 0.8 });
    for (const x of [-18, -8, 14, 26]) L.mesh(beam([x, 0, -10], [x, 17.2, -10], 0.5, 0x8a7a5a));
    L.checkpoint(-14, 18, -12.5, { depth: 4 });
    // the standby switch on the left gantry warms a cold valve below: a lift back up for later
    st.v4 = valve(L, -16, 0, -7.5, 1.6, 5.2, { lift: 15 });
    st.valves.push(st.v4);
    L.block(-17.5, 18, -11.2, 1.4, 0.5, 1.4, { color: 0x2a2420 });
    st.lever = L.dyn(paint(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 8).translate(0, 0.8, 0), 0xe8dcc0));
    st.lever.position.set(-17.5, 18.5, -11.2); st.lever.rotation.z = 0.6;
    L.trigger(-17.5, 18, -11.2, 2.4, 2.5, 2.4, { once: true, enter: (gg) => {
      st.v4.always = true; st.v4.warm = 1; audio.click(); audio.thud(); gg.fx.shake(0.15);
      gg.fx.burst(-16, 6, -7.5, { count: 30, color: 0xffc070, speed: 4, size: 0.2 });
    } });
    // resistors stacked by the deck: a way back up from the front floor
    L.stairs(14.5, 0, -9, 3, 6, 9, 5, '+z', { color: 0xc8a888 });
    for (let i = 0; i < 5; i++) L.block(14.5, 1.8 * i + 0.6, -11.4 + i * 1.2, 3.05, 0.35, 0.3, { color: [0xc8402a, 0x2a2a2a, 0xe8a030, 0x6a3a8a, 0x3a8a4a][i], solid: false, bevel: 0.05 });

    // the output transformer: laminated iron, and a copper coil you can climb into
    L.block(28.5, 0, 2.5, 13, 18.4, 23, { color: 0x6a6a70, side: 0x3a3a40 });
    for (let k = 0; k < 9; k++) L.block(28.5, 1 + k * 1.9, 14.1, 12.6, 0.3, 0.3, { color: 0x8a8a90, solid: false });
    L.checkpoint(24, 18.4, 10, { depth: 3 });
    const C = [28, 4.5], cr = 3.2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      L.block(C[0] + Math.sin(a) * cr, 18.4, C[1] + Math.cos(a) * cr, 1.9, 4.0, 0.9, { color: COPPER, side: 0x8a4a20, ry: a, bevel: 0.25 });
    }
    for (let k = 0; k < 6; k++) L.mesh(place(paint(new THREE.TorusGeometry(cr + 0.48, 0.08, 4, 32).rotateX(Math.PI / 2), 0xe0a060), C[0], 18.9 + k * 0.62, C[1]));
    L.secret('qsl', 'qsl', C[0], 19.6, C[1]);

    // the speaker: a paper cone that pumps on the beat, its magnet hanging underneath
    const S = [-25, -12.5];
    st.speaker = L.mover(S[0], 16.7, S[1], 7, 0.6, 7, { color: 0xd8c098, side: 0xa89068 });
    st.speaker.mesh.visible = false;
    const cone = paint(new THREE.LatheGeometry([[1.4, 0.5], [2.6, 0.15], [4.4, 0.5], [5.2, 1.0], [5.5, 1.05]].map(([x, y]) => new THREE.Vector2(x, y)), 32), 0xd8c098);
    const cap = paint(new THREE.SphereGeometry(1.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).translate(0, 0.45, 0), 0xc8ac80);
    st.cone = L.dyn(mergeGeometries([cone, cap]), worldMaterial(L.world.U, { side: THREE.DoubleSide }));
    st.cone.position.set(S[0], 16.2, S[1]);
    for (const s of [-1, 1]) {
      L.block(S[0], 17, S[1] + s * 4.5, 11, 0.4, 2, { color: 0x5a5048 });
      L.block(S[0] + s * 4.5, 17, S[1], 2, 0.4, 7, { color: 0x5a5048 });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = S[0] + Math.sin(a) * 5.7, z = S[1] + Math.cos(a) * 5.7;
      L.mesh(beam([x, 17.4, z], [S[0] + Math.sin(a) * 1.7, 14.5, S[1] + Math.cos(a) * 1.7], 0.28, 0x5a5048));
      L.mesh(beam([x, 17.4, z], [S[0] + Math.sin(a + 0.785) * 5.7, 17.4, S[1] + Math.cos(a + 0.785) * 5.7], 0.3, 0x5a5048));
    }
    L.pillar(S[0], 11.5, S[1], 1.7, 3.6, { color: 0x3a3a42, seg: 18 });
    L.mesh(beam([S[0], 12, S[1]], [-27, 12, -5.5], 0.5, 0x5a5048));
    L.plat(-27, 11.5, -5.5, 4, 3, { t: 0.6, color: 0x5a5048 });
    L.secret('stray', 'stray', -27, 11.6, -5.5, { stray: 'crackle', name: 'The Crackle', line: 'It lives in the dust behind the magnet and comes out whenever somebody touches the volume knob. It means no harm. It just likes to be heard between songs.' });
  },

  // The dial ledge behind the glass, the last circuit, the magic eye, and the way out.
  buildFront(L, st, g) {
    L.plat(-19.75, 27, -23.5, 32.5, 13, { t: 0.7 });
    L.plat(19.75, 27, -23.5, 32.5, 13, { t: 0.7 });
    for (const x of [-30, -12, 12, 30]) L.mesh(beam([x, 26.4, -29.6], [x, 21, -29.6], 0.45, 0x8a7a5a));
    L.checkpoint(-20, 27, -24, { depth: 5 });
    // in the gap, a dark valve; two leads dangle above it. Bridge them in mid-air.
    L.plat(0, 20, -21.5, 4, 4, { t: 0.6, color: 0x5a5048 });
    L.mesh(beam([0, 19.6, -23.4], [0, 19.6, -29.8], 0.5, 0x5a5048));
    const v3 = valve(L, 0, 20, -21.5, 1.6, 3.2, { lift: 12 });
    st.valves.push(v3);
    for (const s of [-1, 1]) {
      L.mesh(tube([new THREE.Vector3(s * 3, 44, -24), new THREE.Vector3(s * 1.4, 36, -22.5), new THREE.Vector3(s * 0.75, 29.9, -21.5)], 0.07, 0xc84a2a, 5));
      L.mesh(place(cylinder(0.16, 0.2, 0.5, 8, 0xe8c880, 0x9a7a40), s * 0.75, 29.4, -21.5));
    }
    st.circuits.push({ x: 0, y: 29.4, z: -21.5, r: 1.8, valve: v3, onClose: (s2) => { s2.v3Done = true; } });
    L.hazard(0, 0.25, -23, 14, 14, { a: 0x1a1210, b: 0xd8b890 });
    // the perch under the magic eye
    L.plat(0, 33, -27.5, 8, 5, { t: 0.6, color: CREAM });
    L.checkpoint(2.6, 33, -27, { depth: 6 });
    st.eye = magicEye(L, 0, 37.4, -30, 2.0);
    L.light(0, 36, -27, EYE, 16, 26);
    L.light(0, 15, 4, AMBER, 30, 46);
    // the dial glass slopes out through the window; the bezel under it keeps it honest
    L.ramp(0, 30, -34.5, 48, 9, 3, '+z', { color: 0xf0d8a8 });
    L.solid(0, 29.5, -30.5, 48, 2.9, 1);
    st.glass = L.dyn(new THREE.PlaneGeometry(48, 9.49), new THREE.MeshBasicMaterial({ map: dialTexture(), transparent: true, fog: false }));
    st.glass.position.set(0, 31.53, -34.5); st.glass.rotation.x = -Math.PI / 2 - Math.atan(1 / 3);
    st.needle = L.dyn(new THREE.BoxGeometry(0.18, 0.05, 8), new THREE.MeshBasicMaterial({ color: 0xd02a1a }));
    st.needle.rotation.x = Math.atan(1 / 3) * -1; st.needleX = -2;
    L.trigger(0, 29, -35, 48, 8, 9, { once: true, enter: (gg) => this.outside(st, gg) });
    L.plat(0, 30, -41.5, 24, 5, { t: 1.2, color: 0xd8d8d0 });
    L.ident(0, 31.4, -42);
    L.camZone(0, 28, -40, 30, 12, 14, { dist: 13, pitch: 0.22 });
    // the dial cord: ride it (Line) up to the pulley in the corner
    L.wire([[12, 29.7, -24], [32.6, 37.4, -24]], { sag: 0.03, radius: 0.07, color: 0x9a8060, oneWay: 1 });
    L.mesh(tube([new THREE.Vector3(33.8, 36.4, -24), new THREE.Vector3(33.8, 31, -24), new THREE.Vector3(SHAFT[0], 30.4, SHAFT[1])], 0.06, 0x9a8060, 4));
    L.mesh(place(cylinder(1.3, 1.3, 0.4, 20, BRASS, 0x8a6a30), 33.8, 37.4, -24.2, 0, Math.PI / 2));
    L.plat(33.5, 35.2, -24, 5, 3.4, { t: 0.5, color: 0x5a5048 });
    L.secret('harmonic', 'harmonic', 33.4, 36.5, -24);
  },

  // Three preset keys on the deck's front edge. One goes down, the others pop up.
  buildKeys(L) {
    const names = { A: 'HILVERSUM', B: 'LUXEMBOURG', C: 'DROITWICH' }, tabs = { A: 0xc8402a, B: 0x2a6ac8, C: 0x3a9a5a };
    return ['A', 'B', 'C'].map((id, i) => {
      const x = -13 + i * 4;
      const mv = L.mover(x, 9.2, -4, 3, 1.2, 3.6, { color: CREAM, side: 0xb0a488, tag: 'key' });
      mv.col.data = { key: id };
      const tab = L.dyn(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ map: labelTex(names[id], tabs[id]) }));
      tab.position.set(x, 9.3, -5.82); tab.rotation.y = Math.PI;
      return { id, x, mv, tab, down: 0 };
    });
  },

  fixed(st, dt, g) {
    st.t += dt;
    const p = g.player, P = p.pos, b = p.body, V = p.vel;
    // circuits: an echo across a pair of terminals warms that valve
    for (const c of st.circuits) {
      const on = g.world.echoes.some((e) => !e.dead && Math.hypot(e.x - c.x, e.z - c.z) < c.r && Math.abs(e.y - c.y) < 1.8);
      if (on && !c.on) { audio.osc({ type: 'sawtooth', f: 100, dur: 0.5, g: 0.06, lp: 900 }); audio.noise({ dur: 0.25, hp: 2500, g: 0.08 }); g.fx.burst(c.x, c.y + 0.3, c.z, { count: 26, color: 0xbfe8ff, speed: 4, size: 0.12, life: 0.4 }); if (c.onClose) c.onClose(st, g); }
      c.on = on;
      const v = c.valve;
      v.warm = on ? Math.min(1, v.warm + dt * 3) : Math.max(0, v.warm - dt / 6);
    }
    // thermals: warm air rising off lit valves lifts Pip
    if (p.state === 'play') for (const v of st.valves) {
      if (!v.thermal || v.warm < 0.05) continue;
      const R = v.r + 1.1, d = Math.hypot(P.x - v.x, P.z - v.z), roof = v.top + v.lift;
      if (d > R || P.y < v.y0 - 0.3 || P.y > roof) continue;
      const k = v.warm * Math.min(1, (roof - P.y) / 2.5);
      V.y += (7 * k - V.y) * Math.min(1, dt * 5) + (V.y < 0 ? 62 : 40) * k * dt;
      if (!p.wishing) { const damp = Math.exp(-3 * k * dt); V.x *= damp; V.z *= damp; }
      p.coyote = 0;
    }
    // preset keys
    const gk = b.grounded && b.ground && b.ground.data && b.ground.data.key;
    if (gk && gk !== st.preset) this.press(st, gk, g);
    for (const k of st.keys) {
      k.down += ((k.id === st.preset ? 1 : 0) - k.down) * Math.min(1, dt * 12);
      k.mv.set(k.x, 9.2 - k.down * 0.55, -4);
      k.tab.position.y = 9.3 - k.down * 0.55;
    }
    // the vanes swing toward the current preset, the low ones first
    const tgt = VANES[st.preset || 'off'];
    st.vanes.forEach((v, i) => {
      const d = tgt(i) - v.a;
      v.a += Math.sign(d) * Math.min(Math.abs(d), dt * (2.6 - i * 0.08));
      v.set(SHAFT[0] + Math.sin(v.a) * VR, v.home.y, SHAFT[1] + Math.cos(v.a) * VR, v.a);
    });
    // the speaker cone pumps on every beat and throws whoever is standing on it
    const beat = music.beat(), bi = Math.floor(beat);
    st.pulse = Math.exp(-(beat - bi) * 7);
    st.speaker.set(-25, 16.55 + st.pulse * 0.35, -12.5);
    if (bi !== st.beat) {
      st.beat = bi;
      if (p.state === 'play' && b.grounded && b.ground === st.speaker.col) {
        p.launch(31);
        audio.bounce(1.5); g.fx.shake(0.18);
        g.fx.ring(-25, 17.3, -12.5, { r0: 1, r1: 7, dur: 0.5, color: 0xffe0b0, alpha: 0.6 });
        g.fx.burst(P.x, P.y, P.z, { count: 18, color: 0xe8d0a0, speed: 3, flatten: 0.2, size: 0.3, life: 0.6, alpha: 0.6 });
      }
    }
  },

  // Arriving: a glance up past the warm valve at the magic eye glowing over everything.
  onArrive(st, opts, g) {
    if (opts.checkpoint === undefined) st.introShot = true;
  },

  introShot(st, g) {
    st.introShot = false;
    g.rig.playShot({ dur: 4.4, blendIn: 0.6, blendOut: 1.6, fov: 58, look: [0, 30, -28], path: (k, out) => out.set(3 - k * 2, 2.5 + k * 3, 28.5 - k * 2) });
  },

  // Out through the dial glass: the camera pulls back and the radio is on a kitchen table.
  outside(st, g) {
    st.wentOut = true;
    music.setDepth(7);
    audio.whoosh(1.6); audio.bell(0, 1, 0.1); audio.bell(4, 1, 0.08);
    g.rig.playShot({ dur: 8, blendIn: 1.6, blendOut: 1.8, fov: 54, look: [0, 18, 20], path: (k, out) => { const e = 1 - Math.pow(1 - k, 2); return out.set(18 + e * 60, 34 + e * 40, -44 - e * 210); } });
  },

  press(st, id, g) {
    if (id === 'C' && !st.v3Done) { audio.thud(); g.fx.burst(st.keys[2].x, 9.9, -4, { count: 8, color: 0xc8b890, speed: 1.5, size: 0.2 }); st.jamT = st.t; return; }
    st.preset = id; st.flagsDirty = true;
    audio.click(); audio.osc({ type: 'square', f: 220, f2: 110, dur: 0.12, g: 0.06, lp: 1200 });
    audio.noise({ dur: 0.9, bp: 1400, f2: 4000, g: 0.05 });
    g.fx.shake(0.12);
  },

  update(st, dt, g) {
    if (st.introShot && g.mode === 'play') this.introShot(st, g);
    if (st.flagsDirty && audio.ctx) { music.setFlags(st.preset ? ['k' + st.preset] : []); st.flagsDirty = false; }
    st.cone.position.y = 16.05 + st.pulse * 0.35;
    st.lever.rotation.z += ((st.v4.always ? -0.6 : 0.6) - st.lever.rotation.z) * Math.min(1, dt * 8);
    // the needle and the magic eye follow the tuning
    const nx = { A: -15, B: 4, C: 17 }[st.preset] ?? -4;
    st.needleX += (nx - st.needleX) * Math.min(1, dt * 2);
    st.needle.position.set(st.needleX, 31.62, -34.5);
    const tuned = st.preset ? 0.12 + 0.05 * Math.sin(st.t * 1.7) : 0.85 + 0.15 * Math.sin(st.t * 3.1);
    const u = st.eye.uniforms; u.uOpen.value += (tuned - u.uOpen.value) * Math.min(1, dt * 3); u.uTime.value = st.t;
    // outside the cabinet the dust haze clears and the kitchen opens up
    const P = g.player.pos, out = st.wentOut && P.z < -29.5 ? 1 : 0;
    st.outside += (out - st.outside) * Math.min(1, dt * 0.8);
    const k = st.outside, fog = g.scene.fog;
    fog.near = 40 + k * 160; fog.far = 150 + k * 1000;
    fog.color.set(0x4a3020).lerp(col(0x1a1828), k);
    g.renderer.setClearColor(fog.color);
    for (const v of st.valves) {
      v.set(v.always ? 0.92 + 0.08 * Math.sin(st.t * 7 + v.x) : v.warm);
      if (v.thermal && v.warm > 0.3 && Math.random() < dt * 14 * v.warm) g.fx.burst(v.x + (Math.random() - 0.5) * 2.4, v.top, v.z + (Math.random() - 0.5) * 2.4, { count: 1, color: 0xffc890, speed: 0.3, up: 4.5, size: 0.14, life: 1.4, drag: 0.5, alpha: 0.5 });
    }
  },
};

function labelTex(text, tab) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 52;
  const x = c.getContext('2d');
  x.fillStyle = '#efe4cc'; x.fillRect(0, 0, 256, 52);
  x.fillStyle = '#' + col(tab).getHexString(); x.fillRect(0, 0, 18, 52);
  x.fillStyle = '#2a1a10'; x.font = 'bold 26px Georgia, serif'; x.textAlign = 'center'; x.fillText(text, 140, 36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
