// Web Audio core: buses, reverb, a feedback delay (the echo), and synthesized SFX
// pitched to the current level's key so nothing clashes with the music.

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], pentatonic: [0, 2, 4, 7, 9], minorPent: [0, 3, 5, 7, 10],
};
export const scaleOf = (name) => SCALES[name] || SCALES.major;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioCore {
  constructor() {
    this.ctx = null;
    this.root = 62; this.scale = SCALES.dorian;
    this.vol = { master: 0.8, music: 0.8, sfx: 0.9 };
    this.listeners = [];
  }

  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.3 * this.vol.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.musicIn = ctx.createGain();
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 18000;
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.55 * this.vol.music;
    this.musicIn.connect(this.muffle).connect(this.musicBus).connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.8 * this.vol.sfx;
    this.sfxBus.connect(this.master);
    // reverb
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.8);
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.32;
    this.verbSend.connect(this.verb).connect(this.master);
    this.musicBus.connect(this.verbSend);
    this.sfxVerb = ctx.createGain(); this.sfxVerb.gain.value = 0.35;
    this.sfxBus.connect(this.sfxVerb).connect(this.verbSend);
    // echo line: the beep literally echoes
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.27;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2600;
    this.delay.connect(dl).connect(fb).connect(this.delay);
    this.echoIn = ctx.createGain(); this.echoIn.gain.value = 0.6;
    this.echoIn.connect(this.delay); dl.connect(this.sfxBus);
    // noise
    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = n;
    for (const f of this.listeners) f();
  }

  onReady(f) { if (this.ctx) f(); else this.listeners.push(f); }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  setVolumes(v) {
    Object.assign(this.vol, v);
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0.3 * this.vol.master, this.t, 0.05);
    this.musicBus.gain.setTargetAtTime(0.55 * this.vol.music, this.t, 0.05);
    this.sfxBus.gain.setTargetAtTime(0.8 * this.vol.sfx, this.t, 0.05);
  }
  setMuffle(k) { if (this.ctx) this.muffle.frequency.setTargetAtTime(18000 * Math.pow(0.03, k), this.t, 0.08); }

  impulse(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return b;
  }

  setKey(root, scaleName) { this.root = root; this.scale = scaleOf(scaleName); }
  deg(d, oct = 0) {
    const s = this.scale, n = s.length;
    const o = Math.floor(d / n), i = ((d % n) + n) % n;
    return mtof(this.root + s[i] + 12 * (o + oct));
  }

  // ---- primitives ----
  osc({ type = 'sine', f = 440, f2, t0 = 0, dur = 0.2, a = 0.005, g = 0.3, dest, detune = 0, lp, bp, hp, curve = 'exp' }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t + t0;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(g, t + a);
    if (curve === 'exp') e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else e.gain.linearRampToValueAtTime(0, t + dur);
    let node = o;
    for (const [kind, fr] of [['lowpass', lp], ['bandpass', bp], ['highpass', hp]]) {
      if (!fr) continue;
      const fl = ctx.createBiquadFilter(); fl.type = kind; fl.frequency.value = fr; if (kind === 'bandpass') fl.Q.value = 3;
      node.connect(fl); node = fl;
    }
    node.connect(e).connect(dest || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
    return e;
  }
  noise({ t0 = 0, dur = 0.2, a = 0.005, g = 0.2, lp, bp, hp, q = 1, f2, dest }) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t + t0;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = bp ? 'bandpass' : hp ? 'highpass' : 'lowpass';
    fl.frequency.setValueAtTime(bp || hp || lp || 2000, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(g, t + a);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(e).connect(dest || this.sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // A positional input for world sounds (strays, entrances, harmonics).
  panner(x, y, z, ref = 6, dest) {
    if (!this.ctx) return null;
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = 200; p.rolloffFactor = 1.6;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    p.connect(dest || this.sfxBus);
    return p;
  }
  setListener(pos, fwd) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
      L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  }

  // ---- SFX ----
  jump(skipN = 0) { this.osc({ type: 'triangle', f: this.deg(4 + skipN * 2, 1), f2: this.deg(7 + skipN * 2, 1), dur: 0.14, g: 0.12 }); }
  land(k = 0.5) {
    this.noise({ dur: 0.08 + k * 0.12, lp: 500 + k * 900, g: 0.08 + k * 0.2 });
    this.osc({ type: 'sine', f: 110 + k * 30, f2: 50, dur: 0.12, g: 0.1 + k * 0.2 });
  }
  step() { this.noise({ dur: 0.035, bp: 2400 + Math.random() * 1400, q: 2, g: 0.035 }); }
  echo() {
    const f = this.deg(0, 2);
    this.osc({ type: 'sine', f, dur: 0.16, a: 0.004, g: 0.2, curve: 'lin' });
    this.osc({ type: 'sine', f, dur: 0.16, a: 0.004, g: 0.25, curve: 'lin', dest: this.echoIn });
    this.osc({ type: 'triangle', f: f / 2, f2: f / 2.2, dur: 0.1, g: 0.06 });
  }
  echoFade() { this.osc({ type: 'sine', f: this.deg(4, 2), dur: 0.7, a: 0.01, g: 0.05 }); this.osc({ type: 'sine', f: this.deg(0, 3), dur: 0.5, a: 0.01, g: 0.03 }); }
  hole() { this.noise({ dur: 0.4, lp: 900, f2: 120, g: 0.2 }); this.osc({ type: 'sine', f: this.deg(0, 0), f2: this.deg(0, -1), dur: 0.5, g: 0.18 }); }
  skip(n) { this.osc({ type: 'sine', f: this.deg(2 + n * 2, 1), f2: this.deg(6 + n * 2, 1), dur: 0.12, g: 0.12 }); this.noise({ dur: 0.1, hp: 3000, g: 0.05 }); }
  splash(k = 0.5) { this.noise({ dur: 0.35 + k * 0.3, lp: 1800, f2: 300, g: 0.12 + k * 0.15 }); }
  lineOn() { this.osc({ type: 'sawtooth', f: this.deg(0, 1), f2: this.deg(7, 1), dur: 0.2, g: 0.05, lp: 2400 }); }
  lineOff() { this.osc({ type: 'sine', f: this.deg(7, 1), f2: this.deg(4, 1), dur: 0.15, g: 0.08 }); }
  checkpoint() { [0, 2, 4].forEach((d, i) => this.osc({ type: 'triangle', f: this.deg(d, 1), t0: i * 0.07, dur: 0.6, g: 0.07 })); }
  pickup(kind) {
    const seq = kind === 'qsl' ? [0, 4, 7, 9] : kind === 'stray' ? [4, 2, 7, 4, 9] : kind === 'harmonic' ? [0, 7, 14] : [0, 2, 4, 7, 9, 11, 14];
    seq.forEach((d, i) => { this.osc({ type: 'sine', f: this.deg(d, 1), t0: i * 0.09, dur: 0.9, g: 0.09 }); this.osc({ type: 'triangle', f: this.deg(d, 2), t0: i * 0.09, dur: 0.4, g: 0.03 }); });
  }
  ident() {
    [0, 4, 7, 11, 14].forEach((d, i) => this.osc({ type: 'sine', f: this.deg(d, 1), t0: i * 0.12, dur: 2.5, g: 0.1 }));
    this.osc({ type: 'sine', f: this.deg(0, -1), dur: 3, a: 0.2, g: 0.15 });
  }
  loseSignal() { this.noise({ dur: 0.5, hp: 400, g: 0.16, a: 0.05 }); this.osc({ type: 'sine', f: this.deg(4, 1), f2: this.deg(0, -1), dur: 0.4, g: 0.1 }); }
  tuneIn() { this.noise({ dur: 0.35, bp: 1500, f2: 5000, g: 0.06 }); this.osc({ type: 'sine', f: this.deg(0, 0), f2: this.deg(0, 1), dur: 0.3, g: 0.08 }); }
  click() { this.osc({ type: 'square', f: 1800, dur: 0.03, g: 0.03, lp: 3000 }); }
  tick(accent = false) { this.noise({ dur: 0.03, hp: accent ? 3000 : 5000, g: accent ? 0.08 : 0.04 }); }
  bell(d = 0, oct = 1, g = 0.12, dest) {
    const f = this.deg(d, oct);
    this.osc({ type: 'sine', f, dur: 2.2, g, dest });
    this.osc({ type: 'sine', f: f * 2.76, dur: 0.9, g: g * 0.3, dest });
  }
  pip(long = false, g = 0.1) { this.osc({ type: 'sine', f: 1000, dur: long ? 0.5 : 0.1, a: 0.003, g, curve: 'lin' }); }
  bounce(k = 1) { this.osc({ type: 'sine', f: 90, f2: 180 + k * 60, dur: 0.18, g: 0.2 }); this.osc({ type: 'triangle', f: this.deg(4, 1), f2: this.deg(11, 1), dur: 0.25, g: 0.06 }); }
  whoosh(k = 1) { this.noise({ dur: 0.6 * k, bp: 600, f2: 2400, q: 0.7, g: 0.08, a: 0.1 }); }
  thud() { this.osc({ type: 'sine', f: 70, f2: 35, dur: 0.4, g: 0.3 }); this.noise({ dur: 0.3, lp: 300, g: 0.15 }); }

  strayCall(kind, dest) {
    const t = { dest };
    switch (kind) {
      case 'morse': [0, 0.12, 0.24, 0.5].forEach((t0, i) => this.osc({ type: 'sine', f: 880, t0, dur: i === 3 ? 0.3 : 0.08, g: 0.06, curve: 'lin', ...t })); break;
      case 'foghorn': this.osc({ type: 'sawtooth', f: 98, f2: 92, dur: 1.4, a: 0.2, g: 0.08, lp: 400, ...t }); break;
      case 'crackle': for (let i = 0; i < 8; i++) this.noise({ t0: Math.random() * 0.4, dur: 0.02, hp: 2000, g: 0.1, ...t }); break;
      case 'engaged': [0, 0.5].forEach((t0) => this.osc({ type: 'sine', f: 425, t0, dur: 0.35, g: 0.05, curve: 'lin', ...t })); break;
      case 'kettle': this.osc({ type: 'sine', f: 1900, f2: 2400, dur: 1.2, a: 0.4, g: 0.03, ...t }); break;
      case 'cuckoo': this.osc({ type: 'sine', f: 740, dur: 0.25, g: 0.08, ...t }); this.osc({ type: 'sine', f: 587, t0: 0.3, dur: 0.35, g: 0.08, ...t }); break;
      default: this.osc({ type: 'triangle', f: this.deg(7, 1), dur: 1, g: 0.06, ...t });
    }
  }
}

export const audio = new AudioCore();
