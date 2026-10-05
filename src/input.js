// Keyboard first, mouse for camera, gamepad if present. Edges are latched until consumed.

const MOVE = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const JUMP = new Set(['Space']);
const ACTION = new Set(['KeyE', 'ShiftLeft', 'ShiftRight', 'KeyK']);
const PAUSE = new Set(['Escape', 'KeyP']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.edges = new Set();
    this.lookX = 0; this.lookY = 0;
    this.locked = false;
    this.enabled = true;
    this.virtual = null; // {x, z, jump, action} — used by automated tests
    this.lastDevice = 'keyboard';
    this.padPrev = [];
    this.onFirstGesture = null;
    this.onGesture = null; // every gesture: audio may have been created suspended
    this.anyKeyHandlers = [];

    addEventListener('keydown', (e) => {
      this.gesture();
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.edges.add(e.code);
      this.down.add(e.code);
      this.lastDevice = 'keyboard';
      for (const h of this.anyKeyHandlers) h(e);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    addEventListener('mousedown', () => this.gesture());
    addEventListener('touchstart', () => this.gesture(), { passive: true });
    addEventListener('touchend', () => this.gesture());
    canvas.addEventListener('mousedown', () => {
      if (this.enabled && !this.locked && canvas.requestPointerLock) {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      }
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookX += e.movementX; this.lookY += e.movementY;
      this.lastDevice = 'mouse';
    });
  }

  gesture() {
    if (this.onFirstGesture) { const f = this.onFirstGesture; this.onFirstGesture = null; f(); }
    if (this.onGesture) this.onGesture();
  }
  releasePointer() { if (this.locked) document.exitPointerLock(); }

  pressed(code) { return this.edges.has(code); }
  anyPressed(set) { for (const c of set) if (this.edges.has(c)) return true; return false; }

  // Called once per rendered frame; returns a snapshot and clears edges.
  poll(dt) {
    let x = 0, z = 0;
    for (const code in MOVE) if (this.down.has(code)) { x += MOVE[code][0]; z += MOVE[code][1]; }
    let jumpHeld = this.down.has('Space');
    let jump = this.anyPressed(JUMP);
    let action = this.anyPressed(ACTION);
    let pause = this.anyPressed(PAUSE);
    let lookX = this.lookX * 0.0024, lookY = this.lookY * 0.0024;
    this.lookX = 0; this.lookY = 0;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      const ax = dz(p.axes[0] || 0), az = dz(p.axes[1] || 0);
      const rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
      if (ax || az) { x += ax; z -= az; this.lastDevice = 'pad'; }
      lookX += rx * 2.6 * dt; lookY += ry * 1.8 * dt;
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const prev = this.padPrev[p.index] || [];
      const edge = (i) => b(i) && !prev[i];
      if (b(0)) jumpHeld = true;
      if (edge(0)) { jump = true; this.gesture(); }
      if (edge(1) || edge(2)) action = true;
      if (edge(9)) pause = true;
      this.padPrev[p.index] = p.buttons.map((q) => q.pressed);
      // menus listen to keys, so the pad speaks keys to them
      const key = (code) => { const e = { code, repeat: false, preventDefault() {} }; for (const h of this.anyKeyHandlers) h(e); };
      if (edge(12)) key('ArrowUp'); if (edge(13)) key('ArrowDown'); if (edge(0)) key('Enter');
    }

    if (this.virtual) {
      const v = this.virtual;
      x = v.x || 0; z = v.z || 0; jumpHeld = !!v.jump;
      jump = !!v.jump && !v._jumpWas; v._jumpWas = !!v.jump;
      action = !!v.action && !v._actWas; v._actWas = !!v.action;
    }

    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    const snap = {
      x, z, jump, jumpHeld, action, pause, lookX, lookY,
      debug: this.pressed('Backquote'),
      edges: new Set(this.edges),
    };
    this.edges.clear();
    if (!this.enabled) { snap.x = snap.z = 0; snap.jump = snap.jumpHeld = snap.action = false; }
    return snap;
  }
}
