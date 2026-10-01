import hub from './hub.js';
import tide from './tide.js';
import wireless from './wireless.js';
import hold from './hold.js';
import summer from './summer.js';
import meantime from './meantime.js';
import closedown from './closedown.js';

// Broadcast order and how the heath unlocks them (by idents owned).
export const LEVELS = { hub, tide, wireless, hold, summer, meantime, closedown };
export const ORDER = ['tide', 'wireless', 'hold', 'summer', 'meantime', 'closedown'].filter((id) => LEVELS[id]);
export const UNLOCK = { tide: 0, wireless: 0, hold: 1, summer: 2, meantime: 3, closedown: 5 };

export function isUnlocked(id, save) {
  if (id === 'hub') return true;
  if (save.data.visited[id]) return true;
  return save.identCount() >= (UNLOCK[id] ?? 99);
}
