import * as THREE from 'three';

// ---------- shared GLSL ----------
const NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm2(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
`;

// ---------- the "cooled sound" world material ----------
// Lambert + vertex colours + rim glow + height tint + faint horizontal strata.
export function makeWorldUniforms(env = {}) {
  return {
    uTime: { value: 0 },
    uWind: { value: env.wind ?? 1 },
    uRim: { value: new THREE.Color(env.rim ?? 0x6655aa) },
    uRimPow: { value: env.rimPow ?? 2.6 },
    uLow: { value: new THREE.Color(env.low ?? 0x333344) },
    uLowY: { value: env.lowY ?? -12 },
    uHighY: { value: env.highY ?? 8 },
    uGroove: { value: env.groove ?? 0.045 },
    uGrooveScale: { value: env.grooveScale ?? 7.5 },
  };
}

const SWAY = /* glsl */`
{ vec3 ip = vec3(0.0);
#ifdef USE_INSTANCING
  ip = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
  float k = max(position.y, 0.0); k = k * k * 0.05 * uWind;
  transformed.x += sin(uTime * 1.6 + ip.x * 0.31 + ip.z * 0.17) * k;
  transformed.z += cos(uTime * 1.25 + ip.x * 0.21 - ip.z * 0.29) * k * 0.7; }
`;

export function worldMaterial(U, { sway = false, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying float vUp;\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (sway ? SWAY : ''))
      .replace('#include <project_vertex>', `#include <project_vertex>
{ vec4 wp = vec4(transformed, 1.0); vec3 wn = objectNormal;
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp; wn = mat3(instanceMatrix) * wn;
#endif
  vWPos = (modelMatrix * wp).xyz; vUp = normalize(mat3(modelMatrix) * wn).y; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying float vUp;
uniform vec3 uRim; uniform float uRimPow; uniform vec3 uLow; uniform float uLowY; uniform float uHighY;
uniform float uGroove; uniform float uGrooveScale;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= mix(uLow, vec3(1.0), smoothstep(uLowY, uHighY, vWPos.y));
float gr = sin(vWPos.y * uGrooveScale + sin(vWPos.x * 0.37 + vWPos.z * 0.23) * 2.2);
diffuseColor.rgb *= 1.0 + gr * uGroove;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float fr = 1.0 - saturate(dot(normalize(vViewPosition), normal));
totalEmissiveRadiance += uRim * pow(fr, uRimPow) * (1.0 - 0.85 * max(vUp, 0.0));`);
  };
  m.customProgramCacheKey = () => 'world' + (sway ? 'S' : '') + side;
  return m;
}

// Unlit vertex-colour material that sways with the world material (reed tips, lanterns on stalks).
export function swayGlowMaterial(U) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY);
  };
  m.customProgramCacheKey = () => 'swayglow';
  return m;
}

// Unlit emissive vertex-colour material for lamps, dials and signage that should glow.
export function glowMaterial(opts = {}) {
  return new THREE.MeshBasicMaterial({ vertexColors: true, fog: opts.fog ?? true, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide });
}

// ---------- sky ----------
export function makeSky(env) {
  const s = env.sky || {};
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color(s.top ?? 0x0b0820) },
      uHorizon: { value: new THREE.Color(s.horizon ?? 0x3a2a55) },
      uBottom: { value: new THREE.Color(s.bottom ?? s.horizon ?? 0x201830) },
      uAur1: { value: new THREE.Color(s.aurora1 ?? 0x2affb0) },
      uAur2: { value: new THREE.Color(s.aurora2 ?? 0x8a4dff) },
      uAurora: { value: s.aurora ?? 1 },
      uAuroraBands: { value: s.bands ?? 0 },
      uAur3: { value: new THREE.Color(s.aurora3 ?? 0xff7aa8) },
      uStars: { value: s.stars ?? 1 },
      uStarSpin: { value: s.starSpin ?? 0 },
      uSunDir: { value: new THREE.Vector3(...(s.sunDir ?? [0.3, 0.12, -1])).normalize() },
      uSunColor: { value: new THREE.Color(s.sunColor ?? 0xffc080) },
      uSun: { value: s.sun ?? 0 },
      uCloud: { value: s.clouds ?? 0 },
      uCloudColor: { value: new THREE.Color(s.cloudColor ?? 0x445566) },
      uHorizonGlow: { value: s.horizonGlow ?? 0.25 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uTop, uHorizon, uBottom, uAur1, uAur2, uAur3, uSunDir, uSunColor, uCloudColor;
      uniform float uAurora, uAuroraBands, uStars, uStarSpin, uSun, uCloud, uHorizonGlow;
      varying vec3 vDir;
      ${NOISE}
      vec3 aurora(vec3 d){
        if (d.y < 0.015) return vec3(0.0);
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          vec2 p = d.xz / (d.y + 0.08) * (1.0 + fi * 0.09);
          float n = fbm2(p * 0.22 + vec2(uTime * 0.012, fi * 0.13));
          float c = 1.0 - abs(sin(p.x * 0.33 + p.y * 0.12 + n * 6.0 + uTime * 0.03));
          c = pow(c, 5.0) * smoothstep(0.25, 0.7, n);
          vec3 col = mix(uAur1, uAur2, fi / 5.0);
          if (uAuroraBands > fi) col = mix(col, uAur3, 0.55);
          acc += col * c * (1.0 - fi / 7.0);
        }
        return acc * 0.33 * smoothstep(0.015, 0.2, d.y) * (1.0 - smoothstep(0.55, 0.95, d.y) * 0.6);
      }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
        col = mix(uBottom, col, smoothstep(-0.2, 0.0, h));
        col += uHorizon * uHorizonGlow * exp(-abs(h) * 9.0);
        // stars, optionally wheeling about the pole
        if (uStars > 0.0 && h > -0.05) {
          float a = uTime * uStarSpin;
          vec3 sd = vec3(d.x * cos(a) - d.z * sin(a), d.y, d.x * sin(a) + d.z * cos(a));
          vec3 p = sd * 160.0; vec3 id = floor(p); vec3 f = fract(p) - 0.5;
          float r = hash13(id);
          vec3 off = vec3(hash13(id + 1.7), hash13(id + 3.1), hash13(id + 5.3)) - 0.5;
          float st = smoothstep(0.09, 0.0, length(f - off * 0.6)) * step(0.975, r);
          st *= 0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
          col += vec3(0.9, 0.92, 1.0) * st * uStars * smoothstep(-0.05, 0.2, h);
        }
        if (uSun > 0.0) {
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunColor * (pow(sd, 900.0) * 3.0 + pow(sd, 24.0) * 0.35 + pow(sd, 4.0) * 0.12) * uSun;
        }
        if (uCloud > 0.0 && h > -0.02) {
          vec2 cp = d.xz / (h + 0.12);
          float n = fbm2(cp * 0.6 + vec2(uTime * 0.02, 0.0));
          float c = smoothstep(0.45, 0.8, n) * smoothstep(-0.02, 0.15, h);
          col = mix(col, uCloudColor, c * uCloud);
        }
        col += aurora(d) * uAurora;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- liquids ----------
function fogShader(extraUniforms) {
  return THREE.UniformsUtils.merge([THREE.UniformsLib.fog, extraUniforms]);
}

export function makeWaterMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: fogShader({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(o.deep ?? 0x10302e) },
      uShallow: { value: new THREE.Color(o.shallow ?? 0x2f6a60) },
      uSky: { value: new THREE.Color(o.sky ?? 0x8aa0a0) },
      uAmp: { value: o.amp ?? 0.25 },
      uFreq: { value: o.freq ?? 0.18 },
      uGlint: { value: new THREE.Color(o.glint ?? 0xffe0b0) },
    }),
    vertexShader: /* glsl */`
      uniform float uTime, uAmp, uFreq;
      varying vec3 vW; varying vec3 vN;
      #include <fog_pars_vertex>
      float wave(vec2 p){ return sin(p.x * uFreq + uTime * 1.1) * 0.6 + sin(p.y * uFreq * 1.3 - uTime * 0.9) * 0.5 + sin((p.x + p.y) * uFreq * 2.1 + uTime * 1.7) * 0.25; }
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        float h = wave(w.xz) * uAmp;
        float e = 0.5;
        float hx = wave(w.xz + vec2(e, 0.0)) * uAmp, hz = wave(w.xz + vec2(0.0, e)) * uAmp;
        vN = normalize(vec3(h - hx, e, h - hz));
        w.y += h; vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uDeep, uShallow, uSky, uGlint;
      varying vec3 vW; varying vec3 vN;
      #include <fog_pars_fragment>
      ${NOISE}
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(v, vN), 0.0), 3.0);
        float n = fbm2(vW.xz * 0.35 + vec2(uTime * 0.15, -uTime * 0.1));
        vec3 col = mix(uDeep, uShallow, n * 0.6 + 0.2);
        col = mix(col, uSky, fr * 0.8);
        float g = smoothstep(0.78, 0.95, fbm2(vW.xz * 1.7 + uTime * 0.4)) * (0.3 + fr);
        col += uGlint * g * 0.5;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
  });
}

// The hiss between stations: a fizzing, slowly heaving liquid of noise.
export function makeStaticMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: fogShader({
      uTime: { value: 0 },
      uA: { value: new THREE.Color(o.a ?? 0x1a1528) },
      uB: { value: new THREE.Color(o.b ?? 0xb8b0d8) },
    }),
    vertexShader: /* glsl */`
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uA, uB; varying vec3 vW;
      #include <fog_pars_fragment>
      ${NOISE}
      void main(){
        vec2 cell = floor(vW.xz * 6.0 + vW.y * 3.0);
        float s = hash12(cell + floor(uTime * 24.0) * 13.7);
        float swell = fbm2(vW.xz * 0.08 + uTime * 0.05);
        vec3 col = mix(uA, uB, s * s * (0.35 + swell * 0.6));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
  });
}

// ---------- glass: echoes, pickups ----------
export function makeGlassMaterial(color = 0xfff0d0, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uTime: { value: 0 }, uCore: { value: o.core ?? 0.18 } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vY = position.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uAlpha, uTime, uCore; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        float fr = 1.0 - max(dot(normalize(vV), normalize(vN)), 0.0);
        float band = 0.5 + 0.5 * sin(vY * 30.0 - uTime * 6.0);
        float a = (uCore + pow(fr, 2.0) * 0.9 + band * 0.08) * uAlpha;
        gl_FragColor = vec4(uColor * (0.6 + fr), a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Volumetric-looking light beams (lighthouse, headlights, the transmitter).
export function makeBeamMaterial(color = 0xffe6a8, strength = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uStrength; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float facing = abs(dot(normalize(vV), normalize(vN)));
        float a = pow(facing, 1.5) * pow(1.0 - vUv.y, 1.2) * uStrength;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ---------- glow sprites ----------
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glowSprite(color, size, opts = {}) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opts.opacity ?? 1, fog: opts.fog ?? false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  if (opts.renderOrder !== undefined) s.renderOrder = opts.renderOrder;
  return s;
}

// Soft round shadow disc.
let shadowTex = null;
export function shadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}
