// Progress in localStorage. Every read/write is guarded: private windows and blocked
// storage just mean progress lives for this session only.

const KEY = 'skywave.save.v1';

const fresh = () => ({
  idents: {}, secrets: {}, abilities: {}, seen: {}, visited: {},
  resume: null, finished: false, started: false,
  settings: { music: 0.8, sfx: 0.9, sens: 1, invertY: false },
});

export class Save {
  constructor() { this.data = this.read(); }
  read() {
    try {
      const s = localStorage.getItem(KEY);
      if (s) { const d = JSON.parse(s); const f = fresh(); return { ...f, ...d, settings: { ...f.settings, ...(d.settings || {}) } }; }
    } catch (e) { /* storage unavailable */ }
    return fresh();
  }
  write() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ } }
  reset() { const s = this.data.settings; this.data = fresh(); this.data.settings = s; this.write(); }

  hasIdent(id) { return !!this.data.idents[id]; }
  giveIdent(id) { this.data.idents[id] = true; this.write(); }
  identCount() { return Object.keys(this.data.idents).filter((k) => k !== 'closedown').length; }
  has(level, id) { return !!this.data.secrets[level + ':' + id]; }
  collect(level, id) { this.data.secrets[level + ':' + id] = true; this.write(); }
  count(kind) { return Object.keys(this.data.secrets).filter((k) => k.endsWith(':' + kind)).length; }
  giveAbility(a) { this.data.abilities[a] = true; this.write(); }
  visit(level) { if (!this.data.visited[level]) { this.data.visited[level] = true; this.write(); } }
  setResume(level, cp) { this.data.resume = { level, cp }; this.data.started = true; this.write(); }
  seen(key) { return !!this.data.seen[key]; }
  markSeen(key) { if (!this.data.seen[key]) { this.data.seen[key] = true; this.write(); } }
}
