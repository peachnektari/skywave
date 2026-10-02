// Smoke test: serves the folder, loads the game in Chromium, loads every level through
// window.__game, and fails on any console error or a frame counter that stops advancing.
// Also checks resize, save/load through localStorage, and audio resuming on first input.
//   npm install && npx playwright install chromium   (once)
//   npm test
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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
try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

const fail = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fail.push(msg); };
const frame = () => page.evaluate(() => window.__game.getState().frame);

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
await page.waitForTimeout(1200);
const fell = await page.evaluate(() => window.__game.getState());
check(fell.grounded && fell.pos.y < 20, 'teleport, gravity and ground contact');

// leaving a level mid-completion must cancel its pending return to the heath
await page.evaluate(() => { window.__game.loadLevel('tide'); window.__game.game.completeLevel('tide'); window.__game.loadLevel('wireless'); });
await page.waitForTimeout(4200);
const stay = await page.evaluate(() => window.__game.getState().level);
check(stay === 'wireless', `level change cancels a pending completion (in ${stay})`);

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
