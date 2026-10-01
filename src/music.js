import { audio, mtof, scaleOf } from './audio.js';

// A small look-ahead sequencer. A track is {bpm, root, scale, steps, layers:[...]}, steps in
// 16ths. A layer is {inst, depth, until?, gain, oct?, len?, notes:[[step, deg|[degs], len, vel?]]}
// or {inst, hits:'x...x...'} for percussion. Layers fade in as the level's depth rises.

function shape(ctx, g, t, a, peak, hold, rel) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(0.0001, t + a + hold, rel);
}
function osc(ctx, type, f, t, stop, dest, detune = 0) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
  o.connect(dest); o.start(t); o.stop(stop);
  return o;
}
function noiseSrc(ctx, t, stop, dest) {
  const s = ctx.createBufferSource(); s.buffer = audio.noiseBuf; s.loop = true;
  s.connect(dest); s.start(t, Math.random()); s.stop(stop);
  return s;
}
function filt(ctx, type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }

export const INST = {
  pad(ctx, t, f, d, v, out, p) {
    const g = ctx.createGain(), lp = filt(ctx, 'lowpass', p.cutoff ?? 900);
    lp.connect(g).connect(out);
    for (const det of [-8, 8]) osc(ctx, p.wave ?? 'sawtooth', f, t, t + d + 3, lp, det);
    shape(ctx, g, t, p.attack ?? 0.9, v * 0.07, d, 0.6);
  },
  bass(ctx, t, f, d, v, out) {
    const g = ctx.createGain(), lp = filt(ctx, 'lowpass', 700);
    lp.connect(g).connect(out);
    osc(ctx, 'triangle', f, t, t + d + 1, lp); osc(ctx, 'sine', f / 2, t, t + d + 1, lp);
    shape(ctx, g, t, 0.01, v * 0.28, d * 0.8, 0.08);
  },
  pluck(ctx, t, f, d, v, out, p) {
    const g = ctx.createGain(), lp = filt(ctx, 'lowpass', 4000, 2);
    lp.frequency.setValueAtTime(p.bright ?? 3500, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.25);
    lp.connect(g).connect(out);
    osc(ctx, p.wave ?? 'triangle', f, t, t + 1.2, lp);
    shape(ctx, g, t, 0.004, v * 0.16, 0.02, 0.18);
  },
  marimba(ctx, t, f, d, v, out) {
    const g = ctx.createGain(); g.connect(out);
    osc(ctx, 'sine', f, t, t + 1, g);
    const g2 = ctx.createGain(); g2.gain.value = 0.12; g2.connect(g); osc(ctx, 'sine', f * 4, t, t + 0.3, g2);
    shape(ctx, g, t, 0.003, v * 0.2, 0.01, 0.13);
  },
  bell(ctx, t, f, d, v, out) {
    const g = ctx.createGain(); g.connect(out);
    osc(ctx, 'sine', f, t, t + 3, g);
    const g2 = ctx.createGain(); g2.gain.value = 0.25; g2.connect(g); osc(ctx, 'sine', f * 2.76, t, t + 1.5, g2);
    const g3 = ctx.createGain(); g3.gain.value = 0.1; g3.connect(g); osc(ctx, 'sine', f * 5.4, t, t + 0.8, g3);
    shape(ctx, g, t, 0.003, v * 0.12, 0.01, 0.6);
  },
  lead(ctx, t, f, d, v, out, p) {
    const g = ctx.createGain(), lp = filt(ctx, 'lowpass', p.cutoff ?? 2200);
    lp.connect(g).connect(out);
    const o = osc(ctx, p.wave ?? 'triangle', f, t, t + d + 1, lp);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * 0.006;
    lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + d + 1);
    shape(ctx, g, t, 0.03, v * 0.11, d * 0.85, 0.12);
    if (p.echo) g.connect(audio.echoIn);
  },
  brass(ctx, t, f, d, v, out) {
    const g = ctx.createGain(), bp = filt(ctx, 'bandpass', 1100, 1.2), lp = filt(ctx, 'lowpass', 2400);
    bp.connect(lp).connect(g).connect(out);
    osc(ctx, 'sawtooth', f, t, t + d + 1, bp);
    shape(ctx, g, t, 0.035, v * 0.2, d * 0.8, 0.1);
  },
  organ(ctx, t, f, d, v, out) {
    const g = ctx.createGain(); g.connect(out);
    [[1, 1], [2, 0.45], [3, 0.2], [4, 0.1]].forEach(([m, a]) => { const h = ctx.createGain(); h.gain.value = a; h.connect(g); osc(ctx, 'sine', f * m, t, t + d + 1.5, h); });
    shape(ctx, g, t, 0.05, v * 0.06, d, 0.25);
  },
  musicbox(ctx, t, f, d, v, out) {
    const g = ctx.createGain(); g.connect(out);
    osc(ctx, 'sine', f, t, t + 2, g);
    const g2 = ctx.createGain(); g2.gain.value = 0.18; g2.connect(g); osc(ctx, 'sine', f * 3, t, t + 1, g2);
    shape(ctx, g, t, 0.002, v * 0.13, 0.01, 0.4);
  },
  piano(ctx, t, f, d, v, out) {
    const g = ctx.createGain(), lp = filt(ctx, 'lowpass', 2000);
    lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.2);
    lp.connect(g).connect(out);
    osc(ctx, 'triangle', f, t, t + 3, lp);
    const g2 = ctx.createGain(); g2.gain.value = 0.3; g2.connect(lp); osc(ctx, 'sine', f * 2, t, t + 1.5, g2);
    shape(ctx, g, t, 0.004, v * 0.16, 0.02, 0.55);
  },
  hum(ctx, t, f, d, v, out) {
    const g = ctx.createGain(); g.connect(out);
    osc(ctx, 'sine', f, t, t + d + 3, g); const g2 = ctx.createGain(); g2.gain.value = 0.3; g2.connect(g); osc(ctx, 'triangle', f * 2, t, t + d + 3, g2);
    shape(ctx, g, t, 1.2, v * 0.12, d, 0.8);
  },
  wind(ctx, t, f, d, v, out) {
    const g = ctx.createGain(), bp = filt(ctx, 'bandpass', f, 1.5);
    bp.frequency.setValueAtTime(f * 0.6, t); bp.frequency.linearRampToValueAtTime(f * 1.6, t + d * 0.5); bp.frequency.linearRampToValueAtTime(f * 0.7, t + d);
    bp.connect(g).connect(out);
    noiseSrc(ctx, t, t + d + 2, bp);
    shape(ctx, g, t, d * 0.4, v * 0.12, d * 0.2, d * 0.2);
  },
  kick(ctx, t, f, d, v, out) {
    const g = ctx.createGain(); g.connect(out);
    const o = osc(ctx, 'sine', 110, t, t + 0.4, g); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    shape(ctx, g, t, 0.003, v * 0.35, 0.02, 0.08);
  },
  tick(ctx, t, f, d, v, out) {
    const g = ctx.createGain(), hp = filt(ctx, 'highpass', 6500); hp.connect(g).connect(out);
    noiseSrc(ctx, t, t + 0.1, hp); shape(ctx, g, t, 0.001, v * 0.1, 0.005, 0.01);
  },
  brush(ctx, t, f, d, v, out) {
    const g = ctx.createGain(), bp = filt(ctx, 'bandpass', 3000, 0.8); bp.connect(g).connect(out);
    noiseSrc(ctx, t, t + 0.4, bp); shape(ctx, g, t, 0.02, v * 0.07, 0.03, 0.06);
  },
  snare(ctx, t, f, d, v, out) {
    const g = ctx.createGain(), bp = filt(ctx, 'bandpass', 1800, 0.9); bp.connect(g).connect(out);
    noiseSrc(ctx, t, t + 0.4, bp); shape(ctx, g, t, 0.002, v * 0.12, 0.02, 0.05);
  },
  crackle(ctx, t, f, d, v, out) {
    const g = ctx.createGain(), hp = filt(ctx, 'highpass', 2500); hp.connect(g).connect(out);
    noiseSrc(ctx, t, t + 0.05, hp); shape(ctx, g, t, 0.001, v * 0.05 * Math.random(), 0.004, 0.006);
  },
  pip(ctx, t, f, d, v, out) {
    const g = ctx.createGain(); g.connect(out);
    osc(ctx, 'sine', 1000, t, t + d + 0.1, g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.06, t + 0.004);
    g.gain.setValueAtTime(v * 0.06, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.01);
  },
};

class Track {
  constructor(def, dest, filterLayers) {
    const ctx = audio.ctx;
    this.def = def;
    this.stepDur = 60 / def.bpm / 4;
    this.len = def.steps ?? 64;
    this.scale = scaleOf(def.scale);
    this.out = ctx.createGain(); this.out.gain.value = 0.0001; this.out.connect(dest);
    this.out.gain.setTargetAtTime(def.gain ?? 1, ctx.currentTime, 0.5);
    this.layers = def.layers
      .filter((L) => !filterLayers || filterLayers.includes(L.name))
      .map((L) => {
        const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(this.out);
        const byStep = new Map();
        for (const n of L.notes || []) { if (!byStep.has(n[0])) byStep.set(n[0], []); byStep.get(n[0]).push(n); }
        return { ...L, g, byStep, on: false };
      });
    this.t0 = Math.ceil(ctx.currentTime / (this.stepDur * 16)) * this.stepDur * 16 + 0.05;
    if (def.syncTo) this.t0 = def.syncTo.t0;
    this.step = Math.max(0, Math.floor((ctx.currentTime - this.t0) / this.stepDur) + 1);
    this.depth = -1;
    this.flags = new Set();
    this.setDepth(filterLayers ? 99 : 0);
  }
  hz(deg, oct = 0) {
    const s = this.scale, n = s.length;
    const o = Math.floor(deg / n), i = ((deg % n) + n) % n;
    return mtof(this.def.root + s[i] + 12 * (o + oct));
  }
  setDepth(d, force = false) {
    if (d === this.depth && !force) return;
    this.depth = d;
    const now = audio.t;
    for (const L of this.layers) {
      const on = d >= (L.depth ?? 0) && (L.until === undefined || d < L.until) && (!L.flag || this.flags.has(L.flag));
      L.on = on;
      L.g.gain.setTargetAtTime(on ? (L.gain ?? 0.8) : 0.0001, now, on ? 1.2 : 1.8);
    }
  }
  schedule(until) {
    const ctx = audio.ctx;
    while (this.t0 + this.step * this.stepDur < until) {
      const time = this.t0 + this.step * this.stepDur;
      if (time >= ctx.currentTime - 0.01) {
        for (const L of this.layers) {
          if (!L.on) continue;
          const s = this.step % (L.len ?? this.len);
          const inst = INST[L.inst];
          if (L.hits) {
            const ch = L.hits[s % L.hits.length];
            if (ch !== '.' && ch !== ' ') inst(ctx, time, 0, 0.1, ch === 'X' ? 1.3 : 0.8, L.g, L);
          } else {
            const evs = L.byStep.get(s);
            if (!evs) continue;
            for (const [, deg, len, vel = 1] of evs) {
              const degs = Array.isArray(deg) ? deg : [deg];
              for (const dg of degs) inst(ctx, time, this.hz(dg, L.oct ?? 0), len * this.stepDur, vel, L.g, L);
            }
          }
        }
      }
      this.step++;
    }
  }
  beatAt(t) { return (t - this.t0) / (this.stepDur * 4); }
  stop(fade = 1.5) {
    this.out.gain.setTargetAtTime(0.0001, audio.t, fade / 3);
    this.dead = audio.t + fade * 1.5;
  }
}

export class Music {
  constructor() {
    this.main = null;
    this.tracks = [];
    this.spatials = [];
    setInterval(() => this.pump(), 40);
  }
  pump() {
    if (!audio.ctx || audio.ctx.state !== 'running') return;
    const until = audio.t + 0.25;
    this.tracks = this.tracks.filter((tr) => {
      if (tr.dead && audio.t > tr.dead) { tr.out.disconnect(); return false; }
      tr.schedule(until);
      return true;
    });
  }
  play(def) {
    if (!audio.ctx) { this.pending = def; return; }
    if (this.main && this.main.def === def && !this.main.dead) return;
    if (this.main) this.main.stop(1.6);
    this.main = def ? new Track(def, audio.musicIn) : null;
    if (this.main) { audio.setKey(def.root, def.scale); this.tracks.push(this.main); }
  }
  resumePending() { if (this.pending) { const d = this.pending; this.pending = null; this.play(d); } }
  setDepth(d) { if (this.main) this.main.setDepth(d); }
  // Layers with a `flag` only play while that flag is set (the heath quotes idents you own).
  setFlags(flags) { if (this.main) { this.main.flags = new Set(flags); this.main.setDepth(this.main.depth, true); } }
  // A copy of a track's chosen layers playing from a point in the world.
  spatial(def, layers, x, y, z, ref = 7) {
    if (!audio.ctx) return null;
    const p = audio.panner(x, y, z, ref, audio.musicIn);
    const tr = new Track({ ...def, gain: def.spatialGain ?? 0.9 }, p, layers);
    this.tracks.push(tr); this.spatials.push(tr);
    return tr;
  }
  stopSpatials() { for (const tr of this.spatials) tr.stop(0.8); this.spatials = []; }
  // Beat position of the main track (for things that move with the music).
  beat() { return this.main ? this.main.beatAt(audio.t) : performance.now() / 1000; }
  get bpm() { return this.main ? this.main.def.bpm : 60; }
}

export const music = new Music();
