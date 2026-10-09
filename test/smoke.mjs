// Smoke test: serves the folder, loads the game in Chromium, loads every level through
// window.__game, and fails on any console error or a frame counter that stops advancing.
// Also checks resize, save/load through localStorage, and audio resuming on first input.
//   npm install && npx playwright install chromium   (once)
//   npm test                        (BROWSER=firefox npm test after `npx playwright install firefox`)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    const idx = path.join(p, 'index.html');
    if (fs.existsSync(idx)) { res.writeHead(200, { 'content-type': 'text/html' }); return fs.createReadStream(idx).pipe(res); }
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

let browser;
if (process.env.BROWSER === 'firefox') browser = await firefox.launch();
else try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

const fail = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fail.push(msg); };
const frame = () => page.evaluate(() => window.__game.getState().frame);
// Waits on game time, not the wall clock: a slow or busy browser clamps long frames.
const waitGame = async (sec) => {
  const t = await page.evaluate(() => window.__game.game.time);
  await page.waitForFunction((end) => window.__game.game.time >= end, t + sec, { timeout: 60000 });
};

await page.goto(url);
await page.waitForFunction(() => window.__game && window.__game.getState().frame > 2, null, { timeout: 30000 });
check(true, 'first frame rendered');

const levels = await page.evaluate(() => window.__game.levels());
for (const id of levels) {
  const before = errors.length;
  await page.evaluate((l) => window.__game.loadLevel(l), id);
  const f0 = await frame();
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => window.__game.getState());
  check(st.level === id, `${id}: loaded`);
  check(st.frame > f0 + 10, `${id}: frames advancing (${st.frame - f0} in 1.5 s, ${Math.round(st.fps)} fps)`);
  check(Number.isFinite(st.pos.y) && st.pos.y > -100, `${id}: player placed (${st.pos.x.toFixed(1)}, ${st.pos.y.toFixed(1)}, ${st.pos.z.toFixed(1)})`);
  check(errors.length === before, `${id}: no console errors`);
}

// teleport + getState
await page.evaluate(() => { window.__game.loadLevel('hub'); window.__game.teleport(0, 20, 60); });
await waitGame(2);
const fell = await page.evaluate(() => window.__game.getState());
check(fell.grounded && fell.pos.y < 20, 'teleport, gravity and ground contact');

// leaving a level mid-completion must cancel its pending return to the heath
await page.evaluate(() => { window.__game.loadLevel('tide'); window.__game.game.completeLevel('tide'); window.__game.loadLevel('wireless'); });
await page.waitForTimeout(4200);
const stay = await page.evaluate(() => window.__game.getState().level);
check(stay === 'wireless', `level change cancels a pending completion (in ${stay})`);

// no pausing mid-completion (the timer would carry on behind the menu)
const midPause = await page.evaluate(() => { const g = window.__game.game; window.__game.loadLevel('tide'); g.completeLevel('tide'); g.setPaused(true); const m = g.mode; window.__game.loadLevel('hub'); return m; });
check(midPause === 'play', `pause is ignored during a completion shot (mode ${midPause})`);

// leaving Close Down before the ending plays must not cost the ending
const finalIdent = await page.evaluate(() => { const g = window.__game.game; window.__game.loadLevel('closedown'); g.completeLevel('closedown'); window.__game.loadLevel('closedown'); return window.__game.pickups().find((p) => p.kind === 'ident').taken; });
check(finalIdent === false, 'the hour stays collectable until the ending has played');

// heath cutscenes belong to the heath: leaving mid-sequence must not drag the camera along
await page.evaluate(() => { const g = window.__game.game; g.save.giveIdent('tide'); g.justCompleted = 'tide'; window.__game.loadLevel('hub', { from: 'tide' }); });
await page.waitForTimeout(300);
await page.evaluate(() => window.__game.loadLevel('wireless'));
await waitGame(6); // past the Wireless intro shot (4.4), inside a leaked door shot (4.2-7.8)
const leak = await page.evaluate(() => { const g = window.__game.game; return { shot: !!g.rig.shot, state: g.player.state }; });
check(!leak.shot && leak.state === 'play', `hub lamp sequence stops when the level changes (shot ${leak.shot}, ${leak.state})`);

// camera shots hold still while paused
const held = await page.evaluate(async () => {
  const g = window.__game.game;
  g.rig.playShot({ dur: 3, pos: [0, 10, 0] }); g.setPaused(true);
  await new Promise((r) => setTimeout(r, 500));
  const t = g.rig.shot ? g.rig.shot.t : -1; g.setPaused(false); g.rig.shot = null; return t;
});
check(held >= 0 && held < 0.1, `camera shot is frozen while paused (t ${held.toFixed(2)})`);

// before any input there is no audio at all: the beat still runs at the level's tempo
const tempo = await page.evaluate(async () => {
  const { music } = await import('/src/music.js'), { audio } = await import('/src/audio.js');
  window.__game.loadLevel('wireless');
  const b0 = music.beat(), t0 = performance.now();
  await new Promise((r) => setTimeout(r, 1000));
  return { noCtx: !audio.ctx, bps: (music.beat() - b0) / ((performance.now() - t0) / 1000) };
});
check(tempo.noCtx && Math.abs(tempo.bps - 108 / 60) < 0.2, `beat follows The Wireless at 108 bpm with no audio (${tempo.bps.toFixed(2)} beats/s)`);

// a gamepad can drive the menus: D-pad moves focus, A presses
const padNav = await page.evaluate(async () => {
  const g = window.__game.game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = { index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
  navigator.getGamepads = () => [pad];
  const tap = async (i) => { pad.buttons[i].pressed = true; await wait(100); pad.buttons[i].pressed = false; await wait(100); };
  g.setPaused(true); await wait(150);
  const btns = () => [...g.ui.pauseEl.querySelectorAll('button:not([disabled])')];
  const i0 = btns().indexOf(document.activeElement);
  await tap(13); const i1 = btns().indexOf(document.activeElement);
  await tap(12); await tap(0);
  delete navigator.getGamepads;
  return { i0, i1, mode: g.mode };
});
check(padNav.i1 === padNav.i0 + 1 && padNav.mode === 'play', `gamepad navigates and presses menu buttons (${JSON.stringify(padNav)})`);

// resize
await page.setViewportSize({ width: 800, height: 900 });
await page.waitForTimeout(300);
const size = await page.evaluate(() => [innerWidth, document.querySelector('canvas').clientWidth]);
check(size[0] === size[1], 'canvas follows resize');

// audio resumes on first input
await page.keyboard.press('KeyW');
await page.waitForTimeout(300);
const audioState = await page.evaluate(() => import('/src/audio.js').then((m) => m.audio.ctx && m.audio.ctx.state));
check(audioState === 'running', `audio context running after first input (${audioState})`);

// a first input that can't unlock audio (gamepad, touchstart) leaves it suspended: the beat must
// still keep time, and any later key or click must resume it
await page.evaluate(() => import('/src/audio.js').then((m) => m.audio.ctx.suspend()));
await page.evaluate(() => window.__game.loadLevel('wireless'));
const beat = () => page.evaluate(() => import('/src/music.js').then((m) => m.music.beat()));
const b0 = await beat();
await page.waitForTimeout(800);
const b1 = await beat();
check(b1 > b0 + 0.3, `beat keeps time while audio is suspended (+${(b1 - b0).toFixed(2)})`);
await page.keyboard.press('KeyD');
await page.waitForTimeout(300);
const resumed = await page.evaluate(() => import('/src/audio.js').then((m) => m.audio.ctx.state));
check(resumed === 'running', `a later input resumes suspended audio (${resumed})`);

// save survives a reload
await page.evaluate(() => { window.__game.game.save.collect('hub', 'qsl'); });
await page.reload();
await page.waitForFunction(() => window.__game && window.__game.getState().frame > 2);
const saved = await page.evaluate(() => window.__game.getState().secrets);
check(saved['hub:qsl'] === true, 'progress persists in localStorage');
await page.evaluate(() => localStorage.clear());

check(errors.length === 0, `no console errors overall${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
server.close();
console.log(fail.length ? `\n${fail.length} check(s) failed` : '\nall checks passed');
process.exit(fail.length ? 1 : 0);
