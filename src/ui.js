import { LEVELS, ORDER, isUnlocked } from './levels/index.js';
import { qslTexture } from './props.js';
import { audio } from './audio.js';

// DOM overlays: title, pause, station select, collection cards, wordless prompts, the
// tuning transition, the hidden debug menu and the ending.

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const KEY = (k, wide) => `<span class="key${wide ? ' wide' : ''}">${k}</span>`;
const GLYPHS = {
  move: () => `<div class="keys">${KEY('W')}<br>${KEY('A')}${KEY('S')}${KEY('D')}</div>`,
  look: () => '<div class="mouse"><i></i></div><span class="arrows">⟷</span>',
  jump: (pad) => (pad ? KEY('A') : KEY('␣', true)),
  echo: (pad) => (pad ? KEY('X') : KEY('E')),
};

export class UI {
  constructor(game) {
    this.g = game;
    const root = this.root = document.getElementById('ui');
    this.title = el('div', 'screen title');
    this.pauseEl = el('div', 'screen pause hidden');
    this.stationsEl = el('div', 'screen stations hidden');
    this.card = el('div', 'card hidden');
    this.levelCard = el('div', 'levelcard');
    this.promptEl = el('div', 'prompt hidden');
    this.debugEl = el('div', 'debug hidden');
    this.fpsEl = el('div', 'fps hidden');
    this.endEl = el('div', 'ending hidden');
    this.tuner = el('div', 'tuner hidden', '<canvas width="96" height="54"></canvas><div class="dial"><div class="ticks"></div><div class="needle"></div></div><div class="station"></div>');
    root.append(this.levelCard, this.promptEl, this.card, this.title, this.pauseEl, this.stationsEl, this.debugEl, this.fpsEl, this.endEl, this.tuner);
    this.tunerCanvas = this.tuner.querySelector('canvas');
    this.needle = this.tuner.querySelector('.needle');
    const ticks = this.tuner.querySelector('.ticks');
    for (let i = 0; i <= 40; i++) ticks.append(el('i', i % 5 ? '' : 'major'));
    this.menuStack = [];
    addEventListener('keydown', (e) => this.menuKey(e));
  }

  // ---------- menus ----------
  menu(container, items) {
    container.querySelectorAll('.menu').forEach((m) => m.remove());
    const box = el('div', 'menu');
    for (const it of items) {
      if (it.slider) {
        const row = el('label', 'slider', `<span>${it.label}</span>`);
        const inp = el('input'); inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.05; inp.value = it.value;
        inp.oninput = () => it.slider(+inp.value);
        row.append(inp); box.append(row); continue;
      }
      const b = el('button', it.disabled ? 'off' : '', it.label);
      b.disabled = !!it.disabled;
      b.onclick = () => { audio.click(); it.action(); };
      b.onmouseenter = () => b.focus();
      box.append(b);
    }
    container.append(box);
    const first = box.querySelector('button:not([disabled])');
    if (first) setTimeout(() => first.focus(), 30);
    return box;
  }
  activeMenu() {
    for (const s of [this.stationsEl, this.pauseEl, this.title]) if (!s.classList.contains('hidden')) return s.querySelector('.menu');
    return null;
  }
  menuKey(e) {
    const m = this.activeMenu();
    if (!m) return;
    const btns = [...m.querySelectorAll('button:not([disabled]), input')];
    const i = btns.indexOf(document.activeElement);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { btns[(i + 1) % btns.length].focus(); audio.click(); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { btns[(i - 1 + btns.length) % btns.length].focus(); audio.click(); e.preventDefault(); }
    else if ((e.code === 'Enter' || e.code === 'Space') && document.activeElement && document.activeElement.tagName === 'BUTTON') { e.preventDefault(); document.activeElement.click(); }
  }

  showTitle() {
    const s = this.g.save;
    this.title.classList.remove('hidden');
    this.title.innerHTML = `<div class="logo"><h1>SKYWAVE</h1><p>The last beep of the midnight time signal has fallen off the air, into the country where old broadcasts go.</p></div>`;
    const items = [];
    if (s.data.started) items.push({ label: 'Continue', action: () => this.g.begin(false) });
    let sure = !s.data.started;
    const again = { label: s.data.started ? 'Begin again' : 'Begin', action: () => {
      if (sure) return this.g.begin(true);
      sure = true;
      const b = [...this.title.querySelectorAll('button')].find((x) => x.textContent === 'Begin again');
      if (b) b.textContent = 'Forget everything Pip found?';
    } };
    items.push(again);
    if (Object.keys(s.data.visited).length) items.push({ label: 'Stations', action: () => this.showStations(() => this.showTitle()) });
    this.menu(this.title, items);
    this.title.append(el('div', 'hint', `${KEY('W')}${KEY('A')}${KEY('S')}${KEY('D')} &nbsp; ${KEY('␣', true)} &nbsp; ${KEY('E')} &nbsp; <span class="mouse small"><i></i></span>`));
  }
  hideTitle() { this.title.classList.add('hidden'); }

  showPause() {
    this.pauseEl.classList.remove('hidden');
    const g = this.g, s = g.save, def = g.world.def;
    const found = (k) => (s.has(def.id, k) ? '●' : '○');
    const secrets = def.id === 'hub' ? '' : `<div class="found">${def.freq} · ${def.name}<br><span title="QSL card">✉ ${found('qsl')}</span> <span title="Stray">♪ ${found('stray')}</span> <span title="Harmonic">⋔ ${found('harmonic')}</span></div>`;
    this.pauseEl.innerHTML = `<h2>Paused</h2>${secrets}`;
    const items = [{ label: 'Resume', action: () => g.setPaused(false) }];
    if (def.id !== 'hub') items.push({ label: 'Return to the heath', action: () => { g.setPaused(false); g.goto('hub', { from: def.id }); } });
    items.push({ label: 'Restart from last aerial', action: () => { g.setPaused(false); g.player.die(true); } });
    items.push({ label: 'Stations', action: () => this.showStations(() => this.showPause()) });
    items.push({ label: 'Music', value: s.data.settings.music, slider: (v) => { s.data.settings.music = v; audio.setVolumes({ music: v }); s.write(); } });
    items.push({ label: 'Effects', value: s.data.settings.sfx, slider: (v) => { s.data.settings.sfx = v; audio.setVolumes({ sfx: v }); s.write(); } });
    items.push({ label: 'Mouse', value: s.data.settings.sens / 2, slider: (v) => { s.data.settings.sens = Math.max(0.1, v * 2); s.write(); } });
    items.push({ label: s.data.settings.invertY ? 'Invert look: on' : 'Invert look: off', action: () => { s.data.settings.invertY = !s.data.settings.invertY; s.write(); this.showPause(); } });
    items.push({ label: 'Title', action: () => { g.setPaused(false); g.toTitle(); } });
    this.menu(this.pauseEl, items);
  }
  hidePause() { this.pauseEl.classList.add('hidden'); this.stationsEl.classList.add('hidden'); }

  showStations(back) {
    const g = this.g;
    this.pauseEl.classList.add('hidden'); this.title.classList.add('hidden');
    this.stationsEl.classList.remove('hidden');
    this.stationsEl.innerHTML = '<h2>Stations</h2>';
    const items = [{ label: '<span class="fq">≈</span> Longwave Heath', action: () => { this.stationsEl.classList.add('hidden'); g.goto('hub'); } }];
    for (const id of ORDER) {
      const d = LEVELS[id];
      const open = isUnlocked(id, g.save) && g.save.data.visited[id];
      const done = g.save.hasIdent(id) ? ' ✓' : '';
      items.push({ label: open ? `<span class="fq">${d.freq}</span> ${d.name}${done}` : '<span class="fq">· · ·</span> <span class="static">▒▒▒▒▒▒▒▒</span>', disabled: !open, action: () => { this.stationsEl.classList.add('hidden'); g.goto(id); } });
    }
    items.push({ label: 'Back', action: () => { this.stationsEl.classList.add('hidden'); back(); } });
    this.menu(this.stationsEl, items);
  }

  // ---------- in-game ----------
  levelTitle(def) {
    this.levelCard.innerHTML = `<span class="fq">${def.freq}</span><span class="nm">${def.name}</span>`;
    this.levelCard.classList.remove('show'); void this.levelCard.offsetWidth; this.levelCard.classList.add('show');
  }

  collected(pk, def) {
    const c = this.card;
    let html = '';
    if (pk.kind === 'qsl') {
      const img = qslTexture(def).image;
      html = `<div class="qsl"></div><p>${def.qsl}</p>`;
      c.innerHTML = html; c.querySelector('.qsl').append(img);
    } else if (pk.kind === 'stray') {
      c.innerHTML = `<h3>${pk.name}</h3><p>${pk.line}</p>`;
    } else if (pk.kind === 'harmonic') {
      const n = this.g.save.count('harmonic');
      c.innerHTML = `<h3>A harmonic</h3><p>The heath's sky will hold one more colour. <span class="dim">${n} of 7</span></p>`;
    } else if (pk.kind === 'ability') {
      const glyph = pk.ability === 'skip' ? `${KEY('␣', true)} ${KEY('␣', true)} ${KEY('␣', true)}` : '〰 ⟶';
      c.innerHTML = `<h3>${pk.ability === 'skip' ? 'Skip' : 'Line'}</h3><p>${pk.line}</p><div class="glyph">${glyph}</div>`;
    }
    c.classList.remove('hidden', 'out'); void c.offsetWidth; c.classList.add('in');
    clearTimeout(this.cardT);
    this.cardT = setTimeout(() => { c.classList.add('out'); }, pk.kind === 'qsl' ? 9000 : 6000);
  }

  prompt(glyph, x, y) {
    const p = this.promptEl;
    if (!glyph) { p.classList.add('hidden'); this.curGlyph = null; return; }
    if (this.curGlyph !== glyph + this.g.input.lastDevice) {
      p.innerHTML = GLYPHS[glyph](this.g.input.lastDevice === 'pad');
      this.curGlyph = glyph + this.g.input.lastDevice;
    }
    p.classList.remove('hidden');
    p.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  // ---------- the tuning transition ----------
  tune(toDef, fromDial, mid) {
    return new Promise((resolve) => {
      const t = this.tuner, cv = this.tunerCanvas, ctx = cv.getContext('2d');
      const img = ctx.createImageData(cv.width, cv.height);
      t.querySelector('.station').innerHTML = `<span class="fq">${toDef.freq}</span> ${toDef.name}`;
      t.classList.remove('hidden', 'out');
      void t.offsetWidth; t.classList.add('in');
      const to = toDef.dial ?? 0.5;
      const t0 = performance.now();
      let midDone = false, stop = false;
      audio.noise({ dur: 1.4, bp: 900, f2: 3200, q: 1.2, g: 0.05, a: 0.3 });
      audio.osc({ type: 'sine', f: 600, f2: 1400, dur: 1.2, g: 0.015, a: 0.3 });
      const frame = () => {
        if (stop) return;
        const e = (performance.now() - t0) / 1000;
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 200 * (0.6 + 0.4 * Math.sin(i * 0.001 + e * 40)); d[i] = v * 0.9; d[i + 1] = v * 0.86; d[i + 2] = v; d[i + 3] = 255; }
        ctx.putImageData(img, 0, 0);
        const k = Math.min(1, e / 1.1);
        const pos = fromDial + (to - fromDial) * (k * k * (3 - 2 * k)) + Math.sin(e * 23) * 0.004 * (1 - k);
        this.needle.style.left = `${pos * 100}%`;
        if (!midDone && e > 0.4) {
          midDone = true;
          Promise.resolve().then(mid).then(() => {
            const wait = Math.max(0, 1150 - (performance.now() - t0));
            setTimeout(() => { t.classList.add('out'); setTimeout(() => { stop = true; t.classList.add('hidden'); t.classList.remove('in', 'out'); resolve(); }, 650); }, wait);
          });
        }
        requestAnimationFrame(frame);
      };
      frame();
    });
  }

  // ---------- debug ----------
  toggleDebug() {
    const d = this.debugEl, g = this.g;
    if (!d.classList.contains('hidden')) { d.classList.add('hidden'); return; }
    d.classList.remove('hidden');
    d.innerHTML = '<b>debug</b>';
    const btn = (label, f) => { const b = el('button', '', label); b.onclick = () => { f(); this.toggleDebug(); this.toggleDebug(); }; d.append(b); };
    btn(`free camera: ${g.rig.free ? 'on' : 'off'}`, () => g.toggleFreeCam());
    btn(`invincible: ${g.player.invincible ? 'on' : 'off'}`, () => { g.player.invincible = !g.player.invincible; });
    btn(`fps: ${this.fpsEl.classList.contains('hidden') ? 'off' : 'on'}`, () => this.fpsEl.classList.toggle('hidden'));
    btn('give skip + line', () => { g.save.giveAbility('skip'); g.save.giveAbility('line'); });
    btn('give all idents', () => { for (const id of ORDER) if (id !== 'closedown') g.save.giveIdent(id); });
    btn('complete this broadcast', () => { if (g.world.def.id !== 'hub') g.completeLevel(g.world.def.id); });
    d.append(el('div', 'sep', 'go to'));
    btn('heath', () => g.goto('hub'));
    for (const id of ORDER) btn(LEVELS[id].name, () => g.goto(id));
    d.append(el('div', 'sep', 'teleport'));
    g.world.checkpoints.forEach((c, i) => btn(`aerial ${i + 1}`, () => g.teleport(c.x, c.y + 0.1, c.z)));
    g.world.pickups.forEach((p) => btn(`${p.kind}${p.id !== p.kind ? ' ' + p.id : ''}`, () => g.teleport(p.x, p.y + 0.3, p.z)));
  }
  fps(v) { if (!this.fpsEl.classList.contains('hidden')) this.fpsEl.textContent = `${v.toFixed(0)} fps · ${this.g.renderer.info.render.calls} calls`; }

  // ---------- ending ----------
  ending(lines, done) {
    const e = this.endEl;
    e.classList.remove('hidden');
    e.innerHTML = '';
    let i = 0;
    const next = () => {
      if (i >= lines.length) { if (done) setTimeout(done, 1200); return; }
      const p = el('p', lines[i].cls || '', lines[i].text);
      e.append(p);
      requestAnimationFrame(() => p.classList.add('show'));
      i++;
      setTimeout(next, lines[i - 1].wait ?? 2600);
    };
    next();
  }
  hideEnding() { this.endEl.classList.add('hidden'); }
}
