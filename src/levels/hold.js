// Development stub, replaced by the real broadcast.
export default {
  id: 'hold', name: 'Please Hold', freq: '1215 kHz', dial: 0.55, qsl: '', palette: { top: 0x888888, side: 0x555555, accent: 0xffc070 },
  env: { sky: {}, fog: [0x202020, 30, 120], hemi: [0xffffff, 0x333333, 1.2], sun: [0xffffff, 1, [0.4, 1, 0.3]] },
  music: { bpm: 80, root: 60, scale: 'major', steps: 16, layers: [{ name: 'motif', inst: 'pluck', notes: [[0, 0, 2], [4, 2, 2], [8, 4, 2]] }] },
  build(L) { L.spawn(0, 0, 0, Math.PI); L.plat(0, 0, -6, 12, 20); L.ident(0, 1.2, -14); },
};
