import * as THREE from 'three';
import { cylinder, place, paint, col, shade, chamferBox, tube } from '../geometry.js';
import { makeGlassMaterial } from '../materials.js';

// Set pieces for The Wireless: valves, the speaker, the magic eye, the dial glass and the
// kitchen the set is standing in.

const AMBER = 0xffa040;

// A valve on its socket. Solid glass envelope you can stand on; warm ones heat the air above.
export function valve(L, x, y0, z, r, h, o = {}) {
  L.mesh(place(cylinder(r + 0.45, r + 0.55, 0.8, 16, 0x2a2420, 0x1a1612), x, y0, z));
  // electrodes inside the glass: anode plates, mica spacers, a silver getter at the top
  L.mesh(place(chamferBox(r * 1.1, h * 0.55, r * 0.55, 0.05, 0x8a8a90, 0x5a5a60), x, y0 + 0.8 + h * 0.32, z));
  for (const k of [0.12, 0.62]) L.mesh(place(cylinder(r * 0.85, r * 0.85, 0.08, 12, 0xe8e0d0, 0xc8c0b0), x, y0 + 0.8 + h * k, z));
  L.mesh(place(paint(new THREE.SphereGeometry(r * 0.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xb8b8c8), x, y0 + h - r * 0.2, z));
  const glass = new THREE.Group();
  const gm = makeGlassMaterial(o.glass ?? 0xffe8c8, { core: 0.06 });
  glass.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h - r, 20, 1, true).translate(0, 0.8 + (h - r) / 2, 0), gm));
  glass.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.8 + h - r, 0), gm));
  glass.position.set(x, y0, z);
  L.root.add(glass);
  const glow = L.glow(x, y0 + 0.8 + h * 0.32, z, AMBER, r * 5, { opacity: 0 });
  const core = L.glow(x, y0 + 0.8 + h * 0.32, z, 0xffd8a0, r * 1.6, { opacity: 0 });
  L.solid(x, y0, z, r * 1.5, h + 0.8, r * 1.5);
  const v = {
    x, z, y0, top: y0 + h + 0.8, r, lift: o.lift ?? 7, warm: o.warm ?? 0, always: !!o.always, thermal: o.thermal !== false, gm,
    set(w) {
      this.warm = w;
      glow.material.opacity = 0.15 + w * 0.75;
      core.material.opacity = w * 0.9;
      gm.uniforms.uColor.value.set(0xffe8c8).lerp(col(0xffb060), w);
    },
  };
  v.set(v.warm);
  return v;
}

// Brass terminal posts with a copper lead running to a valve.
export function terminals(L, ax, ay, az, bx, by, bz, toX, toY, toZ) {
  for (const [x, y, z] of [[ax, ay, az], [bx, by, bz]]) {
    L.mesh(place(cylinder(0.22, 0.28, 0.35, 10, 0xd8b060, 0x8a6a30), x, y, z));
    L.mesh(place(cylinder(0.12, 0.12, 0.55, 8, 0xe8c880, 0x9a7a40), x, y, z));
    L.mesh(tube([new THREE.Vector3(x, y + 0.08, z), new THREE.Vector3((x + toX) / 2, y + 0.08, (z + toZ) / 2), new THREE.Vector3(toX, toY + 0.3, toZ)], 0.06, 0xc87a3a, 5));
  }
}

// The magic-eye tuning indicator: a green fan that closes as the set comes into tune.
export function magicEye(L, x, y, z, r) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpen: { value: 0.9 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uOpen, uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = abs(atan(p.x, p.y));
        float disc = smoothstep(1.0, 0.94, r);
        float ring = smoothstep(0.28, 0.34, r) * disc;
        float wedge = smoothstep(uOpen * 1.2 + 0.02, uOpen * 1.2 - 0.04, a);
        float fan = ring * (1.0 - wedge) * (0.75 + 0.25 * r) * (0.92 + 0.08 * sin(uTime * 9.0));
        vec3 c = vec3(0.32, 1.0, 0.5) * fan + vec3(0.05, 0.12, 0.07) * disc + vec3(0.6, 0.9, 0.7) * smoothstep(0.3, 0.15, r) * 0.25;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  L.mesh(place(cylinder(r + 0.5, r + 0.7, 0.8, 24, 0x1a1612, 0x2a2420), x, y, z - 0.4, 0, Math.PI / 2));
  const disc = L.dyn(new THREE.CircleGeometry(r, 40), mat);
  disc.position.set(x, y, z + 0.42);
  const front = L.dyn(new THREE.CircleGeometry(r, 40), mat);
  front.position.set(x, y, z - 2.45); front.rotation.y = Math.PI;
  L.mesh(place(cylinder(r + 0.5, r + 0.7, 0.4, 24, 0x1a1612, 0x2a2420), x, y, z - 2.0, 0, -Math.PI / 2));
  L.glow(x, y, z + 1, 0x6aff8a, r * 6, { opacity: 0.7 });
  return mat;
}

// The dial glass: backlit cream, wavelength scales and the old station names.
export function dialTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 204;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 204);
  grd.addColorStop(0, 'rgba(255,226,170,0.92)'); grd.addColorStop(1, 'rgba(240,196,130,0.92)');
  x.fillStyle = grd; x.fillRect(0, 0, 1024, 204);
  x.strokeStyle = '#3a2414'; x.fillStyle = '#3a2414'; x.lineWidth = 2;
  for (const y of [46, 120]) { x.beginPath(); x.moveTo(30, y); x.lineTo(994, y); x.stroke(); }
  for (let i = 0; i <= 48; i++) { const px = 30 + i * 20.08, h = i % 4 ? 8 : 16; x.beginPath(); x.moveTo(px, 46); x.lineTo(px, 46 + h); x.moveTo(px, 120); x.lineTo(px, 120 - h); x.stroke(); }
  x.font = '15px ui-monospace, Consolas, monospace'; x.textAlign = 'center';
  [550, 700, 909, 1100, 1300, 1500].forEach((k, i) => x.fillText(k, 60 + i * 180, 34));
  x.font = 'italic bold 22px Georgia, serif';
  ['Hilversum', 'Athlone', 'Droitwich', 'Luxembourg', 'Allouis', 'Motala'].forEach((n, i) => x.fillText(n, 95 + i * 166, 92));
  x.font = '17px Georgia, serif'; x.fillStyle = '#8a2a1a';
  ['Kalundborg', 'Lahti', 'Beromünster', 'Hörby', 'Sottens'].forEach((n, i) => x.fillText(n, 175 + i * 166, 152));
  x.font = 'bold 15px Georgia, serif'; x.fillStyle = '#3a2414'; x.fillText('MEDIUM WAVE', 512, 186);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// The kitchen around the set: a table, a window full of aurora, a few things at the wrong scale.
export function kitchen(L) {
  const box = (x, y0, z, w, h, d, c, solid = false) => L.block(x, y0, z, w, h, d, { color: c, side: shade(c, 0.8), solid, bevel: 1.5 });
  box(0, -18, -60, 360, 8, 270, 0x8a5a38, true);
  for (const [x, z] of [[-170, -185], [170, -185], [-170, 65], [170, 65]]) box(x, -230, z, 12, 212, 12, 0x6a4028);
  box(0, -240, -200, 1200, 10, 900, 0x4a3a40);
  // walls, the window, its frame and curtains
  const WALL = 0xd8c8a8;
  box(0, -240, 115, 900, 280, 12, WALL); box(0, 230, 115, 900, 160, 12, WALL);
  box(-280, 40, 115, 340, 190, 12, WALL); box(280, 40, 115, 340, 190, 12, WALL);
  for (const [x, w] of [[-112, 8], [112, 8], [0, 6]]) box(x, 40, 112, w, 190, 6, 0xf0ece0);
  for (const y of [40, 134, 226]) box(0, y - 3, 112, 232, 6, 6, 0xf0ece0);
  box(-150, 20, 104, 50, 230, 8, 0xa86a68); box(150, 20, 104, 50, 230, 8, 0xa86a68);
  box(-450, -240, -200, 12, 630, 640, WALL); box(450, -240, -200, 12, 630, 640, WALL);
  box(0, 380, -200, 900, 12, 640, 0xc8b898); box(0, -240, -520, 900, 630, 12, WALL);
  // a teacup and saucer, a matchbox, a spoon: everyday things, enormous
  L.mesh(place(cylinder(34, 34, 3, 32, 0xf0ece4, 0xc8c0b8), 120, -10, -80));
  L.mesh(place(cylinder(24, 16, 30, 32, 0xf0ece4, 0xd8d0c8), 120, -7, -80));
  L.mesh(place(paint(new THREE.TorusGeometry(10, 2.5, 8, 20, Math.PI), 0xf0ece4), 144, 9, -80, 0, 0, -Math.PI / 2));
  L.mesh(place(cylinder(22, 22, 0.5, 32, 0x5a3420, 0x3a2010), 120, 22.6, -80));
  box(-110, -10, -60, 50, 14, 32, 0xd8b848); box(-110, 4, -60, 51, 0.8, 30, 0x3a2a68);
  L.mesh(place(paint(new THREE.CapsuleGeometry(3, 70, 4, 10).rotateZ(Math.PI / 2), 0xc8c8d0), 60, -7, -130, 0.4));
}
