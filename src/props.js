import * as THREE from 'three';
import { glowSprite, makeGlassMaterial } from './materials.js';

// Animated, non-merged props: checkpoints, pickups, strays. Each returns an Object3D whose
// userData.tick(t, dt, active) animates it.

const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, fog: o.fog ?? true, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? true, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

export function checkpoint(color = 0xffc070) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.7, 6), lambert(0x6a6478));
  pole.position.y = 0.85; g.add(pole);
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), lambert(0x6a6478));
  cross.rotation.z = Math.PI / 2; cross.position.y = 1.45; g.add(cross);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), basic(0x554d60));
  bulb.position.y = 1.78; g.add(bulb);
  const halo = glowSprite(color, 1.6, { opacity: 0 });
  halo.position.y = 1.78; g.add(halo);
  const on = new THREE.Color(color), off = new THREE.Color(0x554d60);
  let lit = 0;
  g.userData.tick = (t, dt, active) => {
    lit += ((active ? 1 : 0) - lit) * Math.min(1, dt * 4);
    bulb.material.color.copy(off).lerp(on, lit);
    halo.material.opacity = lit * (0.75 + 0.25 * Math.sin(t * 3));
  };
  return g;
}

// ---- QSL cards: the postcard a station sends back ----
export function qslTexture(level) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 340;
  const g = c.getContext('2d');
  const card = level.qslColors || ['#efe4cf', '#8a3b2a', '#23303a'];
  g.fillStyle = card[0]; g.fillRect(0, 0, 512, 340);
  g.strokeStyle = card[1]; g.lineWidth = 10; g.strokeRect(14, 14, 484, 312);
  g.lineWidth = 2; g.strokeRect(30, 30, 452, 280);
  // a waveform across the card
  g.beginPath();
  for (let x = 40; x < 472; x += 2) {
    const k = (x - 40) / 432;
    const y = 250 + Math.sin(x * 0.09) * 18 * Math.sin(k * Math.PI) + Math.sin(x * 0.23) * 6;
    x === 40 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.strokeStyle = card[1]; g.lineWidth = 3; g.stroke();
  g.fillStyle = card[2];
  g.font = 'bold 64px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.fillText(level.freq, 256, 120);
  g.font = 'italic 28px Georgia, serif';
  g.fillText(level.name, 256, 170);
  g.font = '18px ui-monospace, Consolas, monospace';
  g.fillText('YOUR RECEPTION REPORT IS CONFIRMED', 256, 300);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function qslCard(level) {
  const g = new THREE.Group();
  const tex = qslTexture(level);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }));
  g.add(front);
  const halo = glowSprite(0xfff0c8, 2.2, { opacity: 0.55 }); g.add(halo);
  g.userData.tick = (t) => {
    front.rotation.y = t * 1.2;
    front.position.y = Math.sin(t * 2) * 0.12;
    front.rotation.z = Math.sin(t * 1.3) * 0.1;
  };
  g.userData.setGhost = (v) => { front.material.opacity = v ? 0.22 : 1; halo.visible = !v; };
  return g;
}

export function harmonic(color = 0xbfe8ff) {
  const g = new THREE.Group();
  const m = makeGlassMaterial(color, { core: 0.35 });
  const prongGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.7, 6);
  const p1 = new THREE.Mesh(prongGeo, m), p2 = new THREE.Mesh(prongGeo, m);
  p1.position.set(-0.13, 0.35, 0); p2.position.set(0.13, 0.35, 0);
  const u = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 6, 12, Math.PI), m);
  u.rotation.z = Math.PI; u.position.y = 0.0;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 6), m);
  stem.position.y = -0.33;
  const fork = new THREE.Group(); fork.add(p1, p2, u, stem);
  g.add(fork);
  const halo = glowSprite(color, 2.4, { opacity: 0.6 }); g.add(halo);
  g.userData.tick = (t) => {
    fork.rotation.y = t * 0.9;
    fork.position.y = Math.sin(t * 1.7) * 0.1;
    const buzz = Math.sin(t * 60) * 0.012;
    p1.position.x = -0.13 - buzz; p2.position.x = 0.13 + buzz;
    m.uniforms.uTime.value = t;
  };
  g.userData.setGhost = (v) => { m.uniforms.uAlpha.value = v ? 0.25 : 1; halo.visible = !v; };
  return g;
}

export function ident(color = 0xffe7a0) {
  const g = new THREE.Group();
  const ringM = makeGlassMaterial(color, { core: 0.5 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 8, 40), ringM);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 32), ringM);
  g.add(ring, ring2);
  // a live waveform stretched across the ring
  const N = 48;
  const wave = new THREE.BufferGeometry();
  wave.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  const line = new THREE.Line(wave, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending }));
  g.add(line);
  const halo = glowSprite(color, 5, { opacity: 0.7 }); g.add(halo);
  g.userData.tick = (t) => {
    ring.rotation.y = t * 0.8; ring2.rotation.x = t * 1.1;
    const p = wave.attributes.position;
    for (let i = 0; i < N; i++) {
      const x = -0.8 + (1.6 * i) / (N - 1);
      const env = Math.cos((x / 0.8) * Math.PI / 2);
      p.setXYZ(i, x, Math.sin(x * 9 + t * 5) * 0.25 * env * (0.6 + 0.4 * Math.sin(t * 2.3)), 0);
    }
    p.needsUpdate = true;
    line.rotation.y = t * 0.8;
    g.position.y = (g.userData.baseY ?? g.position.y) + Math.sin(t * 1.4) * 0.15;
    ringM.uniforms.uTime.value = t;
  };
  g.userData.setGhost = (v) => { ringM.uniforms.uAlpha.value = v ? 0.3 : 1; halo.material.opacity = v ? 0.2 : 0.7; };
  return g;
}

export function abilityPickup(kind) {
  const g = new THREE.Group();
  const m = makeGlassMaterial(kind === 'skip' ? 0xa8f0ff : 0xffb0d8, { core: 0.4 });
  let body;
  if (kind === 'skip') {
    body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 8), m);
    body.scale.set(1, 0.28, 0.8);
  } else {
    const pts = [];
    for (let i = 0; i <= 120; i++) { const a = i * 0.32; pts.push(new THREE.Vector3(Math.cos(a) * 0.3, -0.6 + i * 0.01, Math.sin(a) * 0.3)); }
    body = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.04, 5), m);
  }
  g.add(body);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 32), basic(0xffffff, { transparent: true, additive: true, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; g.add(r); rings.push(r);
  }
  const halo = glowSprite(kind === 'skip' ? 0xa8f0ff : 0xffb0d8, 3.2, { opacity: 0.7 }); g.add(halo);
  g.userData.tick = (t) => {
    body.rotation.y = t * 2;
    body.position.y = Math.sin(t * 2) * 0.12;
    rings.forEach((r, i) => {
      const k = ((t * 0.6 + i / 3) % 1);
      r.scale.setScalar(0.5 + k * 3);
      r.material.opacity = (1 - k) * 0.5;
      r.position.y = -0.6;
    });
    m.uniforms.uTime.value = t;
  };
  g.userData.setGhost = (v) => { m.uniforms.uAlpha.value = v ? 0.25 : 1; halo.visible = !v; rings.forEach((r) => (r.visible = !v)); };
  return g;
}

// ---- Strays: lost sounds with a body ----
export function stray(kind) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const glowC = { morse: 0xfff2a0, foghorn: 0xffb070, crackle: 0x9fe0ff, engaged: 0x7ff0e8, kettle: 0xfff0e0, cuckoo: 0xffc8a0, coda: 0xe0c8ff }[kind] || 0xffffff;
  const eyeM = basic(0x1a1420);
  const eyes = (y, z, sp = 0.09, s = 0.045) => {
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 5), eyeM); e.scale.y = 1.5; e.position.set(sx * sp, y, z); body.add(e); }
  };
  const L = (c) => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 });
  let anim = () => {};
  if (kind === 'morse') {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), L(0xffe9a0)); dot.position.y = 0.45; body.add(dot);
    const dashes = [];
    for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), L(0xffe9a0)); d.rotation.z = Math.PI / 2; d.position.set(0, 0.22 - i * 0.12, -0.1 - i * 0.18); body.add(d); dashes.push(d); }
    eyes(0.5, 0.17);
    const code = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0];
    anim = (t) => { const on = code[Math.floor(t * 6) % code.length]; dot.material.emissiveIntensity = on ? 1 : 0.2; dashes.forEach((d, i) => (d.position.y = 0.22 - i * 0.12 + Math.sin(t * 5 + i) * 0.03)); };
  } else if (kind === 'foghorn') {
    const pts = []; for (let i = 0; i <= 10; i++) { const k = i / 10; pts.push(new THREE.Vector2(0.12 + Math.pow(k, 2.2) * 0.45, k * 0.9)); }
    const horn = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), new THREE.MeshLambertMaterial({ color: 0xd88a4a, emissive: 0x6a2a10, side: THREE.DoubleSide }));
    horn.rotation.x = -Math.PI / 2 + 0.3; horn.position.set(0, 0.45, 0.2); body.add(horn);
    const bod = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), L(0xc47a3e)); bod.scale.set(1, 0.85, 1.2); bod.position.set(0, 0.35, -0.2); body.add(bod);
    for (const [x, z] of [[-0.2, -0.4], [0.2, -0.4], [-0.2, 0.05], [0.2, 0.05]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 5), L(0x8a4a2a)); l.position.set(x, 0.1, z - 0.15); body.add(l); }
    eyes(0.55, 0.05, 0.14, 0.05);
    anim = (t) => { horn.scale.setScalar(1 + Math.max(0, Math.sin(t * 0.9)) * 0.08); };
  } else if (kind === 'crackle') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), L(0x9fe0ff)); core.position.y = 0.45; body.add(core);
    const spikes = [];
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), L(0xd8f4ff));
      const dir = new THREE.Vector3(Math.sin(i * 2.4), Math.cos(i * 1.7), Math.cos(i * 2.4)).normalize();
      s.position.copy(dir.clone().multiplyScalar(0.28)).add(new THREE.Vector3(0, 0.45, 0));
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); body.add(s); spikes.push(s);
    }
    eyes(0.48, 0.18, 0.07, 0.035);
    anim = (t) => { body.position.x = (Math.random() - 0.5) * 0.03; spikes.forEach((s, i) => s.scale.setScalar(0.7 + Math.abs(Math.sin(t * 13 + i * 3.1)) * 0.6)); };
  } else if (kind === 'engaged') {
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 8), L(0x7ff0e8)); a.rotation.z = Math.PI / 2; a.position.y = 0.3; body.add(a);
    const b = a.clone(); b.material = L(0x7ff0e8); b.position.y = 0.62; body.add(b);
    eyes(0.64, 0.15);
    anim = (t) => { const k = Math.floor(t * 2.5) % 2; a.material.emissiveIntensity = k ? 1 : 0.2; b.material.emissiveIntensity = k ? 0.2 : 1; };
  } else if (kind === 'kettle') {
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })); pot.scale.y = 0.85; pot.position.y = 0.33; body.add(pot);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.35, 6), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
    spout.rotation.x = Math.PI / 2.8; spout.position.set(0, 0.45, 0.35); body.add(spout);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), L(0x303030)); lid.position.y = 0.62; body.add(lid);
    eyes(0.4, 0.3);
    anim = (t) => { lid.position.y = 0.62 + Math.max(0, Math.sin(t * 9)) * 0.04 * (Math.sin(t * 0.7) > 0.3 ? 1 : 0); };
  } else if (kind === 'cuckoo') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), L(0x9a6a4a)); b.scale.set(0.9, 1, 1.2); b.position.y = 0.35; body.add(b);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), L(0xa87a52)); head.position.set(0, 0.6, 0.12); body.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), L(0xffc040)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.58, 0.3); body.add(beak);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), L(0x7a4a32)); tail.rotation.x = -Math.PI / 2.4; tail.position.set(0, 0.4, -0.3); body.add(tail);
    eyes(0.66, 0.24, 0.07, 0.03);
    anim = (t) => { head.rotation.x = Math.sin(t * 3) > 0.9 ? -0.4 : 0; };
  } else {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), L(0xe0c8ff)); head.scale.set(1.2, 0.9, 1); head.position.y = 0.25; body.add(head);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 5), L(0xe0c8ff)); stem.position.set(0.2, 0.62, 0); body.add(stem);
    const flag = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 5, 10, Math.PI * 0.8), L(0xe0c8ff)); flag.position.set(0.34, 0.9, 0); flag.rotation.z = -0.8; body.add(flag);
    eyes(0.28, 0.18, 0.08, 0.035);
    anim = (t) => { flag.rotation.z = -0.8 + Math.sin(t * 4) * 0.2; };
  }
  const halo = glowSprite(glowC, 2.2, { opacity: 0.45 }); halo.position.y = 0.4; g.add(halo);
  g.userData.tick = (t) => {
    body.position.y = Math.abs(Math.sin(t * 3)) * 0.12;
    body.rotation.y = Math.sin(t * 0.7) * 0.6;
    anim(t);
  };
  g.userData.setGhost = (v) => { body.visible = !v; halo.material.opacity = v ? 0.15 : 0.45; };
  return g;
}
