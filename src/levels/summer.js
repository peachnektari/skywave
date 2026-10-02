import * as THREE from 'three';
import { col, place, rock } from '../geometry.js';
import { audio } from '../audio.js';
import { music } from '../music.js';
import { Fragments, dancerShards, rnd, tree, boathouse, garden } from './summerProps.js';

// Which Summer — a request show, settled into a memory: a lake house on a summer evening,
// broken into pieces. Subject: a memory. It only holds together where you pay attention:
// fragments fly into place as Pip comes near, and an echo remembers them after Pip leaves.

const WATER = -3;
const PEACH = 0xf0d0b0, LAV = 0x9a84a8, WOOD = 0xc8987a, CREAM = 0xf2dcc6, TEAL = 0x3e8a8a;

export default {
  id: 'summer',
  name: 'Which Summer',
  freq: '94.6 MHz',
  dial: 0.8,
  qsl: '94.6 MHz. "This next one\'s a request — for Ada, from Tom, who says she\'ll know which summer." Nobody else at the station knew. The record played to the end, and the room stayed exactly as it was.',
  qslColors: ['#f6e2cc', '#c06a5a', '#3a2a40'],
  killY: -26,
  echoLife: 6,
  echoLifeWater: 8,
  palette: { top: PEACH, side: LAV, accent: 0xffcf80, dust: 0xf0d8c0 },
  env: {
    sky: { top: 0x5a4a8a, horizon: 0xffb27a, bottom: 0xc88a84, aurora1: 0xffd0a0, aurora2: 0xb090ff, aurora: 0.12, stars: 0.12, clouds: 0.45, cloudColor: 0xe6a49c, horizonGlow: 0.7, sun: 1, sunDir: [-0.53, 0.06, 0.85], sunColor: 0xffc890 },
    fog: [0xe8b090, 55, 240],
    hemi: [0xffe2cc, 0x7a6a9a, 1.45],
    sun: [0xffc898, 1.25, [-0.45, 0.8, 0.6]],
    rim: 0xff9a70, low: 0x8a78a4, lowY: -14, highY: 2, groove: 0.035,
    motes: { color: 0xffe2a8, count: 260, size: 0.07, opacity: 0.6, drift: [0.12, 0.06, 0.08] },
    echo: 0xfff0d8,
  },
  // A waltz in G: 3/4, so a bar is 12 sixteenths and a phrase is four bars.
  music: {
    bpm: 132, root: 55, scale: 'major', steps: 48,
    layers: [
      { name: 'felt', inst: 'pad', gain: 0.7, cutoff: 700, wave: 'triangle', notes: [[0, [0, 2, 4], 12], [12, [-2, 0, 2], 12], [24, [3, 5, 7], 12], [36, [4, 6, 8], 12]] },
      { name: 'motif', inst: 'musicbox', depth: 1, gain: 0.6, oct: 1, notes: [[0, 4, 4], [4, 7, 4], [8, 6, 4], [12, 4, 8], [20, 2, 4], [24, 3, 4], [28, 5, 4], [32, 4, 4], [36, 2, 8], [44, 1, 4]] },
      { name: 'oom', inst: 'piano', depth: 2, gain: 0.55, notes: [[0, -7, 4], [4, [2, 4], 2], [8, [2, 4], 2], [12, -9, 4], [16, [0, 2], 2], [20, [0, 2], 2], [24, -4, 4], [28, [3, 5], 2], [32, [3, 5], 2], [36, -3, 4], [40, [4, 6], 2], [44, [4, 6], 2]] },
      { name: 'brush', inst: 'brush', depth: 3, gain: 0.5, hits: 'X...x...x...' },
      { name: 'counter', inst: 'piano', depth: 4, gain: 0.45, oct: 1, notes: [[6, 2, 2], [10, 1, 2], [18, 0, 2], [22, -1, 2], [30, 0, 2], [34, 2, 2], [42, 3, 2], [46, 2, 2]] },
      { name: 'bass', inst: 'bass', depth: 5, gain: 0.5, oct: -1, notes: [[0, 0, 10], [12, -2, 10], [24, 3, 10], [36, 4, 10]] },
      { name: 'strings', inst: 'organ', depth: 6, gain: 0.5, notes: [[0, [4, 7], 12], [12, [2, 7], 12], [24, [5, 7], 12], [36, [4, 8], 12]] },
    ],
  },

  build(L, g) {
    const F = new Fragments();
    const st = { t: 0, F, seen: false, openC: false };
    L.water({ x: 0, z: -31, w: 70, d: 58, y: WATER, seg: 64, deep: 0x1c4a5a, shallow: 0x3a8a8c, sky: 0xd89a92, amp: 0.08, freq: 0.2, glint: 0xffe0a0 });

    // ---- the land: pieces of a summer evening hanging in the haze. All shore tops are y=1,
    // four above the lake, so the only ways out of the water are the beach and the boathouse.
    L.plat(0, 1, 25, 34, 18, { t: 10 });            // the lane where the request comes in
    L.plat(0, 1, 2.5, 100, 9, { t: 10 });           // the meadow
    L.ramp(0, -4, -6, 30, 8, 5, '+z', { color: 0xe8cfa8 }); // the beach
    L.plat(-42.5, 1, -23, 15, 42, { t: 10 });       // west shore (the tree)
    L.plat(42.5, 1, -23, 15, 42, { t: 10 });        // east shore (the boathouse)
    L.plat(-3, 1, -64, 94, 8, { t: 10 });           // north bank (the jetty)
    L.block(0, -12, -83, 52, 20, 30, { color: 0xeac6a4, side: 0xd8a890 }); // the bluff, the house on top
    L.solid(-36, -8, -52, 2, 40, 16); L.solid(36, -8, -52, 2, 40, 16); // the lake's far corners
    L.pillar(0, -8, -25, 3, 5.3, { color: 0xd8c09a, seg: 16 });        // the island, a stone's skip off the end of the jetty
    L.spawn(0, 1.05, 30, Math.PI);

    // ---- teach: a path that assembles under your feet
    const path = F.group({ R: 5.5 });
    for (let i = 0; i < 6; i++) F.add(path, (i % 2 ? 0.15 : -0.15), 0.85, 15.3 - i * 1.5, 2.4, 0.3, 1.3, WOOD);
    L.checkpoint(0, 1, 2, { depth: 1 });
    L.checkpoint(-40, 1, -12, { depth: 2 });
    L.checkpoint(40, 1, -12, { depth: 2 });

    // ---- the three secrets: a card in the tree house, the kettle in the boathouse loft,
    // and a tuning fork on the island that only a skipping stone could reach
    tree(L, F, -44, -26);
    L.secret('qsl', 'qsl', -45.6, 11.2, -26);
    boathouse(L);
    L.secret('stray', 'stray', 38.8, 4.2, -23.6, { stray: 'kettle', name: 'The Kettle', line: 'It was just coming to the boil when the song started, and somebody turned it off so they could dance. It has been waiting to whistle ever since.' });
    L.secret('harmonic', 'harmonic', 0, -1.6, -25);
    L.mesh(place(rock(1.3, 1, 5, 0xc0b8a0, 0.5), 1.4, -2.75, -23.8));

    // ---- combine: the old footbridge has faded. Pip can hold a plank it stands on, but only
    // an echo remembers the bridge back — and the far half has to be remembered mid-air.
    const faint = F.group({ mode: 'faint', R: 1.3, inR: 0.5, outR: 0.35, spread: [6, 4, 3] });
    for (let i = 0; i < 12; i++) F.add(faint, -43 + (i % 2 ? 0.1 : -0.1), 0.85, -44.6 - i * 1.15, 2.6, 0.3, 1.0, WOOD);
    L.plat(-43, 1, -58.8, 2.6, 2.4, { t: 0.3, color: WOOD }); // the end that never faded
    for (const sx of [-1, 1]) L.pillar(-43 + sx * 1.4, -6, -57.8, 0.12, 7.4, { color: 0x8a6a62, seg: 6, solid: false });
    L.prompt(-43, 1, -42, 4, 'echo');
    L.checkpoint(-42, 1, -63, { depth: 3 });

    // ---- the shortcut home: the east footbridge comes back once you've stood on the north bank
    const shortcut = F.group({ R: 7, active: () => st.openC, spread: [7, 5, 3] });
    for (let i = 0; i < 14; i++) F.add(shortcut, 43, 0.85, -44.6 - i * 1.15, 2.6, 0.3, 1.0, WOOD);

    // ---- the jetty: planks that come as you walk out, a clear end, and the view from it
    const jetty = F.group({ R: 6, spread: [4, 2.5, 4] });
    for (let i = 0; i < 15; i++) F.add(jetty, (i % 3 - 1) * 0.06, 0.85, -59.5 + i * 1.1, 2.4, 0.3, 1.0, i % 2 ? WOOD : 0xd2a688);
    L.plat(0, 1, -42.6, 3.4, 2.4, { t: 0.4, color: WOOD });
    for (let z = -59; z >= -43; z -= 3.2) for (const sx of [-1, 1]) L.pillar(sx * 1.35, -7, z, 0.14, 8.1, { color: 0x8a6a62, seg: 6, solid: false });
    L.checkpoint(-2.6, 1, -62.5, { depth: 4 });
    L.checkpoint(1.2, 1, -42.3, { depth: 5 });
    const eye = [0.6, 2.9, -46.6], look = [-13, 4.6, -24.5];
    L.camZone(0, 0.5, -42.6, 3.4, 3.5, 2.4, { pos: eye, look });
    L.trigger(0, 0.5, -42.6, 3.4, 3.5, 2.4, { once: true, enter: () => this.remember(st, g) });
    dancerShards(L, eye, look, 0x7a5a8a);

    // ---- subvert: the garden stair only comes back while you back away from it
    const shy = F.group({ mode: 'shy', R: 8, ref: [9, 8, -66.7], inR: 1.6, outR: 2.2, spread: [3, 2.5, 4], active: () => st.seen });
    for (let i = 0; i < 16; i++) F.add(shy, 22 - 0.8 * i - 0.4, 1 + 0.4375 * (i + 1) - 0.3, -66.7, 0.8, 0.6, 2.4, i % 2 ? CREAM : 0xe6ceb6, { away: 1 });
    L.checkpoint(7, 8, -71, { depth: 7 });

    // ---- the house: it comes together around you, all but the lit window, which never left
    const house = F.group({ R: 15, Ry: 14, inR: 1.4, outR: 0.6, spread: [9, 6, 9] });
    const wall = (x, y0, z, w, h, d, c = CREAM) => F.add(house, x, y0 + h / 2, z, w, h, d, c);
    wall(-7.25, 8, -74, 3.5, 4.2, 0.4); wall(-2.6, 8, -74, 2.2, 4.2, 0.4); wall(1.5, 8, -74, 6, 1.3, 0.4); wall(1.5, 11.8, -74, 6, 0.4, 0.4); wall(6.75, 8, -74, 4.5, 4.2, 0.4);
    wall(-4.6, 11.2, -74, 1.8, 1, 0.4);
    for (const x of [-6, 0, 6]) wall(x, 8, -88, 6, 4.2, 0.4, 0xe2c8b2);
    for (const z of [-76.3, -81, -85.7]) { wall(-9, 8, z, 0.4, 4.2, 4.7, 0xe2c8b2); wall(9, 8, z, 0.4, 4.2, 4.7); }
    for (const x of [-6, 0, 6]) for (const s of [-1, 1]) F.add(house, x, 13.6, -81 + s * 3.6, 6.2, 0.35, 7.8, 0x8a6a88, { rx: s * 0.52, solid: false });
    this.kitchen(L, st);
    st.sheets = garden(L, L.world.swayMat);

    F.finish(L);
    return st;
  },

  // The kitchen: a table, two cups, the radio that was playing, and the window.
  kitchen(L, st) {
    L.plat(0, 8.05, -81, 17.6, 13.6, { t: 0.3, color: 0xc89878 });
    L.block(1.5, 9.3, -74, 6, 2.5, 0.12, { glow: true, color: 0xffe6b0, side: 0xffd890, solid: false });
    L.block(1.5, 9.3, -73.8, 0.14, 2.5, 0.1, { color: 0x6a4a52, solid: false });
    L.block(1.5, 10.5, -73.8, 6, 0.12, 0.1, { color: 0x6a4a52, solid: false });
    L.glow(1.5, 10.6, -73.4, 0xffd08a, 10, { opacity: 0.55 });
    L.glow(1.5, 11.4, -80.5, 0xffc878, 4, { opacity: 0.8 });
    L.light(1.5, 11.2, -80.5, 0xffc070, 26, 20);
    L.block(1.5, 8.05, -80.5, 3.2, 0.95, 1.8, { color: 0xb88a6a });
    for (const sx of [-1, 1]) L.block(1.5 + sx * 2.4, 8.05, -80.5, 0.9, 0.55, 0.9, { color: 0xa87a64 });
    L.block(-4, 8.05, -87.1, 8, 1.1, 1.2, { color: 0xe8d4c0 });
    L.block(1.5, 9.0, -80.95, 1.2, 0.72, 0.5, { color: 0x6a3e2e });
    L.block(1.5, 9.12, -80.68, 0.8, 0.22, 0.04, { glow: true, color: 0xffd080, side: 0xffc060, solid: false });
    for (const sx of [-1, 1]) L.pillar(1.5 + sx * 0.9, 9.0, -80.1, 0.1, 0.16, { color: 0xf4ece0, seg: 8, solid: false });
    L.ident(1.5, 10.7, -80.7);
  },

  // The view from the end of the jetty: the shards line up, and the stair up to the house wakes.
  remember(st, g) {
    st.seen = true;
    g.world.depth = Math.max(g.world.depth, 6); music.setDepth(g.world.depth);
    audio.bell(0, 1, 0.09); audio.bell(4, 1, 0.06); audio.bell(7, 2, 0.04);
  },

  onCheckpoint(st, cp) { if (cp.depth >= 3) st.openC = true; },

  fixed(st, dt, g) {
    st.t += dt;
    st.F.update(dt, st.t, g.player.pos, g.world.echoes);
    // the island won't be swum or hopped to: near it the lake carries swimmers and floating
    // echoes away and swallows their jumps. Only a stone moving fast enough to skip gets across.
    const p = g.player, P = p.pos, V = p.vel, away = (x, z) => { const dx = x, dz = z + 25, d = Math.hypot(dx, dz); return d < 11 ? [dx / d * 7 * dt, dz / d * 7 * dt] : null; };
    const skipping = p.has('skip') && Math.hypot(V.x, V.z) >= 7.9;
    if (away(P.x, P.z) && (p.swimming || (!p.body.grounded && V.y < 0 && P.y < WATER + 0.8 && !skipping))) { g.stepInput.jump = false; g.stepInput.action = false; p.buffer = 0; }
    if (p.swimming) { const a = away(P.x, P.z); if (a) { P.x += a[0]; P.z += a[1]; } }
    for (const e of g.world.echoes) if (e.floating) { const a = away(e.x, e.z); if (a) { e.x += a[0]; e.z += a[1]; e.col.moveTo(e.x, e.y, e.z); } }
  },

  update(st, dt, g) {
    const t = st.t;
    st.sheets.forEach((m, i) => { m.rotation.x = Math.sin(t * 1.3 + i * 1.7) * 0.22 + 0.12; m.rotation.y = Math.sin(t * 0.7 + i) * 0.08; });
  },
};
