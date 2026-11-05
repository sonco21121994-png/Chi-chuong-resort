// Đồ hoạ & cảm giác nhập vai: hậu kỳ (bloom, grading), bầu trời, môi trường PMREM, biển shader,
// địa hình chi tiết, cây đung đưa, cỏ, hạt (đom đóm, bọt sóng, confetti), nón sáng đèn đường,
// camera chống xuyên tường + tự zoom trong nhà, intro bay lượn, âm thanh môi trường, cài đặt chất lượng.
import * as THREE from 'three';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './jsm/postprocessing/ShaderPass.js';
import { OutputPass } from './jsm/postprocessing/OutputPass.js';
import { Q } from './quality.js';
import { height, segDist } from './world.js';

const G = window.__game; const { W, scene, renderer, camera, cam, st } = G;
const $ = (id) => document.getElementById(id);
const U = { time: { value: 0 }, night: { value: 0 }, player: { value: new THREE.Vector3() } };
const NOISE = `float gh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float gn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gh(i),gh(i+vec2(1.,0.)),f.x),mix(gh(i+vec2(0.,1.)),gh(i+vec2(1.,1.)),f.x),f.y);}
float gf(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*gn(p);p=p*2.03+17.1;a*=.5;}return s;}`;
document.body.classList.add('q-' + Q.level);
const avRoots = () => { const s = new Set(G.npcs.map(n => n.av && n.av.root)); if (G.player.av) s.add(G.player.av.root); return s; };
const isAv = (o, roots) => { for (let p = o; p; p = p.parent) if (roots.has(p)) return true; return false; };

// ---------------- shadows ----------------
if (Q.shadows && W.sun.castShadow) {
  const sh = W.sun.shadow, e = Q.level === 'high' ? 32 : 25; sh.mapSize.set(Q.shadowMap, Q.shadowMap);
  Object.assign(sh.camera, { left: -e, bottom: -e, right: e, top: e }); sh.camera.updateProjectionMatrix(); sh.bias = -0.0004; sh.normalBias = 0.04;
  if (sh.map) { sh.map.dispose(); sh.map = null; }
}

// ---------------- sky: gradient + sun glow + clouds + milky way ----------------
Object.assign(W.skyU, { uTime: U.time, uNight: U.night });
W.sky.material = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: W.skyU,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float uTime; uniform float uNight; varying vec3 vP; ${NOISE}
  void main(){ vec3 d = normalize(vP); float h = max(d.y, 0.0); vec3 sd = normalize(sunDir);
    vec3 col = mix(hor, top, pow(h, 0.5));
    float s = max(dot(d, sd), 0.0); float low = 1.0 - smoothstep(0.05, 0.55, sd.y);
    col += sunCol * pow(s, 3.0) * 0.45 * low * (1.0 - h) * (1.0 - uNight);              // warm sunset band
    col = mix(col, mix(hor, top, 0.15) * 0.7, smoothstep(0.0, -0.08, d.y));            // below horizon
    vec2 uv = d.xz / (d.y + 0.18) * 1.1 + vec2(uTime * 0.0035, uTime * 0.0015);
    float c = smoothstep(0.48, 0.82, gf(uv * 1.4)) * smoothstep(0.0, 0.2, d.y);
    vec3 cc = mix(hor * 1.08 + vec3(0.12), sunCol * 0.9 + hor * 0.4, low * 0.7) * (1.0 - uNight * 0.85);
    cc += sunCol * pow(s, 10.0) * 0.9 * (1.0 - uNight);
    col = mix(col, cc, c * 0.8);
    col += sunCol * (smoothstep(0.9993, 0.9997, s) * 8.0 + pow(s, 90.0) * 0.8 + pow(s, 10.0) * 0.12) * (1.0 - uNight * 0.92);
    vec3 mwN = normalize(vec3(0.55, 0.35, -0.76)); float band = exp(-pow(dot(d, mwN) * 3.2, 2.0));
    col += vec3(0.5, 0.55, 0.85) * band * gf(d.xz * 5.0 + d.y * 3.0) * 0.18 * uNight * h;
    float stg = step(0.9965, gh(floor(d.xz / (d.y + 0.3) * 260.0))) * (0.6 + 0.4 * sin(uTime * 3.0 + gh(floor(d.xz * 500.0)) * 40.0));
    col += vec3(stg) * uNight * smoothstep(0.05, 0.3, d.y) * 0.9;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }` });
W.sky.renderOrder = -10;

// ---------------- PMREM environment from the sky ----------------
const pmrem = new THREE.PMREMGenerator(renderer); const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), W.sky.material));
let envTex = null, envDirty = true, envT = 0;
function regenEnv() { const old = envTex; envTex = pmrem.fromScene(envScene, 0.03, 0.1, 400).texture; scene.environment = envTex; if (old) old.dispose(); envDirty = false; }
const _setTime = W.setTime; W.setTime = (m, r) => { _setTime(m, r); W.hemi.intensity *= 0.55 + 0.3 * W.stars.material.opacity; envDirty = true; };
if (W.time) W.setTime(W.time === 'day' || W.time === 'sunset' || W.time === 'night' ? W.time : '_c', renderer);

// ---------------- ocean ----------------
const HT = 256, HR = 110; const hd = new Uint8Array(HT * HT * 4);
for (let j = 0; j < HT; j++) for (let i = 0; i < HT; i++) { const x = (i + 0.5) / HT * 2 * HR - HR, z = (j + 0.5) / HT * 2 * HR - HR; const dep = Math.max(0, Math.min(12, -height(x, z))); const k = (j * HT + i) * 4; hd[k] = Math.round(dep / 12 * 255); hd[k + 3] = 255; }
const hTex = new THREE.DataTexture(hd, HT, HT, THREE.RGBAFormat); hTex.magFilter = hTex.minFilter = THREE.LinearFilter; hTex.needsUpdate = true;
const seaU = { uH: { value: hTex }, uShallow: { value: new THREE.Color('#3fe0d0') }, uTime: U.time };
const sm = W.seaMat; Object.assign(sm, { roughness: 0.06, metalness: 0, opacity: 1, transparent: true });
sm.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, seaU);
  sh.vertexShader = 'uniform float uTime;\nvarying float vWave;\nvarying vec3 vSW;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    `vec3 transformed = vec3(position);
     float w = sin(position.x*0.18+uTime*1.3)*0.12 + sin(position.y*0.23+uTime*1.1)*0.1 + sin((position.x+position.y)*0.5+uTime*2.2)*0.04;
     transformed.z += w; vWave = w; vSW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
  sh.fragmentShader = `uniform float uTime; uniform sampler2D uH; uniform vec3 uShallow; varying float vWave; varying vec3 vSW; ${NOISE}
  float depAt(vec2 p){ vec2 uv = (p + ${HR}.0) / ${2 * HR}.0; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 12.0; return texture2D(uH, uv).r * 12.0; }
  float rip(vec2 p){ return gn(p * 1.3 + uTime * vec2(0.35, 0.22)) * 0.6 + gn(p * 3.7 - uTime * vec2(0.42, -0.31)) * 0.3 + gn(p * 9.0 + uTime * vec2(0.8, 0.5)) * 0.1; }
  ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    float dep = depAt(vSW.xz); float nn = gn(vSW.xz * 0.6 + uTime * 0.15);
    vec3 scol = mix(uShallow, diffuseColor.rgb, smoothstep(0.3, 6.0, dep));
    float shore = 1.0 - smoothstep(0.0, 0.35 + 0.35 * nn, dep);
    float bands = smoothstep(0.6, 1.0, sin(dep * 7.0 - uTime * 1.6 + nn * 5.0)) * (1.0 - smoothstep(0.1, 1.8, dep));
    float crest = smoothstep(0.16, 0.27, vWave) * 0.5 * smoothstep(0.55, 0.75, gn(vSW.xz * 0.8 + uTime * 0.3));
    float foam = clamp(shore * 0.9 + bands * 0.6 + crest, 0.0, 1.0) * (0.7 + 0.3 * gn(vSW.xz * 7.0 + uTime));
    diffuseColor.rgb = mix(scol, vec3(0.92, 0.96, 1.0), foam);
    diffuseColor.a = clamp(mix(0.5, 0.94, smoothstep(0.0, 3.0, dep)) + foam * 0.5, 0.0, 1.0);`)
    .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
    { vec2 p = vSW.xz; float t = uTime; float x = p.x, z = p.y;
      vec2 gr = vec2(0.12*0.18*cos(x*0.18+t*1.3) + 0.02*cos((x-z)*0.5+t*2.2), -0.1*0.23*cos(-z*0.23+t*1.1) - 0.02*cos((x-z)*0.5+t*2.2));
      float e = 0.06; float r0 = rip(p); gr += vec2(rip(p + vec2(e, 0.0)) - r0, rip(p + vec2(0.0, e)) - r0) / e * 0.06;
      vec3 nW = normalize(vec3(-gr.x, 1.0, -gr.y)); normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz); }`)
    .replace('#include <dithering_fragment>', '#include <dithering_fragment>');
};
sm.customProgramCacheKey = () => 'sea2'; sm.needsUpdate = true;
const TURQ = new THREE.Color('#38d9c8');

// ---------------- terrain detail (procedural sand ripples / grass patches) ----------------
const tm = W.terrain.material;
tm.onBeforeCompile = (sh) => {
  sh.vertexShader = 'varying vec3 vTW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = 'varying vec3 vTW;\n' + NOISE + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
   { vec3 c = diffuseColor.rgb; float gK = smoothstep(0.0, 0.05, c.g - c.r);
     float n1 = gn(vTW.xz * 0.35), n2 = gn(vTW.xz * 2.7), n3 = gn(vTW.xz * 13.0), gb = gn(vTW.xz * vec2(14.0, 9.0));
     float rip = 0.5 + 0.5 * sin(vTW.x * 1.9 + vTW.z * 0.7 + n1 * 6.0);
     float n4 = gn(vTW.xz * 46.0), n5 = gn(vTW.xz * 0.9 + 17.0);
     float sandF = 0.84 + 0.11 * rip + 0.16 * (n3 - 0.5) + 0.12 * (n2 - 0.5) - 0.12 * step(0.8, n4) + 0.05 * step(n4, 0.12);
     float grassF = 0.8 + 0.28 * n1 + 0.12 * (n2 - 0.5) + 0.16 * (gb - 0.5);
     vec3 sandTint = mix(vec3(1.04, 0.95, 0.82), vec3(0.97, 0.9, 0.8), smoothstep(0.35, 0.75, n5));
     diffuseColor.rgb *= mix(sandF * sandTint, vec3(grassF), gK);
     diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.06, 0.78), gK * smoothstep(0.55, 0.8, n1) * 0.6); }`);
};
tm.customProgramCacheKey = () => 'terrain3'; tm.needsUpdate = true;

// ---------------- vegetation sway ----------------
function sway(m, amp, key, extra = '') {
  m.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.time; sh.uniforms.uPl = U.player;
    sh.vertexShader = 'uniform float uTime; uniform vec3 uPl;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
     float ph = 0.0; vec2 ip = vec2(0.0);
     #ifdef USE_INSTANCING
       ip = instanceMatrix[3].xz; ph = ip.x * 0.37 + ip.y * 0.23;
     #endif
     float hk = max(position.y - ${key === 'grass' ? '0.0' : '1.0'}, 0.0); hk = hk * hk * ${amp.toFixed(4)};
     transformed.x += (sin(uTime * 1.3 + ph) + sin(uTime * 3.1 + ph * 2.0) * 0.3) * hk;
     transformed.z += cos(uTime * 1.1 + ph * 1.3) * hk * 0.7; ${extra}`); };
  m.customProgramCacheKey = () => 'sway-' + key; m.needsUpdate = true;
}
if (W.palms) { W.palms.material = W.palms.material.clone(); sway(W.palms.material, 0.01, 'palm'); }
W.trees.forEach((t, i) => { t.material = t.material.clone(); sway(t.material, 0.025, 'tree' + i); });

// grass clumps (instanced, sway + bend away from the player)
if (Q.grass) {
  const pos = [], col = []; const cA = new THREE.Color('#2f6f22'), cB = new THREE.Color('#9ccf5a'), tc = new THREE.Color();
  for (let b = 0; b < 7; b++) { const a = b / 7 * Math.PI * 2 + Math.random(), r = Math.random() * 0.22, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.28 + Math.random() * 0.32, w = 0.035, ry = Math.random() * Math.PI, cx = Math.cos(ry) * w, cz = Math.sin(ry) * w, lean = (Math.random() - 0.5) * 0.15;
    pos.push(x - cx, 0, z - cz, x + cx, 0, z + cz, x + lean, h, z + lean * 0.5); tc.copy(cA); col.push(tc.r, tc.g, tc.b, tc.r, tc.g, tc.b); tc.copy(cB); col.push(tc.r, tc.g, tc.b); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gg.computeVertexNormals();
  const gm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
  sway(gm, 1.4, 'grass', `vec2 dv = ip - uPl.xz; float dd = length(dv); transformed.xz += normalize(dv + 0.001) * (1.0 - smoothstep(0.0, 1.1, dd)) * position.y * 0.9;`);
  const im = new THREE.InstancedMesh(gg, gm, Q.grass); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), cc = new THREE.Color(); let k = 0;
  const bad = (x, z) => { for (const c of W.colliders) if (x > c.minX - 0.6 && x < c.maxX + 0.6 && z > c.minZ - 0.6 && z < c.maxZ + 0.6) return true; for (const sg of W.pathSegs) if (segDist(x, z, sg) < 1.7) return true;
    for (const kk in W.venues) { const vv = W.venues[kk]; if (vv.radius && Math.hypot(x - vv.x, z - vv.z) < vv.radius) return true; } return W.lagoon && Math.hypot(x - W.lagoon.x, z - W.lagoon.z) < 8; };
  for (let i = 0; i < Q.grass * 6 && k < Q.grass; i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 44, x = Math.cos(a) * r, z = Math.sin(a) * r * 1.05 - 6; const h = height(x, z); if (h < 1.5 || h > 7.5 || bad(x, z)) continue;
    e.set(0, Math.random() * 6.28, 0); q.setFromEuler(e); s.setScalar(0.7 + Math.random() * 0.7); m4.compose(v.set(x, h - 0.03, z), q, s); im.setMatrixAt(k, m4); im.setColorAt(k++, cc.setHSL(0.24 + Math.random() * 0.06, 0.5, 0.42 + Math.random() * 0.2)); }
  im.count = k; im.frustumCulled = false; scene.add(im); W.grass = im;
}

// ---------------- wood & thatch materials on venues (world-space procedural, cloned so avatars keep theirs) ----------------
{
  const roots = avRoots(), cache = new Map(), hsl = {}, c = new THREE.Color();
  const woodify = (m, kind) => { const key = m.uuid + kind; if (cache.has(key)) return cache.get(key); const n = m.clone();
    n.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp4 = vec4(transformed, 1.0); vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4; wn = mat3(instanceMatrix) * wn;
        #endif
        vWP = (modelMatrix * wp4).xyz; vWN = normalize(mat3(modelMatrix) * wn);`);
      sh.fragmentShader = 'varying vec3 vWP; varying vec3 vWN;\n' + NOISE + '\n' + sh.fragmentShader.replace('#include <color_fragment>', kind === 'wood' ? `#include <color_fragment>
        { vec3 an = abs(vWN); vec2 uv = an.y > 0.6 ? vWP.xz : (an.x > an.z ? vWP.zy : vWP.xy);
          float pw = uv.x * 3.2; float pl = floor(pw); float f = fract(pw);
          float seam = smoothstep(0.0, 0.05, f) * smoothstep(1.0, 0.95, f);
          float grain = gn(vec2(pw * 18.0, uv.y * 1.6 + pl * 7.3)) * 0.6 + gn(vec2(pw * 60.0, uv.y * 0.5 + pl * 3.1)) * 0.4;
          float tone = 0.86 + 0.22 * gh(vec2(pl, floor(uv.y * 0.6 + gh(vec2(pl, 1.0)) * 3.0)));
          diffuseColor.rgb *= tone * (0.84 + 0.26 * grain) * mix(0.55, 1.0, seam); }` : `#include <color_fragment>
        { float a = atan(vWP.z, vWP.x); float row = fract(vWP.y * 4.0 + gn(vWP.xz * 3.0) * 0.4);
          float strand = gn(vec2(a * 60.0 + vWP.x * 6.0 + vWP.z * 6.0, vWP.y * 3.0));
          diffuseColor.rgb *= (0.7 + 0.35 * strand) * mix(0.62, 1.05, smoothstep(0.0, 0.35, row)); }`);
    };
    n.customProgramCacheKey = () => 'mat-' + kind; cache.set(key, n); return n; };
  scene.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || !o.material || Array.isArray(o.material) || o === W.terrain || o === W.sea) return; const m = o.material;
    if (!m.isMeshStandardMaterial || m.map || m.vertexColors || m.transparent || m.emissiveIntensity > 0.05 && m.emissive && m.emissive.getHex()) return; if (isAv(o, roots)) return;
    c.copy(m.color).convertLinearToSRGB().getHSL(hsl); const g = o.geometry.type;
    if (g.startsWith('Cone') && hsl.h > 0.07 && hsl.h < 0.16 && hsl.s > 0.3 && hsl.l > 0.3 && hsl.l < 0.75) o.material = woodify(m, 'thatch');
    else if ((g.startsWith('Box') || g.startsWith('Cyl')) && hsl.h > 0.02 && hsl.h < 0.12 && hsl.s > 0.2 && hsl.l > 0.1 && hsl.l < 0.55) o.material = woodify(m, 'wood'); });
}

// ---------------- glow: lamp light cones ----------------
const glowMat = (color, op) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uK: { value: 0 }, uC: { value: new THREE.Color(color) }, uOp: { value: op } },
  vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform float uK; uniform vec3 uC; uniform float uOp; varying float vY; void main(){ gl_FragColor = vec4(uC * uOp * uK * pow(vY, 1.6), 1.0); }' });
let lampCones = null;
if (W.lampPos.length && Q.level !== 'low') { const g = new THREE.ConeGeometry(1.5, 3.0, 18, 1, true); g.translate(0, -1.5, 0); lampCones = new THREE.InstancedMesh(g, glowMat('#ffc477', 0.22), W.lampPos.length); const m4 = new THREE.Matrix4();
  W.lampPos.forEach((p, i) => { lampCones.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); }); lampCones.frustumCulled = false; scene.add(lampCones); }

// ---------------- particles ----------------
function pts(n, init, vs, fs, opt = {}) { const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), r = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) init(i, p, r); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aR', new THREE.BufferAttribute(r, 4));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: opt.blend || THREE.AdditiveBlending, uniforms: { uTime: U.time, uK: { value: 0 }, uPx: { value: renderer.getPixelRatio() * innerHeight * 0.5 } , ...(opt.u || {}) },
    vertexShader: 'uniform float uTime; uniform float uK; uniform float uPx; attribute vec4 aR; varying float vA; varying vec4 vR;\n' + vs, fragmentShader: 'uniform float uK; varying float vA; varying vec4 vR;\n' + fs });
  const o = new THREE.Points(g, m); o.frustumCulled = false; o.visible = false; scene.add(o); return o; }
const PN = Q.particles;
const fireflies = pts(Math.round(320 * PN), (i, p, r) => { let x, z, h, k = 0; do { const a = Math.random() * 6.283, rr = Math.random() * 40; x = Math.cos(a) * rr; z = Math.sin(a) * rr - 4; h = height(x, z); } while (h < 1.4 && k++ < 30);
  if (W.lagoon && Math.random() < 0.3) { x = W.lagoon.x + (Math.random() - 0.5) * 16; z = W.lagoon.z + (Math.random() - 0.5) * 16; h = height(x, z); } p.set([x, Math.max(h, 1) + 0.4 + Math.random() * 2.2, z], i * 3); r.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4); },
  `void main(){ vR = aR; vec3 p = position + vec3(sin(uTime*0.5*(0.6+aR.x)+aR.y*20.)*1.3, sin(uTime*0.9+aR.z*30.)*0.45, cos(uTime*0.45*(0.6+aR.y)+aR.x*20.)*1.3);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float bl = pow(0.5 + 0.5 * sin(uTime * (1.5 + aR.w * 2.5) + aR.x * 40.0), 3.0);
    vA = bl * uK; gl_PointSize = (0.09 + 0.06 * aR.z) * uPx / -mv.z * (0.6 + bl); }`,
  'void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.92, 0.45) * 2.6 * a * vA, 1.0); }');
// sea spray along the shoreline
const shore = []; for (let i = 0; i < 180; i++) { const a = i / 180 * Math.PI * 2; let prev = height(Math.cos(a) * 25, Math.sin(a) * 25); for (let r = 25; r < 80; r += 0.5) { const x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z); if (h < 0.05 && prev >= 0.05) { shore.push([x, z, Math.cos(a), Math.sin(a)]); break; } prev = h; } }
const spray = shore.length ? pts(Math.round(1400 * PN), (i, p, r) => { const s = shore[i % shore.length], o = 0.3 + Math.random() * 2.2, side = (Math.random() - 0.5) * 2.4; p.set([s[0] + s[2] * o - s[3] * side, 0.05, s[1] + s[3] * o + s[2] * side], i * 3); r.set([Math.random(), Math.random(), s[2], s[3]], i * 4); },
  `void main(){ vR = aR; float sp = 0.22 + aR.y * 0.25; float cyc = uTime * sp + aR.x * 7.0; float ph = fract(cyc); float on = step(0.45, fract(sin(floor(cyc) * 12.9898 + aR.x * 78.233) * 43758.5453));
    vec3 p = position + vec3(aR.z, 0.0, aR.w) * ph * 1.2 + vec3(0.0, ph * (1.0 - ph) * 3.2 * (0.5 + aR.y), 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vA = on * sin(ph * 3.1416) * uK; gl_PointSize = (0.07 + 0.08 * aR.y) * uPx / -mv.z; }`,
  'void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA; gl_FragColor = vec4(vec3(0.95, 0.98, 1.0), a * 0.75); }', { blend: THREE.NormalBlending }) : null;
// club confetti
const C = W.club; const confetti = C ? pts(Math.round(900 * PN), (i, p, r) => { p.set([C.x + (Math.random() - 0.5) * C.hw * 1.8, C.y + 4.2, C.z + (Math.random() - 0.5) * C.hd * 1.8], i * 3); r.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4); },
  `uniform float uD; void main(){ vR = aR; float ph = fract(uTime * (0.07 + aR.y * 0.05) + aR.x); vec3 p = position + vec3(sin(uTime * 1.7 + aR.z * 30.0) * 0.4, -ph * 4.1, cos(uTime * 1.3 + aR.w * 30.0) * 0.4);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vA = step(aR.w, uD) * uK * smoothstep(1.0, 0.85, ph); gl_PointSize = 0.075 * uPx / -mv.z * (0.5 + 0.5 * abs(sin(uTime * 6.0 + aR.x * 50.0))); }`,
  `void main(){ vec3 c = vR.x < 0.2 ? vec3(1.0,0.2,0.75) : vR.x < 0.4 ? vec3(0.2,0.9,1.0) : vR.x < 0.6 ? vec3(1.0,0.85,0.2) : vR.x < 0.8 ? vec3(0.6,0.3,1.0) : vec3(0.3,1.0,0.5);
    if (vA < 0.01) discard; gl_FragColor = vec4(c * 1.8, vA); }`, { blend: THREE.NormalBlending, u: { uD: { value: 0.3 } } }) : null;
let burst = 0; const _flash = W.flash; W.flash = (...a) => { burst = 1; return _flash && _flash(...a); };

// ---------------- post-processing ----------------
let composer = null, bloom = null, grade = null;
const GradeShader = { uniforms: { tDiffuse: { value: null }, uSat: { value: 1.1 }, uCon: { value: 1.04 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uVig: { value: 0.28 }, uShadow: { value: new THREE.Vector3(0.0, 0.02, 0.05) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uCon, uVig; uniform vec3 uTint, uShadow; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat); col = (col - 0.5) * uCon + 0.5; col *= uTint; col += uShadow * (1.0 - smoothstep(0.0, 0.5, l));
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.85); col *= mix(1.0 - uVig, 1.0, smoothstep(0.75, 0.2, length(d)));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }` };
if (Q.post) {
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: Q.aa ? 4 : 0 });
  composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.6, 1.4); composer.addPass(bloom);
  composer.addPass(new OutputPass()); grade = new ShaderPass(GradeShader); composer.addPass(grade);
  const rs = () => { composer.setPixelRatio(renderer.getPixelRatio() * (Q.level === 'med' ? 0.9 : 1)); composer.setSize(innerWidth, innerHeight); }; rs(); addEventListener('resize', rs);
} else { const v = document.createElement('div'); v.id = 'vignette'; document.body.appendChild(v); }
addEventListener('resize', () => [fireflies, spray, confetti].forEach(o => o && (o.material.uniforms.uPx.value = renderer.getPixelRatio() * innerHeight * 0.5)));

// time-of-day look targets
const LOOK = { day: { sat: 1.12, con: 1.05, tint: [1.0, 1.0, 0.97], bloom: 0.32, th: 1.5, sh: [0.0, 0.015, 0.04] }, sunset: { sat: 1.2, con: 1.06, tint: [1.07, 0.98, 0.9], bloom: 0.55, th: 1.1, sh: [0.04, 0.0, 0.06] },
  night: { sat: 1.06, con: 1.08, tint: [0.92, 0.97, 1.1], bloom: 0.6, th: 0.9, sh: [0.0, 0.01, 0.06] }, club: { sat: 1.18, con: 1.1, tint: [1.02, 0.97, 1.04], bloom: 0.32, th: 1.05, sh: [0.03, 0.0, 0.05] }, indoor: { sat: 1.1, con: 1.05, tint: [1.0, 1.0, 1.0], bloom: 0.18, th: 1.5, sh: [0.0, 0.0, 0.03] } };
const cur = { sat: 1.1, con: 1.04, tint: new THREE.Vector3(1, 1, 1), bloom: 0.4, th: 1.4, sh: new THREE.Vector3() }; let nightK = 0, sunsetK = 0;
const tv = new THREE.Vector3();
G.renderFrame = (dt, t) => {
  dt = dt || 0; U.time.value = t; const pp = G.player.av ? G.player.av.root.position : W.spawn; U.player.value.set(pp.x, pp.y || 0, pp.z);
  const sy = W.skyU.sunDir.value.y, starK = W.stars.material.opacity; nightK += (starK - nightK) * Math.min(1, dt * 2 + (dt ? 0 : 1)); U.night.value = nightK;
  sunsetK = (1 - THREE.MathUtils.smoothstep(sy, 0.15, 0.55)) * (1 - nightK);
  // env refresh (throttled)
  envT -= dt; if (envDirty && envT <= 0) { regenEnv(); envT = 1.5; }
  // ocean shallow colour follows the light
  seaU.uShallow.value.copy(TURQ).multiplyScalar(1 - 0.82 * nightK).lerp(sm.color, 0.25 + 0.3 * sunsetK);
  // glow & particles
  if (lampCones) lampCones.material.uniforms.uK.value = Math.min(1, nightK * 1.2 + sunsetK * 0.3);
  fireflies.visible = nightK > 0.05; fireflies.material.uniforms.uK.value = nightK;
  if (spray) { spray.visible = Math.hypot(pp.x, pp.z) > 22; spray.material.uniforms.uK.value = 1 - nightK * 0.6; }
  const inClub = !!(C && C.inside);
  if (confetti) { confetti.visible = inClub && (C.open || G.LIVE.isLive); burst = Math.max(0, burst - dt * 0.4); confetti.material.uniforms.uD.value = 0.3 + 0.7 * burst; confetti.material.uniforms.uK.value = 1; }
  // grading
  const inDoor = !inClub && !!(G.indoorNow && G.indoorNow()); const A = inClub ? LOOK.club : inDoor ? LOOK.indoor : null; const mixL = (k) => A ? A[k] : (LOOK.day[k] * (1 - nightK - sunsetK) + LOOK.sunset[k] * sunsetK + LOOK.night[k] * nightK);
  const mixV = (k) => A ? tv.fromArray(A[k]) : tv.fromArray(LOOK.day[k]).multiplyScalar(1 - nightK - sunsetK).addScaledVector(new THREE.Vector3().fromArray(LOOK.sunset[k]), sunsetK).addScaledVector(new THREE.Vector3().fromArray(LOOK.night[k]), nightK);
  const kk = Math.min(1, dt * 3 + (dt ? 0 : 1));
  cur.sat += (mixL('sat') - cur.sat) * kk; cur.con += (mixL('con') - cur.con) * kk; cur.bloom += (mixL('bloom') - cur.bloom) * kk; cur.th += (mixL('th') - cur.th) * kk; cur.tint.lerp(mixV('tint'), kk); cur.sh.lerp(mixV('sh'), kk);
  if (composer) { const u = grade.uniforms; u.uSat.value = cur.sat; u.uCon.value = cur.con; u.uTint.value.copy(cur.tint); u.uShadow.value.copy(cur.sh); u.uVig.value = inClub ? 0.38 : 0.26;
    bloom.strength = Math.min(0.7, (cur.bloom + (inClub ? burst * 0.1 : 0)) * (0.7 + (Q.bloomScale || 0.5) * 0.4)); bloom.threshold = cur.th; bloom.radius = 0.55; composer.render(dt); }
  else renderer.render(scene, camera);
};

// ---------------- camera: collision + indoor zoom + smooth ----------------
let occ = [], occBuilt = 0, near = [], nearT = 0, eff = cam.dist; const ray = new THREE.Ray(), hit = new THREE.Vector3(), dirV = new THREE.Vector3();
function buildOcc() { const roots = avRoots(); occ = []; scene.updateMatrixWorld(true);
  scene.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || o === W.sky || o === W.sea || o === W.terrain || o === W.moon) return; const m = o.material; if (!m || Array.isArray(m) || m.transparent || m.isShaderMaterial || m.isMeshBasicMaterial || m.isSpriteMaterial) return; if (isAv(o, roots)) return;
    let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; } if (!vis) return;
    const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return; const hh = b.max.y - b.min.y, hz = Math.max(b.max.x - b.min.x, b.max.z - b.min.z), gy = Math.max(0, height((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2));
    if ((hh >= 1.6 && hz >= 0.9) || (b.min.y - gy > 2.2 && hz >= 2.0)) occ.push({ b, o, c: b.getCenter(new THREE.Vector3()), r: b.getSize(new THREE.Vector3()).length() / 2, roof: b.min.y - gy > 2.2 }); });
}
let lastIndoor = false; G.indoorNow = () => lastIndoor;
G.camAdjust = (target, camPos, dt) => {
  const t = G.now(); if (!occBuilt || (occBuilt === 1 && t > 6)) { buildOcc(); occBuilt++; }
  nearT -= dt; if (nearT <= 0) { nearT = 0.4; near = occ.filter(e => e.c.distanceTo(target) < e.r + 18 && e.o.visible); }
  ray.origin.copy(target); ray.direction.set(0, 1, 0); let indoor = !!(C && C.inside);
  if (!indoor) for (const e of near) { if (e.b.containsPoint(target)) continue; if (e.b.min.y > target.y + 0.4 && ray.intersectBox(e.b, hit) && hit.y - target.y < 6) { indoor = true; break; } }
  lastIndoor = indoor; const pitch = indoor ? Math.min(cam.pitch, 0.36) : cam.pitch, want = Math.min(cam.dist, indoor ? (C && C.inside ? 3.8 : 4.3) : 99);
  dirV.set(Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(cam.yaw) * Math.cos(pitch)); ray.direction.copy(dirV);
  let d = want; for (const e of near) { if (e.b.containsPoint(target)) continue; if (ray.intersectBox(e.b, hit)) { const dd = hit.distanceTo(target); if (dd < d + 0.3) d = Math.min(d, Math.max(0.9, dd - 0.35)); } }
  let snap = false; if (d < eff - 0.05) { eff = d; snap = true; } else eff += (d - eff) * (1 - Math.exp(-dt * 2.2));
  camPos.copy(target).addScaledVector(dirV, eff); const gy = Math.max(W.walkY(camPos.x, camPos.z), 0) + 0.45; if (camPos.y < gy) camPos.y = gy;
  return snap;
};

// ---------------- cinematic intro fly-over (first entry; skippable) ----------------
let intro = null;
function startIntro() {
  const c = W.center || { x: 0, z: 8 }, v = W.venues; const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const path = new THREE.CatmullRomCurve3([P(-95, 48, 120), P(-55, 30, 70), P(-25, 18, 32), P(v.club.x + 14, 16, v.club.z + 22), P(v.bar.x + 18, 13, v.bar.z - 10), P(W.spawn.x + 16, 9, W.spawn.z + 4), P(W.spawn.x, 5, W.spawn.z + 9)]);
  const look = new THREE.CatmullRomCurve3([P(0, 4, 10), P(c.x, 3, c.z), P(c.x, 2, c.z), P(v.club.x, 3, v.club.z), P(v.bar.x, 2, v.bar.z), P(W.spawn.x, 1.5, W.spawn.z - 6), P(W.spawn.x, 1.6, W.spawn.z)]);
  const caps = [[0, '🏝️ Chào mừng đến Đảo Ngọc'], [0.22, '⛲ Quảng trường & khu nghỉ dưỡng'], [0.45, '🪩 Vũ Trường – DJ live mỗi tối'], [0.62, '🍹 Bar Beer bên biển'], [0.8, '⚓ Bến tàu – điểm bắt đầu của bạn']];
  const el = document.createElement('div'); el.id = 'intro'; el.innerHTML = '<div class="lb top"></div><div class="lb bot"></div><div class="ttl"><b>ĐẢO NGỌC</b><span>Đảo nghỉ dưỡng · Bar · Vũ Trường · Hẹn hò</span></div><div class="cap"></div><button class="skip">Bỏ qua ⏭</button>';
  document.body.appendChild(el); $('hud').classList.add('hideUI'); requestAnimationFrame(() => el.classList.add('on'));
  const T = 13, lk = new THREE.Vector3(); let k0 = -1;
  const end = () => { if (!intro) return; intro = null; G.camOverride = null; el.classList.remove('on'); setTimeout(() => el.remove(), 600); $('hud').classList.remove('hideUI'); st.introSeen = true; G.save && G.save(); removeEventListener('keydown', end); };
  el.querySelector('.skip').onclick = end; addEventListener('keydown', end, { once: true });
  intro = { t: 0 }; G.camOverride = (cm, dt) => { intro.t += dt; const u = Math.min(1, intro.t / T), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    cm.position.copy(path.getPointAt(e)); cm.lookAt(look.getPointAt(e, lk)); const ci = caps.filter(x => x[0] <= u).length - 1; if (ci !== k0) { k0 = ci; const cp = el.querySelector('.cap'); cp.classList.remove('show'); void cp.offsetWidth; cp.textContent = caps[ci][1]; cp.classList.add('show'); }
    if (u >= 1) end(); return true; };
}
G.playIntro = startIntro;
const qs = new URLSearchParams(location.search);
G.onEnter.push(() => { if (qs.get('intro') === '1' || (!st.introSeen && !navigator.webdriver && !qs.has('nointro'))) setTimeout(startIntro, 300); });

// ---------------- ambient sound layers: wind, birds (day), crickets (night) ----------------
let amb = null;
function ambStart() { const s = G.sound; if (amb || !s || !s.ctx || !s.master) return; const c = s.ctx; amb = {};
  const mk = (g) => { const n = c.createGain(); n.gain.value = g; return n; };
  // wind: band-passed noise with slow gusts
  const wsrc = c.createBufferSource(); wsrc.buffer = s.noise; wsrc.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.6;
  amb.wind = mk(0); const gust = mk(0.6); const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = mk(0.4); lfo.connect(lg); lg.connect(gust.gain); lfo.start();
  wsrc.connect(bp); bp.connect(gust); gust.connect(amb.wind); amb.wind.connect(s.master); wsrc.start();
  // crickets: high tone, amplitude-modulated twice (pulse + chirp rhythm)
  amb.crick = mk(0); const o = c.createOscillator(); o.frequency.value = 4400; const am = mk(0); const p1 = c.createOscillator(); p1.type = 'square'; p1.frequency.value = 26; const p1g = mk(0.5); p1.connect(p1g); p1g.connect(am.gain);
  const am2 = mk(0); const p2 = c.createOscillator(); p2.type = 'square'; p2.frequency.value = 1.6; const p2g = mk(0.5); p2.connect(p2g); p2g.connect(am2.gain);
  o.connect(am); am.connect(am2); am2.connect(amb.crick); amb.crick.connect(s.master); o.start(); p1.start(); p2.start();
  amb.birds = mk(0); amb.birds.connect(s.master); amb.nextBird = c.currentTime + 2; }
function chirp(c, out, t0) { const n = 2 + Math.floor(Math.random() * 4), f = 2300 + Math.random() * 1800; for (let i = 0; i < n; i++) { const o = c.createOscillator(), g = c.createGain(), t = t0 + i * (0.09 + Math.random() * 0.05);
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.3 + Math.random() * 0.4), t + 0.06); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1); } }
G.onFrame.push(() => { ambStart(); if (!amb) return; const c = G.sound.ctx, now = c.currentTime, p = G.player; const inside = (C && C.inside) || Math.hypot(p.x - W.venues.bar.x, p.z - W.venues.bar.z) < 7;
  const out = inside ? 0.15 : 1, hill = Math.min(1, Math.max(0, (height(p.x, p.z) - 3) / 6));
  amb.wind.gain.setTargetAtTime((0.05 + 0.12 * hill) * out, now, 0.5); amb.crick.gain.setTargetAtTime(0.012 * nightK * out, now, 0.8);
  const dayK = (1 - nightK) * out; amb.birds.gain.setTargetAtTime(0.035 * dayK, now, 0.5);
  if (now > amb.nextBird) { amb.nextBird = now + 1.5 + Math.random() * 4; if (dayK > 0.2) chirp(c, amb.birds, now + 0.05); } });

// ---------------- graphics settings UI ----------------
{ const b = document.createElement('button'); b.id = 'gfxBtn'; b.className = 'pill btn'; b.title = 'Đồ hoạ'; b.textContent = '⚙️'; const mute = $('muteBtn'); mute.parentNode.insertBefore(b, mute);
  const ov = document.createElement('div'); ov.id = 'gfxPanel'; ov.className = 'overlay hidden'; const det = Q.P[Q.level].name;
  ov.innerHTML = `<div class="card"><h2>⚙️ Chất lượng đồ hoạ</h2><p class="sub">Đang dùng: <b>${Q.name}</b>${Q.auto ? ' (tự động)' : ''}. Điện thoại nên chọn <b>Thấp</b> để mượt.</p>
    <div class="btnGrid gfxOpts">${[['auto', '🤖 Tự động'], ['low', '🔋 Thấp'], ['med', '⚖️ Trung bình'], ['high', '✨ Cao']].map(([k, n]) => `<button class="pill btn ${(Q.auto ? 'auto' : Q.level) === k ? 'on' : ''}" data-q="${k}">${n}</button>`).join('')}</div>
    <ul class="gfxInfo"><li>🔋 Thấp: không bóng đổ, không hậu kỳ, ít hạt – pin & máy yếu</li><li>⚖️ Trung bình: bóng đổ, bloom, cỏ vừa</li><li>✨ Cao: bóng nét 2048, khử răng cưa, nhiều cỏ & hạt</li></ul>
    <div class="btnGrid"><button class="pill btn" id="gfxIntro">🎬 Xem lại intro</button><button class="pill btn" id="gfxClose">Đóng</button></div></div>`;
  document.body.appendChild(ov); b.onclick = () => ov.classList.remove('hidden'); ov.querySelector('#gfxClose').onclick = () => ov.classList.add('hidden');
  ov.querySelector('#gfxIntro').onclick = () => { ov.classList.add('hidden'); startIntro(); };
  ov.querySelectorAll('[data-q]').forEach(x => x.onclick = () => { const k = x.dataset.q; if (k === (Q.auto ? 'auto' : Q.level)) return ov.classList.add('hidden'); G.toast('⚙️ Đang áp dụng đồ hoạ…'); setTimeout(() => Q.set(k), 300); }); void det; }

G.gfx = { Q, composer, bloom, regenEnv, startIntro, get nightK() { return nightK; } };

// ✨ Huyền thoại: hiệu ứng xuất hiện khi khoác lên đồ Huyền thoại (vòng sáng vàng + cột sáng + hạt bay lên)
{ const FX = []; const ringG = new THREE.RingGeometry(0.3, 0.42, 40), colG = new THREE.CylinderGeometry(0.55, 0.7, 4, 20, 1, true), spG = new THREE.OctahedronGeometry(0.05);
  G.legendEntrance = (pl) => { const root = new THREE.Group(); root.position.copy(pl.av.root.position); window.__game.scene.add(root);
    const mm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(ringG, mm('#ffd54f', 0.9)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; root.add(ring);
    const col = new THREE.Mesh(colG, mm('#fff3b0', 0.35)); col.position.y = 2; root.add(col);
    const n = Math.round(30 * Q.particles), sp = []; for (let i = 0; i < n; i++) { const s = new THREE.Mesh(spG, mm(i % 2 ? '#ffd54f' : '#ffffff', 1)); const a = Math.random() * 6.28, r = 0.3 + Math.random() * 0.5; s.position.set(Math.cos(a) * r, Math.random() * 0.5, Math.sin(a) * r); s.userData.v = 1 + Math.random() * 2; root.add(s); sp.push(s); }
    FX.push({ root, ring, col, sp, t: 0 }); if (G.toast) G.toast('✨ Huyền thoại xuất hiện!'); try { W.flash && W.flash('#ffd54f'); } catch (e) {} };
  G.onFrame.push((dt) => { for (let i = FX.length - 1; i >= 0; i--) { const f = FX[i]; f.t += dt; const k = f.t / 1.8;
    f.ring.scale.setScalar(1 + k * 6); f.ring.material.opacity = Math.max(0, 0.9 * (1 - k)); f.col.material.opacity = Math.max(0, 0.4 * Math.sin(Math.min(1, k) * Math.PI)); f.col.rotation.y += dt * 2;
    for (const s of f.sp) { s.position.y += s.userData.v * dt; s.rotation.y += dt * 4; s.material.opacity = Math.max(0, 1 - k); }
    if (k >= 1) { window.__game.scene.remove(f.root); f.root.traverse(o => o.material && o.material.dispose()); FX.splice(i, 1); } } }); }
