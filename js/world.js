import * as THREE from 'three';
import { mat, textSprite, createProp } from './avatar.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rand = (() => { let s = 1234567; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
const rr = (a, b) => a + rand() * (b - a);

export function mergeGeos(parts) { // parts: [geometry, matrix, color]
  const pos = [], nor = [], col = []; const c = new THREE.Color(); const nm = new THREE.Matrix3();
  for (const [g0, m, color] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m); c.set(color);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

// ---------------- terrain ----------------
const FLAT = [];
function hRaw(x, z) {
  const ang = Math.atan2(z, x); const r = Math.hypot(x, z) + 2.5 * Math.sin(3 * ang) + 1.5 * Math.sin(5 * ang + 1.3);
  const base = (1 - ss(38, 60, r)) * 2.2 - 0.8;
  const hill = 10 * Math.exp(-((x + 2) ** 2 + (z + 42) ** 2) / 230) + 7 * Math.exp(-((x - 28) ** 2 + (z + 28) ** 2) / 120) + 6.5 * Math.exp(-((x + 31) ** 2 + (z + 23) ** 2) / 45);
  const lagoon = -4.2 * Math.exp(-((x + 33) ** 2 + (z + 9) ** 2) / 38);
  const n = (0.35 * Math.sin(0.31 * x + 1) * Math.cos(0.27 * z) + 0.15 * Math.sin(0.9 * x + 0.7 * z)) * ss(0.8, 4, hill);
  return base + hill + lagoon + n;
}
export function height(x, z) {
  let h = hRaw(x, z);
  for (const f of FLAT) { const d = Math.max(Math.abs(x - f.x) - f.w, Math.abs(z - f.z) - f.d, 0); const m = 1 - ss(0, 4, d); if (m > 0) h += (f.y - h) * m; }
  return h;
}

export function buildWorld(scene, { mobile }) {
  const W = { colliders: [], circles: [], spots: [], venues: {}, decks: [], routes: {}, updaters: [], lamps: [], lampPos: [], trees: [], neon: [], pick: [], labels: [] };
  const addBox = (x, z, w, d, tag) => { const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, on: true, tag }; W.colliders.push(b); return b; };
  const addSpot = (s) => { s.occupant = null; s.id = W.spots.length; W.spots.push(s); return s; };

  // venue flatten areas (must be defined before terrain build)
  const V = {
    restaurant: { x: -20, z: 6, w: 7, d: 6 }, cafe: { x: 20, z: 8, w: 6, d: 6 }, bar: { x: 2, z: -14, w: 8, d: 6 }, club: { x: 24, z: -10, w: 8.5, d: 7.5 }, kiosk: { x: 2, z: 26, w: 4, d: 3 }, boutique: { x: -12, z: 23, w: 10, d: 8 },
  };
  W.boutiqueV = V.boutique;
  for (const k in V) FLAT.push({ ...V[k], y: 1.4 });

  // ----- terrain mesh -----
  const SIZE = 240, SEG = mobile ? 140 : 180;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tg.rotateX(-Math.PI / 2);
  const P = tg.attributes.position; const cols = new Float32Array(P.count * 3); const c = new THREE.Color();
  const sand = new THREE.Color('#e2c088'), wetSand = new THREE.Color('#b48d58'), grass = new THREE.Color('#62b04a'), grass2 = new THREE.Color('#3f8f3a'), rock = new THREE.Color('#8d877c'), path = new THREE.Color('#cfae78');
  const pathSegs = [];
  W.pathSegs = pathSegs;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); P.setY(i, height(x, z)); }
  tg.computeVertexNormals();
  const Nn = tg.attributes.normal;
  W._colorize = () => {
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), h = P.getY(i), r = Math.hypot(x, z), slope = 1 - Nn.getY(i);
      const g = 0.5 + 0.5 * Math.sin(x * 0.21) * Math.cos(z * 0.17);
      c.copy(grass).lerp(grass2, g * 0.6);
      const sandK = Math.max(ss(1.32, 1.12, h), ss(37, 41, r) * ss(3, 1.6, h));
      c.lerp(sand, sandK); if (h < 0.15) c.copy(wetSand).lerp(new THREE.Color('#9a8a62'), ss(0, -1.5, h));
      if (slope > 0.18 || h > 7.5) c.lerp(rock, Math.min(1, Math.max(ss(0.18, 0.35, slope), ss(7.5, 9, h))));
      if (h > 1.2 && sandK < 0.5) { let md = 9; for (const s of pathSegs) md = Math.min(md, segDist(x, z, s)); if (md < 1.5) c.lerp(path, ss(1.5, 0.9, md)); }
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  };
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = !mobile; scene.add(terrain); W.terrain = terrain; W.pick.push(terrain);

  // ----- sea -----
  const seaU = { uTime: { value: 0 } };
  const seaMat = new THREE.MeshStandardMaterial({ color: '#1fa3c9', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 });
  seaMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = seaU.uTime;
    sh.vertexShader = 'uniform float uTime;\nvarying float vWave;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `vec3 transformed = vec3(position);
       float w = sin(position.x*0.18+uTime*1.3)*0.12 + sin(position.y*0.23+uTime*1.1)*0.1 + sin((position.x+position.y)*0.5+uTime*2.2)*0.04;
       transformed.z += w; vWave = w;`);
    sh.fragmentShader = 'varying float vWave;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>\n gl_FragColor.rgb += vec3(0.9,0.98,1.0) * smoothstep(0.14,0.26,vWave) * 0.35;`);
  };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, mobile ? 90 : 140, mobile ? 90 : 140), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = 0; scene.add(sea); W.sea = sea; W.seaMat = seaMat;
  // shore foam ring (animated)
  const foamC = document.createElement('canvas'); foamC.width = 256; foamC.height = 16; const fx = foamC.getContext('2d');
  const fg = fx.createLinearGradient(0, 0, 0, 16); fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.5, 'rgba(255,255,255,.85)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); fx.fillStyle = fg; fx.fillRect(0, 0, 256, 16);
  // ----- sky -----
  const skyU = { top: { value: new THREE.Color('#3a8ee6') }, hor: { value: new THREE.Color('#cfeeff') }, sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() }, sunCol: { value: new THREE.Color('#fff6d0') } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP;
      void main(){ float h = max(vP.y,0.0); vec3 col = mix(hor, top, pow(h,0.6)); if(vP.y<0.0) col = hor*0.8;
        float s = max(dot(normalize(vP), normalize(sunDir)),0.0); col += sunCol*pow(s,600.0)*2.0 + sunCol*pow(s,12.0)*0.35;
        gl_FragColor = vec4(col,1.0); }` }));
  scene.add(sky); W.sky = sky; W.skyU = skyU;
  // stars
  const sg = new THREE.BufferGeometry(); const sp = []; for (let i = 0; i < 600; i++) { const v = new THREE.Vector3(rr(-1, 1), rr(0.05, 1), rr(-1, 1)).normalize().multiplyScalar(400); sp.push(v.x, v.y, v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 })); scene.add(stars); W.stars = stars;

  // ----- lights -----
  const hemi = new THREE.HemisphereLight('#cfe8ff', '#c9b27a', 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3dc', 2.6); sun.position.set(30, 60, 30); scene.add(sun); scene.add(sun.target);
  if (!mobile) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -25; sc.right = sc.top = 25; sc.near = 1; sc.far = 150; sun.shadow.bias = -0.0005; }
  W.hemi = hemi; W.sun = sun;
  scene.fog = new THREE.Fog('#cfeeff', 60, 260);

  // ----- helpers -----
  const box = (w, h, d, color, x, y, z, parent = scene, extra) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra)); m.position.set(x, y, z); parent.add(m); if (!mobile) { m.castShadow = true; m.receiveShadow = true; } return m; };
  const cyl = (rt, rb, h, color, x, y, z, parent = scene, seg = 10, extra) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, extra)); m.position.set(x, y, z); parent.add(m); if (!mobile) m.castShadow = true; return m; };
  const neonMat = (color) => { const m = new THREE.MeshBasicMaterial({ color, toneMapped: false }); W.neon.push(m); m.userData.base = new THREE.Color(color); return m; };
  const sign = (text, color, w, h, fontPx = 64, bg = null) => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w); const x = cv.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, cv.width, cv.height); }
    x.font = `900 ${fontPx}px system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = color; x.shadowBlur = bg ? 0 : 18;
    x.fillStyle = bg ? color : '#ffffff'; x.fillText(text, 256, cv.height / 2); if (!bg) { x.shadowBlur = 30; x.globalAlpha = 0.6; x.fillStyle = color; x.fillText(text, 256, cv.height / 2); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })); const bk = new THREE.Mesh(m.geometry, m.material); bk.rotation.y = Math.PI; m.add(bk); return m; // back face reads correctly too (no mirrored text)
  };
  const label = (text, x, y, z) => { const s = textSprite(text, { size: 44, h: 1.1, bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.7)' }); s.position.set(x, y, z); scene.add(s); W.labels.push(s); return s; };
  const deck = (x, z, w, d, y, color = '#8a5a34') => { const m = box(w, 0.3, d, color, x, y - 0.15, z); W.decks.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y }); W.pick.push(m); return m; };
  const lamp = (x, z, color = '#ffd27a') => { const y = height(x, z); cyl(0.06, 0.08, 3, '#333', x, y + 1.5, z); const bulbM = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: color, emissiveIntensity: 0.2 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bulbM); b.position.set(x, y + 3.1, z); scene.add(b); W.lamps.push(bulbM); W.lampPos.push({ x, y: y + 3.1, z }); W.circles.push({ x, z, r: 0.2 }); };

  // ================= VENUES =================
  const Y = 1.4, DY = Y + 0.18; // deck top
  // ---- Restaurant (Quán ăn) ----
  { const v = V.restaurant; const g = new THREE.Group(); g.position.set(v.x, 0, v.z); scene.add(g);
    deck(v.x, v.z, 13, 11, DY);
    for (const [px, pz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) { cyl(0.15, 0.15, 3.6, '#6b4226', px, DY + 1.8, pz, g); W.circles.push({ x: v.x + px, z: v.z + pz, r: 0.25 }); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.6, 2.6, 4, 1), mat('#c9a15a')); roof.rotation.y = Math.PI / 4; roof.position.set(0, DY + 4.9, 0); roof.scale.set(1, 1, 0.85); g.add(roof);
    box(3.4, 1, 0.9, '#7b4a2a', -2.5, DY + 0.5, -4, g); addBox(v.x - 2.5, v.z - 4, 3.4, 0.9);
    box(2.2, 0.9, 1, '#555', 2.6, DY + 0.45, -4.2, g); addBox(v.x + 2.6, v.z - 4.2, 2.2, 1);
    const grillTop = box(2.1, 0.08, 0.9, '#ff5a1f', 2.6, DY + 0.94, -4.2, g, { emissive: '#ff3a00', emissiveIntensity: 1.2 });
    for (let i = 0; i < 4; i++) { const sk = box(0.5, 0.06, 0.08, '#e07b3a', 2.0 + i * 0.4, DY + 1.0, -4.2, g); }
    const smoke = []; for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: '#dddddd', transparent: true, opacity: 0.25, depthWrite: false })); g.add(s); smoke.push(s); }
    W.updaters.push((t) => smoke.forEach((s, i) => { const k = (t * 0.4 + i / 5) % 1; s.position.set(2.6 + Math.sin(t + i) * 0.3, DY + 1.1 + k * 2.2, -4.2); s.scale.setScalar(0.6 + k * 1.5); s.material.opacity = 0.3 * (1 - k); }));
    const sn = sign('QUÁN ĂN HẢI SẢN', '#7a2d00', 6, 1, 64, '#ffe3a8'); sn.position.set(0, DY + 3.3, 5.05); g.add(sn);
    const sn2 = sn.clone(); sn2.position.z = 5.1; sn2.position.y = DY + 3.3; sn2.rotation.y = 0;
    v.tables = [];
    for (const [tx, tz] of [[-3.2, -0.6], [3.2, -0.6], [-3.2, 2.8], [3.2, 2.8], [0, 1.1]]) {
      cyl(0.6, 0.6, 0.06, '#f2e6d0', tx, DY + 0.75, tz, g, 16); cyl(0.06, 0.08, 0.75, '#6b4226', tx, DY + 0.37, tz, g);
      addBox(v.x + tx, v.z + tz, 1.1, 1.1);
      for (const s of [-1, 1]) { const cx = tx + s * 1.05; box(0.48, 0.06, 0.48, '#a0663a', cx, DY + 0.48, tz, g); box(0.06, 0.55, 0.48, '#a0663a', cx + s * 0.22, DY + 0.75, tz, g);
        for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(0.04, 0.48, 0.04, '#6b4226', cx + lx, DY + 0.24, tz + lz, g);
        addSpot({ kind: 'chair', venue: 'restaurant', x: v.x + cx, z: v.z + tz, y: DY, seatH: 0.5, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, anim: 'eat', seat: true, table: { x: v.x + tx, z: v.z + tz, y: DY + 0.78 } }); }
      v.tables.push({ x: v.x + tx, z: v.z + tz });
    }
    const pl = new THREE.PointLight('#ffb35a', 0, 14, 2); pl.position.set(0, DY + 3.2, 0); g.add(pl); W.warmLights = [pl];
    Object.assign(W.venues, { restaurant: { tables: v.tables, id: 'restaurant', name: 'Quán Ăn Hải Sản', icon: '🍤', x: v.x, z: v.z, counter: { x: v.x - 2.5, z: v.z - 3.1 }, entry: { x: v.x, z: v.z + 7 }, radius: 7,
      menu: [{ id: 'haisan', name: 'Hải sản nướng', icon: '🦐', price: 30, prop: 'plate', color: '#ff7043' }, { id: 'comchien', name: 'Cơm chiên', icon: '🍛', price: 15, prop: 'plate', color: '#ffd54f' }, { id: 'mixao', name: 'Mì xào', icon: '🍜', price: 15, prop: 'plate', color: '#e6b35a' }, { id: 'goicuon', name: 'Gỏi cuốn', icon: '🥗', price: 10, prop: 'plate', color: '#a5d66b' }] } });
    addSpot({ kind: 'staff', role: 'cook', x: v.x + 2.6, z: v.z - 5.0, y: DY, rot: 0, anim: 'grill' });
    W.routes.waiter = [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.9], [-1.6, 1.9], [0, 3.6], [-2.5, -2.9]].map(([a, b]) => ({ x: v.x + a, z: v.z + b }));
    label('🍤 Quán Ăn', v.x, DY + 7.2, v.z);
  }
  // ---- Cafe ----
  { const v = V.cafe; const g = new THREE.Group(); g.position.set(v.x, 0, v.z); scene.add(g);
    deck(v.x, v.z, 11, 10, DY, '#b98a5a');
    box(8, 3.4, 3, '#f4ede0', 0, DY + 1.7, -3.6, g); addBox(v.x, v.z - 3.6, 8, 3);
    box(8.4, 0.25, 3.4, '#5b3a29', 0, DY + 3.5, -3.6, g);
    for (let i = 0; i < 8; i++) { const aw = box(1.05, 0.06, 1.6, i % 2 ? '#ffffff' : '#2e7d6b', -3.7 + i * 1.05, DY + 2.85, -1.45, g); aw.rotation.x = 0.35; }
    box(3.2, 1.05, 0.7, '#6d4c41', 0, DY + 0.52, -1.9, g);
    const sn = sign('CAFE BIỂN XANH', '#2e7d6b', 5, 0.9, 62, '#ffffff'); sn.position.set(0, DY + 3.0, -2.08); g.add(sn);
    for (let i = 0; i < 3; i++) cyl(0.07, 0.05, 0.12, '#ffffff', -0.8 + i * 0.8, DY + 1.11, -1.9, g);
    const pl = new THREE.PointLight('#ffcf8a', 0, 12, 2); pl.position.set(0, DY + 2.6, 0.5); g.add(pl); W.warmLights.push(pl);
    for (const [tx, tz] of [[-3, 0.8], [3, 0.8], [-3, 3.4], [3, 3.4]]) {
      cyl(0.45, 0.45, 0.05, '#ffffff', tx, DY + 0.72, tz, g, 14); cyl(0.05, 0.05, 0.72, '#333', tx, DY + 0.36, tz, g); addBox(v.x + tx, v.z + tz, 0.8, 0.8);
      cyl(0.03, 0.03, 2.4, '#ddd', tx, DY + 1.2, tz, g); const um = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.5, 8, 1, true), mat(tx < 0 ? '#2e7d6b' : '#e8eadf', { side: THREE.DoubleSide })); um.position.set(tx, DY + 2.45, tz); g.add(um);
      for (const s of [-1, 1]) { const cx = tx + s * 0.85; box(0.42, 0.05, 0.42, '#3e2723', cx, DY + 0.46, tz, g); box(0.42, 0.45, 0.05, '#3e2723', cx + s * 0.2, DY + 0.7, tz, g).rotation.y = Math.PI / 2;
        addSpot({ kind: 'chair', venue: 'cafe', x: v.x + cx, z: v.z + tz, y: DY, seatH: 0.48, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, anim: 'sip', seat: true, table: { x: v.x + tx, z: v.z + tz, y: DY + 0.75 } }); }
    }
    addSpot({ kind: 'staff', role: 'barista', x: v.x, z: v.z - 2.7, y: DY, rot: 0, anim: 'serve' });
    W.venues.cafe = { id: 'cafe', name: 'Cafe Biển Xanh', icon: '☕', x: v.x, z: v.z, counter: { x: v.x, z: v.z - 1.1 }, entry: { x: v.x, z: v.z + 6.5 }, radius: 6.5,
      menu: [{ id: 'cfsuada', name: 'Cà phê sữa đá', icon: '🧋', price: 8, prop: 'cup', color: '#8d5524' }, { id: 'bacxiu', name: 'Bạc xỉu', icon: '🥛', price: 10, prop: 'cup', color: '#e6cfa7' }, { id: 'cfmuoi', name: 'Cà phê muối', icon: '☕', price: 12, prop: 'cup', color: '#5d4037' }, { id: 'tradao', name: 'Trà đào', icon: '🍑', price: 10, prop: 'glass', color: '#ffab76' }] };
    label('☕ Cafe', v.x, DY + 5.6, v.z);
  }
  // ---- Bar Beer ----
  { const v = V.bar; const g = new THREE.Group(); g.position.set(v.x, 0, v.z); scene.add(g);
    deck(v.x, v.z, 16, 12, DY, '#3a2a3a');
    box(7, 1.1, 1, '#2b1b2b', -2.5, DY + 0.55, -4, g); addBox(v.x - 2.5, v.z - 4, 7, 1);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(7, 0.06, 0.04), neonMat('#ff2fbf')); strip.position.set(-2.5, DY + 0.8, -3.48); g.add(strip);
    box(7.5, 2.4, 0.3, '#1c1020', -2.5, DY + 1.2, -5.6, g); addBox(v.x - 2.5, v.z - 5.6, 7.5, 0.3);
    const bottleCols = ['#3fd17a', '#ffb300', '#2fb7ff', '#ff4f6d', '#c080ff'];
    for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 6), new THREE.MeshStandardMaterial({ color: bottleCols[i % 5], emissive: bottleCols[i % 5], emissiveIntensity: 0.5 })); b.position.set(-5.6 + i * 0.45, DY + 1.6, -5.35); g.add(b); }
    for (let i = 0; i < 3; i++) { const t = cyl(0.12, 0.12, 0.6, '#c0c0c0', -4.5 + i * 0.6, DY + 1.4, -4.1, g, 10, { metalness: 0.8, roughness: 0.2 }); }
    // stools
    for (let i = 0; i < 5; i++) { const sx = -5.3 + i * 1.4; cyl(0.24, 0.24, 0.08, '#ff2fbf', sx, DY + 0.78, -2.9, g, 12); cyl(0.04, 0.05, 0.78, '#999', sx, DY + 0.39, -2.9, g);
      addSpot({ kind: 'stool', venue: 'bar', x: v.x + sx, z: v.z - 2.9, y: DY, seatH: 0.82, rot: Math.PI, anim: 'drink', seat: true, prop: 'beer' }); }
    // DJ booth
    box(2.6, 1.1, 1.1, '#111', 4.2, DY + 0.55, -4.3, g); addBox(v.x + 4.2, v.z - 4.3, 2.6, 1.1);
    const djStrip = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.02), neonMat('#21e6ff')); djStrip.position.set(4.2, DY + 0.7, -3.74); g.add(djStrip);
    for (const s of [-0.6, 0.6]) { const tt = cyl(0.3, 0.3, 0.05, '#333', 4.2 + s, DY + 1.13, -4.3, g, 16); W.updaters.push((t) => tt.rotation.y = t * 4); }
    for (const s of [-1.8, 1.8]) { box(0.8, 1.8, 0.8, '#151515', 4.2 + s, DY + 0.9, -4.6, g); const cone = cyl(0.25, 0.15, 0.05, '#444', 4.2 + s, DY + 1.3, -4.18, g); cone.rotation.x = Math.PI / 2; W.updaters.push((t, beat) => cone.scale.setScalar(1 + beat * 0.15)); addBox(v.x + 4.2 + s, v.z - 4.6, 0.8, 0.8); }
    W.stage = { x: v.x + 4.2, z: v.z - 5.95, y: DY + 3.35, w: 5.4, h: 3.04, floorY: DY, bx: v.x, bz: v.z };
    addSpot({ kind: 'staff', role: 'dj', x: v.x + 4.2, z: v.z - 5.05, y: DY, rot: 0, anim: 'dj' });
    addSpot({ kind: 'staff', role: 'bartender', x: v.x - 2.5, z: v.z - 4.85, y: DY, rot: 0, anim: 'bartend' });
    W.routes.bartender = [{ x: v.x - 4.8, z: v.z - 4.85 }, { x: v.x - 2.5, z: v.z - 4.85 }, { x: v.x - 0.4, z: v.z - 4.85 }];
    // dance floor
    const N = 5, tile = 1.0, fx = 3.6, fz = 0.3; const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(tile * 0.95, 0.05, tile * 0.95), new THREE.MeshBasicMaterial({ toneMapped: false }), N * N);
    const m4 = new THREE.Matrix4(); let k = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { m4.makeTranslation(v.x + fx + (i - 2) * tile, DY + 0.03, v.z + fz + (j - 2) * tile); tiles.setMatrixAt(k, m4); tiles.setColorAt(k++, new THREE.Color('#ff00aa')); }
    scene.add(tiles);
    const palette = ['#ff2fbf', '#21e6ff', '#9b30ff', '#ffe600', '#00ff9c', '#ff5a1f'].map(cc => new THREE.Color(cc)); const tmpc = new THREE.Color();
    W.updaters.push((t, beat, bi, night) => { let q = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const p = palette[(i + j + bi) % palette.length]; tmpc.copy(p).multiplyScalar((((i * 7 + j * 3 + bi) % 3 === 0) ? 1 : 0.35) * (night ? 1 : 0.7)); tiles.setColorAt(q++, tmpc); } tiles.instanceColor.needsUpdate = true; });
    W.danceFloor = { x: v.x + fx, z: v.z + fz, half: 2.5 };
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) addSpot({ kind: 'dance', venue: 'bar', x: v.x + fx + (i - 1) * 1.4 + rr(-0.2, 0.2), z: v.z + fz + (j - 1) * 1.4 + rr(-0.2, 0.2), y: DY, rot: Math.PI + rr(-0.6, 0.6), anim: 'dance1' });
    // standing tables
    for (const [tx, tz] of [[-4.5, 0.5], [-4.5, 3.6], [-1.2, 3.8]]) { cyl(0.35, 0.35, 0.05, '#444', tx, DY + 1.05, tz, g, 12); cyl(0.05, 0.05, 1.05, '#888', tx, DY + 0.52, tz, g); addBox(v.x + tx, v.z + tz, 0.6, 0.6);
      for (const s of [-1, 1]) addSpot({ kind: 'barStand', venue: 'bar', x: v.x + tx + s * 0.65, z: v.z + tz, y: DY, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, anim: 'drink', prop: 'beer', pair: true }); }
    // neon arch + sign
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), neonMat(s < 0 ? '#ff2fbf' : '#21e6ff')); p.position.set(s * 2.4, DY + 2, 6); g.add(p); W.circles.push({ x: v.x + s * 2.4, z: v.z + 6, r: 0.2 }); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 0.2), neonMat('#ffe600')); top.position.set(0, DY + 4, 6); g.add(top);
    const sn = sign('BAR BEER', '#ff2fbf', 4.6, 1.2, 120); sn.position.set(0, DY + 4.75, 6); g.add(sn);
    const sn2 = sign('BAR BEER', '#21e6ff', 5.0, 1.1, 100); sn2.position.set(-2.5, DY + 3.0, -5.42); g.add(sn2);
    // string lights
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), 60); let bk = 0;
    for (let i = 0; i < 60; i++) { const tt = (i % 20) / 19, row = Math.floor(i / 20); const x = -7.5 + tt * 15, z = -4.5 + row * 4.5; m4.makeTranslation(v.x + x, DY + 3.6 - Math.sin(tt * Math.PI) * 0.6, v.z + z); bulbs.setMatrixAt(bk, m4); bulbs.setColorAt(bk++, palette[i % 6]); }
    scene.add(bulbs);
    for (const [px, pz] of [[-7.8, -5.8], [7.8, -5.8], [-7.8, 5.8], [7.8, 5.8]]) { cyl(0.08, 0.08, 3.8, '#222', px, DY + 1.9, pz, g); W.circles.push({ x: v.x + px, z: v.z + pz, r: 0.15 }); }
    // moving spotlights
    W.spots3 = [];
    for (let i = 0; i < 2; i++) { const sl = new THREE.SpotLight(i ? '#21e6ff' : '#ff2fbf', 0, 16, 0.45, 0.5, 1.5); sl.position.set(v.x + fx + (i ? 3 : -3), DY + 5.5, v.z + fz - 3); scene.add(sl); scene.add(sl.target);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5.5, 16, 1, true), new THREE.MeshBasicMaterial({ color: i ? '#21e6ff' : '#ff2fbf', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      cone.geometry.translate(0, -2.75, 0); cone.position.copy(sl.position); scene.add(cone); W.spots3.push({ sl, cone, i }); }
    const tv = new THREE.Vector3(); const up = new THREE.Vector3(0, -1, 0);
    W.updaters.push((t) => W.spots3.forEach(({ sl, cone, i }) => { tv.set(v.x + fx + Math.sin(t * 0.9 + i * 2) * 2.2, DY, v.z + fz + Math.cos(t * 1.1 + i) * 2.2); sl.target.position.copy(tv);
      const dir = tv.clone().sub(sl.position).normalize(); cone.quaternion.setFromUnitVectors(up, dir); }));
    const bl = new THREE.PointLight('#ff3fd8', 0, 16, 2); bl.position.set(-2.5, DY + 3, -2); g.add(bl); W.barLight = bl;
    W.venues.bar = { id: 'bar', name: 'Bar Beer', icon: '🍺', x: v.x, z: v.z, counter: { x: v.x - 2.5, z: v.z - 3.2 }, entry: { x: v.x, z: v.z + 7.5 }, radius: 8,
      menu: [{ id: 'biatuoi', name: 'Bia tươi', icon: '🍺', price: 10, prop: 'beer' }, { id: 'biachai', name: 'Bia chai', icon: '🍾', price: 8, prop: 'beer' }, { id: 'cocktail', name: 'Cocktail Neon', icon: '🍸', price: 20, prop: 'glass', color: '#21e6ff' }, { id: 'mojito', name: 'Mojito', icon: '🍹', price: 15, prop: 'glass', color: '#9be15d' }] };
    label('🍺 Bar Beer', v.x, DY + 6.6, v.z + 6);
  }
  // ---- Vũ Trường (nightclub) – indoor club, open 21:00–02:00 ----
  { const v = V.club; const g = new THREE.Group(); g.position.set(v.x, 0, v.z); scene.add(g);
    const X = (lx) => v.x + lx, Z = (lz) => v.z + lz; const HW = 8.5, HD = 7.5, WH = 5.6;
    deck(v.x, v.z, HW * 2, HD * 2, DY, '#14101c');
    const C = W.club = { x: v.x, z: v.z, hw: HW, hd: HD, y: DY, walls: [], tables: [], master: null, door: null, open: false, inside: false, fx: [] };
    C.contains = (x, z) => Math.abs(x - v.x) < HW && Math.abs(z - v.z) < HD;
    // walls (fade when the player is inside)
    const wallM = new THREE.MeshStandardMaterial({ color: '#1b1430', roughness: 0.9, transparent: true, opacity: 1 }); C.wallM = wallM;
    const wall = (w, d, lx, lz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, WH, d), wallM); m.position.set(lx, DY + WH / 2, lz); g.add(m); addBox(X(lx), Z(lz), w, d, 'club'); C.walls.push(m); return m; };
    wall(HW * 2, 0.3, 0, HD); wall(HW * 2, 0.3, 0, -HD); wall(0.3, HD * 2, HW, 0); wall(0.3, HD - 1.6, -HW, -(HD + 1.6) / 2); wall(0.3, HD - 1.6, -HW, (HD + 1.6) / 2);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.3, WH - 3.2, 3.2), wallM); lintel.position.set(-HW, DY + 3.2 + (WH - 3.2) / 2, 0); g.add(lintel); C.walls.push(lintel);
    const roof = box(HW * 2 + 0.6, 0.3, HD * 2 + 0.6, '#120d1f', 0, DY + WH + 0.15, 0, g); C.roof = roof;
    // facade: neon sign + opening-hours sign + door
    const fz = -HW - 0.18; const sn = sign('VŨ TRƯỜNG', '#b04dff', 6.5, 1.5, 110); sn.position.set(fz, DY + 4.4, 0); sn.rotation.y = -Math.PI / 2; g.add(sn); C.neonSign = sn;
    const ns2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 7), neonMat('#ff2fbf')); ns2.position.set(fz, DY + 3.45, 0); g.add(ns2);
    const hrs = sign('Mở cửa 21h', '#ffd54f', 2.6, 0.7, 84, '#2a1a00'); hrs.position.set(fz - 0.02, DY + 2.2, 2.6); hrs.rotation.y = -Math.PI / 2; g.add(hrs); C.hoursSign = hrs;
    const openS = sign('OPEN 21h–02h', '#00ff9c', 2.6, 0.6, 70); openS.position.set(fz - 0.02, DY + 2.2, 2.6); openS.rotation.y = -Math.PI / 2; openS.visible = false; g.add(openS); C.openSign = openS;
    const doorM = new THREE.MeshStandardMaterial({ color: '#3a2a10', metalness: 0.6, roughness: 0.35, emissive: '#3a2400', emissiveIntensity: 0.3 });
    const doors = [-0.8, 0.8].map(s => { const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.1, 1.58), doorM); d.position.set(-HW, DY + 1.55, s); g.add(d); return d; });
    const closedTxt = sign('ĐÃ ĐÓNG CỬA', '#ff5252', 2.6, 0.5, 64, '#1a0000'); closedTxt.position.set(fz - 0.05, DY + 1.7, 0); closedTxt.rotation.y = -Math.PI / 2; g.add(closedTxt); C.facade = new THREE.Group(); [sn, ns2, hrs, openS, closedTxt].forEach(m => C.facade.add(m)); g.add(C.facade);
    C.doorBox = addBox(X(-HW), Z(0), 0.4, 3.2, 'clubDoor');
    C.setOpen = (o) => { C.open = o; C.doorBox.on = !o; doors.forEach((d, i) => { d.position.z = o ? (i ? 2.3 : -2.3) : (i ? 0.8 : -0.8); }); closedTxt.visible = !o; C.hoursSign.visible = !o; C.openSign.visible = o; };
    // carpet + velvet rope at the entrance (bouncer)
    box(3.2, 0.04, 2.6, '#7a0e2a', -HW - 1.6, DY + 0.02, 0, g);
    for (const s of [-1.4, 1.4]) { cyl(0.05, 0.06, 1, '#d4af37', -HW - 2.8, DY + 0.5, s, g, 8, { metalness: 0.9, roughness: 0.2 }); }
    addSpot({ kind: 'staff', role: 'bouncer', x: X(-HW - 1.4), z: Z(1.9), y: DY, rot: -Math.PI / 2, anim: 'idle' });
    // stage + DJ booth + LED wall (main stage of the Saturday live show)
    deck(X(6.95), v.z, 2.7, 9, DY + 0.8, '#0c0c12');
    const stE = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 9), neonMat('#21e6ff')); stE.position.set(5.58, DY + 0.78, 0); g.add(stE);
    box(1.1, 1.1, 3.0, '#0b0b0b', 6.4, DY + 0.8 + 0.55, 0, g); addBox(X(6.4), Z(0), 1.1, 3.0);
    const bS = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 3.0), neonMat('#b04dff')); bS.position.set(5.84, DY + 1.6, 0); g.add(bS);
    for (const s of [-0.7, 0.7]) { const tt = cyl(0.3, 0.3, 0.05, '#333', 6.4, DY + 1.93, s, g, 16); W.updaters.push((t) => tt.rotation.y = t * 4); }
    for (const s of [-3.6, 3.6]) { box(0.9, 2.2, 0.9, '#111', 7.2, DY + 0.8 + 1.1, s, g); const cone = cyl(0.3, 0.18, 0.05, '#444', 6.74, DY + 2.2, s, g); cone.rotation.z = Math.PI / 2; W.updaters.push((t, beat) => cone.scale.setScalar(1 + beat * 0.2)); }
    addSpot({ kind: 'staff', role: 'clubdj', x: X(7.3), z: Z(0), y: DY + 0.8, rot: -Math.PI / 2, anim: 'dj' });
    addSpot({ kind: 'staff', role: 'clubmc', x: X(6.6), z: Z(2.4), y: DY + 0.8, rot: -Math.PI / 2, anim: 'mc' });
    const ledFrame = box(0.2, 3.9, 6.8, '#050505', 8.22, DY + 0.8 + 2.55, 0, g);
    C.led = { x: X(8.1), y: DY + 0.8 + 2.55, z: v.z, w: 6.4, h: 3.6, rotY: -Math.PI / 2 };
    C.stage = { x: X(6.2), z: v.z, floorY: DY + 0.8 };
    // LED dance floor 7x7
    const N = 7, fxl = 0.6; const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.05, 0.95), new THREE.MeshBasicMaterial({ toneMapped: false }), N * N);
    const m4 = new THREE.Matrix4(); let k = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { m4.makeTranslation(X(fxl + (i - 3)), DY + 0.03, Z(j - 3)); tiles.setMatrixAt(k, m4); tiles.setColorAt(k++, new THREE.Color('#9b30ff')); } scene.add(tiles);
    const pal = ['#b04dff', '#21e6ff', '#ff2fbf', '#ffe600', '#00ff9c', '#ff5a1f'].map(cc => new THREE.Color(cc)); const tc0 = new THREE.Color();
    W.updaters.push((t, beat, bi) => { if (!C.open && !C.inside) return; let q = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const r = Math.hypot(i - 3, j - 3); const p = pal[(Math.floor(r) + bi) % pal.length]; tc0.copy(p).multiplyScalar(C.open ? (((Math.floor(r) + bi) % 2) ? 1 : 0.3) : 0.12); tiles.setColorAt(q++, tc0); } tiles.instanceColor.needsUpdate = true; });
    W.clubFloor = { x: X(fxl), z: v.z, half: 3.5 };
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) addSpot({ kind: 'dance', venue: 'club', x: X(fxl - 2.6 + i * 1.3 + rr(-0.2, 0.2)), z: Z(-2.6 + j * 1.75 + rr(-0.2, 0.2)), y: DY, rot: Math.PI / 2 + rr(-0.7, 0.7), anim: 'dance1' });
    for (let j = 0; j < 7; j++) addSpot({ kind: 'crowd', venue: 'club', x: X(4.7 + (j % 2) * 0.5), z: Z(-3.3 + j * 1.1), y: DY, rot: Math.PI / 2 + rr(-0.3, 0.3), anim: 'hype' });
    // bar counter (north wall)
    box(5.6, 1.1, 0.8, '#0e0a14', 1.6, DY + 0.55, 6.2, g); addBox(X(1.6), Z(6.2), 5.6, 0.8);
    const cS = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.06, 0.04), neonMat('#21e6ff')); cS.position.set(1.6, DY + 0.85, 5.78); g.add(cS);
    const bc = ['#3fd17a', '#ffb300', '#2fb7ff', '#ff4f6d', '#c080ff']; for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 6), new THREE.MeshStandardMaterial({ color: bc[i % 5], emissive: bc[i % 5], emissiveIntensity: 0.6 })); b.position.set(-1 + i * 0.45, DY + 1.7, 7.25); g.add(b); }
    box(5.6, 0.05, 0.3, '#333', 1.6, DY + 1.5, 7.25, g);
    for (let i = 0; i < 5; i++) { const sx = -0.6 + i * 1.1; cyl(0.24, 0.24, 0.08, '#b04dff', sx, DY + 0.78, 5.3, g, 12); cyl(0.04, 0.05, 0.78, '#999', sx, DY + 0.39, 5.3, g);
      addSpot({ kind: 'stool', venue: 'club', x: X(sx), z: Z(5.3), y: DY, seatH: 0.82, rot: 0, anim: 'drink', seat: true, prop: 'glass' }); }
    for (const sx of [-1.8, 4.9]) addSpot({ kind: 'lean', venue: 'club', x: X(sx), z: Z(5.4), y: DY, rot: 0, anim: 'drink', prop: 'beer' });
    addSpot({ kind: 'staff', role: 'clubbar', x: X(1.6), z: Z(6.95), y: DY, rot: Math.PI, anim: 'bartend' });
    W.routes.clubbar = [{ x: X(-0.6), z: Z(6.95) }, { x: X(1.6), z: Z(6.95) }, { x: X(3.8), z: Z(6.95) }];
    // standing tables
    for (const [tx, tz] of [[-5.4, -2.6], [-3.6, 3.6]]) { cyl(0.35, 0.35, 0.05, '#333', tx, DY + 1.05, tz, g, 12); cyl(0.05, 0.05, 1.05, '#888', tx, DY + 0.52, tz, g); addBox(X(tx), Z(tz), 0.6, 0.6);
      for (const s of [-1, 1]) addSpot({ kind: 'barStand', venue: 'club', x: X(tx + s * 0.65), z: Z(tz), y: DY, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, anim: 'drink', prop: 'glass', pair: true }); }
    // VIP tables (south wall) – sofas, bottle + sparkler, velvet rope with a gate
    const gold = { metalness: 0.9, roughness: 0.25 }; const sparkM = new THREE.PointsMaterial({ color: '#fff2a8', size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    [-6, -3, 0, 3].forEach((tx, i) => { const n = i + 1; box(1.9, 0.45, 0.7, '#5a0f2e', tx, DY + 0.22, -6.85, g); box(1.9, 0.7, 0.18, '#5a0f2e', tx, DY + 0.6, -7.2, g); box(0.7, 0.45, 0.9, '#5a0f2e', tx + 1.25, DY + 0.22, -5.7, g);
      cyl(0.45, 0.4, 0.42, '#1a1a1a', tx, DY + 0.21, -5.75, g, 14); const top = cyl(0.48, 0.48, 0.04, '#d4af37', tx, DY + 0.44, -5.75, g, 14, gold);
      addBox(X(tx), Z(-6.95), 1.9, 0.9); addBox(X(tx), Z(-5.75), 0.9, 0.9);
      const bucket = cyl(0.12, 0.1, 0.2, '#c0c0c0', tx - 0.15, DY + 0.56, -5.75, g, 10, gold); const bottle = cyl(0.045, 0.06, 0.34, '#0f3d1e', tx - 0.15, DY + 0.78, -5.75, g, 8); cyl(0.05, 0.05, 0.08, '#d4af37', tx - 0.15, DY + 0.97, -5.75, g, 8);
      for (const gx of [0.12, 0.25]) cyl(0.03, 0.02, 0.16, '#fff', tx + gx, DY + 0.54, -5.65, g, 6, { transparent: true, opacity: 0.7 });
      const pg = new THREE.BufferGeometry(); const P = new Float32Array(40 * 3); pg.setAttribute('position', new THREE.BufferAttribute(P, 3)); const sp = new THREE.Points(pg, sparkM); sp.position.set(X(tx - 0.15), DY + 1.02, Z(-5.75)); sp.visible = false; scene.add(sp);
      const seats = [addSpot({ kind: 'vipseat', venue: 'club', table: n, x: X(tx - 0.5), z: Z(-6.75), y: DY, seatH: 0.45, rot: 0, anim: 'sit', seat: true, prop: 'glass', clubZone: 'vip' }), addSpot({ kind: 'vipseat', venue: 'club', table: n, x: X(tx + 0.5), z: Z(-6.75), y: DY, seatH: 0.45, rot: 0, anim: 'sit', seat: true, prop: 'glass', clubZone: 'vip' }), addSpot({ kind: 'vipseat', venue: 'club', table: n, x: X(tx + 1.25), z: Z(-5.7), y: DY, seatH: 0.45, rot: -Math.PI / 2, anim: 'sit', seat: true, prop: 'glass', clubZone: 'vip' })];
      const lb = textSprite(`Bàn VIP ${n}`, { size: 40, h: 0.5, bg: 'rgba(40,0,30,0.7)', border: '#d4af37' }); lb.position.set(X(tx), DY + 1.7, Z(-5.9)); scene.add(lb);
      C.tables.push({ n, x: X(tx), z: Z(-5.75), seats, sparkler: sp, sparkOn: 0, bottle, label: lb }); });
    W.updaters.push((t) => { for (const T of C.tables) { const on = T.sparkOn > t || T.always; T.sparkler.visible = !!on && (C.open || C.inside); if (!T.sparkler.visible) continue; const P = T.sparkler.geometry.attributes.position;
      for (let i = 0; i < 40; i++) { const k = (t * 1.7 + i / 40) % 1, a = i * 2.4; P.setXYZ(i, Math.cos(a) * k * 0.25, k * 0.55 - k * k * 0.3, Math.sin(a) * k * 0.25); } P.needsUpdate = true; } });
    // rope: lz=-4.5 from lx -7.6..4.6, gate between table 2 and 3 at lx -1.5
    const ropeM = new THREE.MeshStandardMaterial({ color: '#8b0020', roughness: 0.6 });
    for (const [a, b] of [[-7.9, -1.9], [-1.1, 5.6]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, b - a, 6), ropeM); r.rotation.z = Math.PI / 2; r.position.set((a + b) / 2, DY + 0.85, -4.5); g.add(r); addBox(X((a + b) / 2), Z(-4.5), b - a, 0.2, 'vipRope'); }
    for (const px of [-7.9, -4.9, -1.9, -1.1, 2.2, 5.5]) { cyl(0.05, 0.07, 0.95, '#d4af37', px, DY + 0.47, -4.5, g, 8, gold); cyl(0.08, 0.08, 0.08, '#d4af37', px, DY + 0.98, -4.5, g, 8, gold); }
    C.vipGate = addBox(X(-1.5), Z(-4.5), 0.8, 0.2, 'vipGate'); const gateRope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6), ropeM); gateRope.rotation.z = Math.PI / 2; gateRope.position.set(-1.5, DY + 0.85, -4.5); g.add(gateRope); C.vipGateMesh = gateRope;
    const vipSign = textSprite('🍾 KHU VIP', { size: 44, h: 0.6, bg: 'rgba(60,0,40,0.8)', border: '#d4af37' }); vipSign.position.set(X(-1.5), DY + 2.6, Z(-4.5)); scene.add(vipSign);
    addSpot({ kind: 'staff', role: 'host', x: X(-1.5), z: Z(-3.7), y: DY, rot: Math.PI, anim: 'idle' });
    // Khu Master: raised gold balcony (north-west), stairs, best view of the DJ
    const MY = DY + 1.6; deck(X(-6.1), Z(4.45), 4.2, 5.5, MY, '#2a2008');
    box(4.2, 1.6, 5.5, '#1a1408', -6.1, DY + 0.8, 4.45, g);
    for (const [y, x0] of [[DY + 1.2, -3.7], [DY + 0.8, -3.1], [DY + 0.4, -2.5]]) deck(X(x0), Z(6.6), 0.6, 1.2, y, '#3a2e10');
    const railM = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.9, roughness: 0.2, emissive: '#5a4000', emissiveIntensity: 0.4 });
    const rail = (w, d, lx, lz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), railM); m.position.set(lx, MY + 1.0, lz); g.add(m); const m2 = m.clone(); m2.position.y = MY + 0.5; g.add(m2); };
    rail(4.2, 0.06, -6.1, 1.72); rail(0.06, 4.2, -4.02, 3.8); addBox(X(-6.1), Z(1.72), 4.2, 0.15, 'masterRail'); addBox(X(-4.02), Z(3.8), 0.15, 4.2, 'masterRail');
    for (let i = 0; i <= 6; i++) { cyl(0.03, 0.03, 1.0, '#d4af37', -8.2 + i * 0.7, MY + 0.5, 1.72, g, 6, gold); if (i < 6) cyl(0.03, 0.03, 1.0, '#d4af37', -4.02, MY + 0.5, 1.72 + i * 0.7, g, 6, gold); }
    const gS = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.05, 0.05), neonMat('#ffd54f')); gS.position.set(-6.1, MY - 0.05, 1.68); g.add(gS);
    C.masterGate = addBox(X(-4.0), Z(6.6), 0.2, 1.2, 'masterGate'); const mgm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.2), railM); mgm.position.set(-4.0, MY + 0.8, 6.6); g.add(mgm); C.masterGateMesh = mgm;
    const ms = []; for (const [sx, sz] of [[-7.6, 2.6], [-7.6, 3.6], [-7.6, 4.6], [-6.0, 2.6], [-6.0, 3.6], [-6.0, 4.6]]) { box(0.7, 0.45, 0.8, '#d4af37', sx, MY + 0.22, sz, g, gold); box(0.18, 0.7, 0.8, '#b8902a', sx - 0.36, MY + 0.55, sz, g, gold);
      ms.push(addSpot({ kind: 'masterseat', venue: 'club', x: X(sx), z: Z(sz), y: MY, seatH: 0.45, rot: Math.PI / 2, anim: 'sit', seat: true, prop: 'glass', clubZone: 'master' })); }
    cyl(0.4, 0.35, 0.42, '#1a1a1a', -5.0, MY + 0.21, 3.6, g, 14); cyl(0.45, 0.45, 0.04, '#d4af37', -5.0, MY + 0.44, 3.6, g, 14, gold); addBox(X(-5.0), Z(3.6), 0.8, 0.8);
    const mSign = textSprite('👑 KHU MASTER', { size: 44, h: 0.6, bg: 'rgba(50,35,0,0.85)', border: '#ffd54f' }); mSign.position.set(X(-6.1), MY + 2.5, Z(2.2)); scene.add(mSign);
    // Master lounge prop set: blue tufted velvet armchair ("ghế boss"), round table with cream cloth, rotary phone, champagne, candle, gold chandelier
    { const bc = createProp('armchair'); bc.position.set(-7.6, MY, 6.3); bc.rotation.y = Math.PI / 2; g.add(bc);
      C.bossSeat = addSpot({ kind: 'bossseat', venue: 'club', x: X(-7.6) + 0.12, z: Z(6.3), y: MY, seatH: 0.5, rot: Math.PI / 2, anim: 'boss', panim: 'boss', seat: true, clubZone: 'master', boss: true });
      cyl(0.42, 0.5, 0.74, '#e8dcc0', -7.45, MY + 0.37, 5.42, g, 16); cyl(0.44, 0.44, 0.02, '#f3ead6', -7.45, MY + 0.75, 5.42, g, 16); addBox(X(-7.45), Z(5.42), 0.9, 0.9);
      box(0.2, 0.06, 0.16, '#151515', -7.3, MY + 0.79, 5.3, g, { metalness: 0.4, roughness: 0.3 }); cyl(0.05, 0.05, 0.02, '#d9d9d9', -7.3, MY + 0.83, 5.3, g, 12); box(0.18, 0.04, 0.05, '#111', -7.3, MY + 0.86, 5.3, g);
      for (const [bx, bz] of [[-7.62, 5.55], [-7.5, 5.66]]) { cyl(0.04, 0.045, 0.24, '#7a0f1c', bx, MY + 0.88, bz, g, 8, { metalness: 0.3, roughness: 0.25 }); cyl(0.015, 0.03, 0.08, '#d4af37', bx, MY + 1.04, bz, g, 6, gold); }
      cyl(0.035, 0.05, 0.06, '#d4af37', -7.7, MY + 0.79, 5.2, g, 8, gold); cyl(0.012, 0.012, 0.22, '#fff8e1', -7.7, MY + 0.93, 5.2, g, 6); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffcc66' })); fl.position.set(-7.7, MY + 1.06, 5.2); fl.scale.y = 1.8; g.add(fl);
      const ch = new THREE.Group(); ch.position.set(-6.9, MY + 2.6, 5.7); g.add(ch); const gm = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.9, roughness: 0.25, emissive: '#5a4000', emissiveIntensity: 0.5 });
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 5), gm); rod.position.y = 0.35; ch.add(rod); for (const [r, y] of [[0.42, 0], [0.26, 0.2]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 5, 20), gm); ring.rotation.x = Math.PI / 2; ring.position.y = y; ch.add(ring);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const cnd = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.09, 5), new THREE.MeshBasicMaterial({ color: '#fff3d0' })); cnd.position.set(Math.cos(a) * r, y + 0.06, Math.sin(a) * r); ch.add(cnd); const fm = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffc04d' })); fm.position.set(Math.cos(a) * r, y + 0.12, Math.sin(a) * r); ch.add(fm); } }
      const cl = new THREE.PointLight('#ffcf7a', 1.4, 5); cl.position.set(-6.9, MY + 2.3, 5.7); g.add(cl);
      const bs = textSprite('👑 Ghế boss', { size: 34, h: 0.36, bg: 'rgba(20,30,70,0.8)', border: '#ffd54f' }); bs.position.set(X(-7.6), MY + 1.75, Z(6.3)); scene.add(bs); C.bossLbl = bs; }
    C.master = { y: MY, seats: ms, x: X(-6.1), z: Z(4.45), contains: (x, z) => x > X(-8.2) && x < X(-4.0) && z > Z(1.7) && z < Z(7.2) };
    // lasers, moving heads, haze
    const lasers = []; const lasG = new THREE.CylinderGeometry(0.015, 0.015, 15, 4, 1, true); lasG.translate(0, -7.5, 0); lasG.rotateZ(Math.PI / 2); lasG.rotateY(Math.PI);
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(lasG, new THREE.MeshBasicMaterial({ color: ['#00ff66', '#ff2fbf', '#21e6ff', '#ff3030'][i % 4], transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.position.set(X(6.0), DY + 3.9, Z(i < 4 ? -1.2 : 1.2)); scene.add(m); lasers.push(m); }
    const heads = []; const headG = new THREE.ConeGeometry(1.0, 5.2, 18, 1, true); headG.translate(0, -2.6, 0);
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(headG, new THREE.MeshBasicMaterial({ color: ['#b04dff', '#21e6ff', '#ff2fbf', '#ffe600'][i], transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      m.position.set(X(-2 + (i % 2) * 4.5), DY + WH - 0.2, Z(i < 2 ? -3 : 3)); scene.add(m); heads.push(m); box(0.4, 0.4, 0.4, '#222', -2 + (i % 2) * 4.5, DY + WH - 0.1, i < 2 ? -3 : 3, g); }
    const hc = document.createElement('canvas'); hc.width = hc.height = 64; const hx = hc.getContext('2d'); const gr = hx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); hx.fillStyle = gr; hx.fillRect(0, 0, 64, 64);
    const hazeT = new THREE.CanvasTexture(hc); const haze = [];
    for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: hazeT, color: '#c9a0ff', transparent: true, opacity: 0.05, depthWrite: false })); s.scale.setScalar(rr(3.5, 5.5)); s.position.set(X(rr(-6, 5)), DY + rr(0.6, 2.4), Z(rr(-5, 5))); s.userData.p = rr(0, 6); scene.add(s); haze.push(s); }
    const clubL = new THREE.PointLight('#b04dff', 0, 18, 1.6); clubL.position.set(X(0.5), DY + 4.5, v.z); scene.add(clubL); C.light = clubL;
    const fill = new THREE.PointLight('#ffd9a8', 0, 12, 1.8); fill.position.set(X(-5.5), DY + 4.2, Z(2)); scene.add(fill);
    const cc = new THREE.Color();
    W.updaters.push((t, beat, bi) => { const on = C.open; const vis = on && (C.inside || C.near);
      lasers.forEach((m, i) => { m.visible = vis && (bi % 8 < 6); m.rotation.y = Math.sin(t * 0.9 + i * 0.6) * 0.55; m.rotation.z = -0.18 + Math.sin(t * 1.3 + i) * 0.16; });
      heads.forEach((m, i) => { m.visible = vis; m.rotation.x = Math.sin(t * 0.8 + i * 1.7) * 0.5; m.rotation.z = Math.cos(t * 0.7 + i) * 0.5; m.material.opacity = 0.05 + beat * 0.04; });
      haze.forEach((s, i) => { s.visible = on && C.inside; s.position.y = DY + 1.2 + Math.sin(t * 0.2 + s.userData.p) * 0.8; s.material.color.copy(pal[(bi + i) % pal.length]).lerp(cc.set('#ffffff'), 0.15); const cam = window.__game && window.__game.camera; const dd = cam ? cam.position.distanceTo(s.position) : 9; s.material.opacity = 0.05 * Math.min(1, Math.max(0, (dd - 2.5) / 4)); });
      clubL.intensity = on ? (C.inside ? 22 : 6) + beat * 10 : (C.inside ? 6 : 0); clubL.color.copy(pal[bi % pal.length]); fill.intensity = C.inside ? (on ? 6 : 10) : 0; });
    W.venues.club = { id: 'club', name: 'Vũ Trường', icon: '🪩', x: v.x, z: v.z, counter: { x: X(1.6), z: Z(5.3) }, entry: { x: X(-HW - 2.2), z: v.z }, inner: { x: X(-HW + 1.2), z: v.z }, radius: 9,
      menu: [{ id: 'cocktailc', name: 'Cocktail Galaxy', icon: '🍸', price: 25, prop: 'glass', color: '#b04dff' }, { id: 'tequila', name: 'Shot "Sóng Đêm"', icon: '🥃', price: 15, prop: 'glass', color: '#ffb300' }, { id: 'nuocsuoi', name: 'Nước suối', icon: '💧', price: 5, prop: 'glass', color: '#bbdefb' }, { id: 'biaclub', name: 'Bia chai', icon: '🍺', price: 12, prop: 'beer' }] };
    label('🪩 Vũ Trường', X(-HW - 0.6), DY + 6.6, v.z);
  }
  // ---- Drinks kiosk ----
  { const v = V.kiosk; const g = new THREE.Group(); g.position.set(v.x, Y, v.z); scene.add(g);
    box(3.6, 1.1, 0.8, '#c48a4a', 0, 0.55, 0.3, g); addBox(v.x, v.z + 0.3, 3.6, 0.8);
    box(3.6, 2.6, 0.2, '#a86f38', 0, 1.3, -1.6, g); addBox(v.x, v.z - 1.6, 3.6, 0.2);
    for (const [px, pz] of [[-1.7, 0.6], [1.7, 0.6], [-1.7, -1.6], [1.7, -1.6]]) cyl(0.08, 0.08, 2.9, '#6b4226', px, 1.45, pz, g);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 4), mat('#d9b45a')); roof.rotation.y = Math.PI / 4; roof.position.set(0, 3.4, -0.5); g.add(roof);
    for (let i = 0; i < 6; i++) { const co = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat('#5c9c2e')); co.position.set(-1.2 + i * 0.48, 1.25, 0.35); g.add(co); }
    for (let i = 0; i < 3; i++) { const bl = cyl(0.13, 0.11, 0.35, ['#ff8a65', '#aed581', '#fff176'][i], 1.0 - i * 0.4, 1.25, -1.1, g); }
    const sn = sign('QUẦY ĐỒ UỐNG', '#1b5e20', 3.4, 0.6, 60, '#fff8e1'); sn.position.set(0, 2.55, 0.72); g.add(sn);
    addSpot({ kind: 'staff', role: 'vendor', x: v.x, z: v.z - 0.6, y: Y, rot: 0, anim: 'serve' });
    W.queue = [0, 1, 2, 3, 4].map(i => ({ x: v.x + 0.2, z: v.z + 1.4 + i * 0.85 }));
    for (const s of [-1, 1]) { cyl(0.2, 0.2, 0.06, '#e07b3a', v.x + s * 2.6, Y + 0.7, v.z + 1.0); cyl(0.04, 0.04, 0.7, '#777', v.x + s * 2.6, Y + 0.35, v.z + 1.0);
      addSpot({ kind: 'stool', venue: 'kiosk', x: v.x + s * 2.6, z: v.z + 1.0, y: Y, seatH: 0.74, rot: Math.PI + s * 0.6, anim: 'drink', seat: true, prop: 'coconut' }); }
    W.venues.kiosk = { id: 'kiosk', name: 'Quầy Đồ Uống', icon: '🥥', x: v.x, z: v.z, counter: { x: v.x, z: v.z + 1.2 }, entry: { x: v.x, z: v.z + 5 }, radius: 4,
      menu: [{ id: 'nuocdua', name: 'Nước dừa', icon: '🥥', price: 8, prop: 'coconut' }, { id: 'sinhtobo', name: 'Sinh tố bơ', icon: '🥑', price: 12, prop: 'glass', color: '#a5d66b' }, { id: 'nuocepcam', name: 'Nước ép cam', icon: '🍊', price: 10, prop: 'glass', color: '#ffa726' }, { id: 'nuocmia', name: 'Nước mía', icon: '🧃', price: 6, prop: 'glass', color: '#e8e29a' }] };
    label('🥥 Quầy Đồ Uống', v.x, Y + 4.8, v.z);
  }

  // ================= BEACH =================
  const findZ = (x, targetH, z0 = 20, z1 = 80) => { for (let z = z0; z < z1; z += 0.25) if (height(x, z) <= targetH) return z; return z1; };
  const umbCols = [['#ff5252', '#ffffff'], ['#2196f3', '#ffffff'], ['#ffeb3b', '#ff9800'], ['#4caf50', '#ffffff'], ['#e91e63', '#fce4ec']];
  const umbGeo = new THREE.ConeGeometry(1.6, 0.6, 8, 1, true);
  let ui = 0;
  for (let x = -4; x <= 26; x += 5) { // loungers + umbrellas
    const z = findZ(x, 0.95); const y = height(x, z); const cols2 = umbCols[ui++ % umbCols.length];
    cyl(0.04, 0.04, 2.6, '#eee', x, y + 1.3, z); const u = new THREE.Mesh(umbGeo, mat(cols2[0], { side: THREE.DoubleSide, flatShading: true })); u.position.set(x, y + 2.7, z); scene.add(u);
    const u2 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.2, 8), mat(cols2[1])); u2.position.set(x, y + 3.0, z); scene.add(u2);
    W.circles.push({ x, z, r: 0.12 });
    for (const s of [-1, 1]) { const lx = x + s * 0.8, lz = z; const ly = height(lx, lz);
      const lg = new THREE.Group(); lg.position.set(lx, ly, lz); scene.add(lg);
      box(0.7, 0.08, 1.4, '#ffffff', 0, 0.36, 0.0, lg); const back = box(0.7, 0.08, 0.8, '#ffffff', 0, 0.55, -0.95, lg); back.rotation.x = -0.6;
      box(0.66, 0.03, 2.0, s < 0 ? cols2[0] : '#80deea', 0, 0.42, -0.2, lg);
      for (const [a, b] of [[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]]) box(0.05, 0.34, 0.05, '#bbb', a, 0.17, b, lg);
      addSpot({ kind: 'lounger', venue: 'beach', x: lx, z: lz + 0.75, y: ly, seatH: 0.42, rot: 0, anim: 'lie', seat: true, lie: true });
    }
  }
  // VIP cabana
  { const x = 36, z = findZ(36, 1.0) - 1, y = height(x, z); const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    box(5, 0.25, 5, '#f5f5f5', 0, 0.12, 0, g);
    for (const [px, pz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) cyl(0.08, 0.08, 3, '#d4af37', px, 1.6, pz, g, 8, { metalness: 0.7, roughness: 0.3 });
    box(5.2, 0.2, 5.2, '#ffffff', 0, 3.1, 0, g); const crownR = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1, 4), mat('#ffffff')); crownR.rotation.y = Math.PI / 4; crownR.position.y = 3.7; g.add(crownR);
    const curtM = new THREE.MeshStandardMaterial({ color: '#fff8f0', transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    for (const [px, pz, ry] of [[-2.4, 0, Math.PI / 2], [2.4, 0, Math.PI / 2], [0, -2.4, 0]]) { const cu = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.9), curtM); cu.position.set(px, 1.6, pz); cu.rotation.y = ry; g.add(cu); W.updaters.push((t) => cu.rotation.z = Math.sin(t * 1.3 + px) * 0.02); }
    for (const s of [-1, 1]) { box(1, 0.4, 2, '#d4af37', s * 1.1, 0.45, -0.4, g); box(0.95, 0.12, 1.9, '#ffffff', s * 1.1, 0.7, -0.4, g);
      addSpot({ kind: 'lounger', venue: 'cabana', x: x + s * 1.1, z: z + 0.55, y: y + 0.3, seatH: 0.48, rot: 0, anim: 'lie', seat: true, lie: true, vip: true }); }
    cyl(0.5, 0.5, 0.05, '#d4af37', 0, 0.7, 1.2, g, 12);
    const rope = []; for (let i = 0; i < 6; i++) { const px = -2.5 + i; cyl(0.05, 0.08, 0.9, '#d4af37', px, 0.45, 3.0, g, 8, { metalness: 0.8, roughness: 0.3 }); if (i < 5) { const r = box(1, 0.06, 0.06, '#b71c1c', px + 0.5, 0.75, 3.0, g); rope.push(r); } }
    const sn = sign('VIP CABANA', '#d4af37', 3, 0.7, 90); sn.position.set(0, 3.55, 2.62); g.add(sn);
    W.cabana = { x, z, rope, collider: addBox(x, z + 0.3, 5.6, 5.8, 'vip') };
    label('👑 Lều VIP', x, y + 5.3, z);
  }
  // volleyball court
  { const x = -30, z = findZ(-30, 0.9) - 1, y = height(x, z); W.volley = { x, z, y };
    for (const s of [-1, 1]) cyl(0.06, 0.06, 2.5, '#eeeeee', x + s * 4, y + 1.25, z);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.8, 16, 2), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true })); net.position.set(x, y + 2.05, z); scene.add(net);
    const lineM = new THREE.MeshBasicMaterial({ color: '#1e88e5' }); for (const [w, d, px, pz] of [[8, 0.08, 0, -4], [8, 0.08, 0, 4], [0.08, 8, -4, 0], [0.08, 8, 4, 0]]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineM); l.rotation.x = -Math.PI / 2; l.position.set(x + px, height(x + px, z + pz) + 0.03, z + pz); scene.add(l); }
    for (const [dx, dz] of [[-1.8, -2.2], [1.8, -2.5], [-1.5, 2.3], [1.8, 2.2]]) addSpot({ kind: 'volley', venue: 'beach', x: x + dx, z: z + dz, y: height(x + dx, z + dz), rot: dz < 0 ? 0 : Math.PI, anim: 'volley' });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat('#ffffff')); ball.position.set(x, y + 2, z); scene.add(ball); W.volley.ball = ball;
  }
  // sandcastle
  { const x = -12, z = findZ(-12, 0.55) - 0.5, y = height(x, z); const sm = mat('#d9c08a');
    cyl(0.5, 0.6, 0.4, '#d9c08a', x, y + 0.2, z); for (const [a, b] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) { cyl(0.14, 0.16, 0.55, '#d9c08a', x + a, y + 0.27, z + b); const cn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 8), sm); cn.position.set(x + a, y + 0.67, z + b); scene.add(cn); }
    const cn = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 8), sm); cn.position.set(x, y + 0.65, z); scene.add(cn);
    box(0.3, 0.3, 0.3, '#ff5252', x + 1.3, y + 0.15, z - 0.4); // bucket-ish
    for (const [dx, dz, r] of [[0, 1.1, Math.PI], [1.0, 0.1, -Math.PI / 2], [-1.0, -0.2, Math.PI / 2]]) addSpot({ kind: 'castle', venue: 'beach', x: x + dx, z: z + dz, y: height(x + dx, z + dz), rot: r, anim: 'dig' });
  }
  // swimming & wading spots, photo spots, shore route
  for (let i = 0; i < 9; i++) { const x = -20 + i * 6 + rr(-1.5, 1.5); const z = findZ(x, -1.1, 30, 90) + rr(0, 5); addSpot({ kind: 'swim', venue: 'sea', x, z, y: -0.3, rot: rr(0, 6.28), anim: 'swim', water: true }); }
  for (let i = 0; i < 7; i++) { const x = -26 + i * 8 + rr(-1, 1); const z = findZ(x, -0.3, 30, 90); addSpot({ kind: 'wade', venue: 'sea', x, z, y: height(x, z), rot: rr(-0.8, 0.8), anim: 'wade' }); }
  for (const x of [-22, -4, 14, 30]) { const z = findZ(x, 0.3); addSpot({ kind: 'photo', venue: 'beach', x, z, y: height(x, z), rot: 0, anim: 'photo', prop: 'phone' }); }
  W.routes.shore = []; for (let x = -38; x <= 40; x += 6) { const z = findZ(x, 0.25); W.routes.shore.push({ x, z }); }
  // pier & boat
  { const x = -18; const z0 = findZ(x, 0.4) - 2, len = 18; const deckY = 0.85; deck(x, z0 + len / 2, 2.6, len, deckY, '#9c6b3e');
    for (let k = 0; k <= len; k += 3) for (const s of [-1, 1]) cyl(0.1, 0.1, 2.5, '#5d3a1f', x + s * 1.25, deckY - 1.1, z0 + k);
    const boat = new THREE.Group(); boat.position.set(x + 3, 0, z0 + len - 2); scene.add(boat);
    box(2.2, 0.8, 6, '#ffffff', 0, 0.2, 0, boat); box(2.25, 0.15, 6.05, '#1565c0', 0, 0.55, 0, boat); box(1.6, 1.2, 2, '#e3f2fd', 0, 1.2, -0.5, boat); const bow = cyl(0, 1.1, 1.6, '#ffffff', 0, 0.2, 3.7, boat, 4); bow.rotation.x = Math.PI / 2; bow.scale.set(1, 1, 0.5);
    W.updaters.push((t) => { boat.position.y = Math.sin(t * 1.2) * 0.08; boat.rotation.z = Math.sin(t * 0.9) * 0.03; });
    addBox(x + 3, z0 + len - 2, 2.4, 7.5);
    W.pier = { x, z0, z1: z0 + len, y: deckY }; W.spawn = { x, z: z0 + len - 1.5 };
    const sn = sign('BẾN TÀU ĐẢO NGỌC', '#0d47a1', 4, 0.7, 58, '#ffffff'); sn.position.set(x, deckY + 2.2, z0 + len - 0.2); scene.add(sn);
    for (const s of [-1, 1]) cyl(0.07, 0.07, 2.4, '#5d3a1f', x + s * 1.9, deckY + 1.1, z0 + len - 0.2);
    W.circles.push({ x: x - 1.9, z: z0 + len - 0.2, r: 0.15 }, { x: x + 1.9, z: z0 + len - 0.2, r: 0.15 });
    label('⚓ Bến Tàu', x, deckY + 4, z0 + len - 3);
  }

  // ================= NATURE =================
  // lagoon & waterfall
  { const lx = -33, lz = -9; let zt = lz, zb = lz; for (let z = lz; z > lz - 25; z -= 0.2) { if (height(lx, z) < 0 ) zb = z; if (height(lx, z) >= 5.2) { zt = z; break; } }
    const yt = height(lx, zt) + 0.2, len = Math.hypot(zb - zt, yt);
    const wc = document.createElement('canvas'); wc.width = 64; wc.height = 256; const x2 = wc.getContext('2d'); x2.fillStyle = 'rgba(190,235,255,0.7)'; x2.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 60; i++) { x2.fillStyle = `rgba(255,255,255,${rr(0.3, 0.9)})`; x2.fillRect(rr(0, 64), rr(0, 256), rr(1, 3), rr(20, 70)); }
    const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(2, 1);
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(3.6, len), new THREE.MeshBasicMaterial({ map: wt, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    wf.position.set(lx, yt / 2 + 0.2, (zt + zb) / 2); wf.rotation.x = -Math.atan2(yt, zb - zt) ; scene.add(wf);
    W.updaters.push((t) => { wt.offset.y = t * 1.2; });
    const foam = []; for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false })); f.position.set(lx + rr(-1.5, 1.5), 0.05, zb + rr(0, 1.2)); scene.add(f); foam.push(f); }
    W.updaters.push((t) => foam.forEach((f, i) => { const k = (t * 0.8 + i / 6) % 1; f.scale.set(0.6 + k, 0.3 + k * 0.4, 0.6 + k); f.material.opacity = 0.6 * (1 - k); }));
    W.lagoon = { x: lx, z: lz }; label('💧 Hồ & Thác Nước', lx, 9, lz - 3);
    for (const [dx, dz] of [[6, 2], [-5, 5], [4, 7]]) { const x = lx + dx, z = lz + dz; addSpot({ kind: 'view', venue: 'nature', x, z, y: height(x, z), rot: Math.atan2(lx - x, lz - 4 - z), anim: 'view' }); }
  }
  // rocks (instanced) + rock seats
  { const rg = new THREE.DodecahedronGeometry(1, 0); const rm = new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 1, flatShading: true }); const n = 70; const rocks = new THREE.InstancedMesh(rg, rm, n); const m4 = new THREE.Matrix4(); let k = 0;
    const put = (x, z, s, seat) => { const y = height(x, z); m4.compose(new THREE.Vector3(x, y + s * 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rr(0, 3), rr(0, 3), rr(0, 3))), new THREE.Vector3(s, s * 0.7, s)); rocks.setMatrixAt(k++, m4); W.circles.push({ x, z, r: s * 0.85 });
      if (seat) addSpot({ kind: 'rock', venue: 'nature', x, z, y: y + s * 0.3 + s * 0.6 - 0.05, seatH: 0, rot: seat, anim: 'sitRock', seat: true }); };
    for (const [x, z] of [[-3, -46], [6, -40], [26, -30], [-28, -24], [-14, -36]]) put(x, z, 0.75, Math.atan2(-x, 40 - z)); // seats looking toward sea (south)
    while (k < n) { const a = rr(0, 6.28), r = rr(46, 58); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (z > 30 && Math.abs(x) < 42) continue; if (height(x, z) > -0.5) put(x, z, rr(0.4, 1.6), 0); }
    rocks.count = k; scene.add(rocks); if (!mobile) rocks.castShadow = true;
    // viewpoints on hilltops
    for (const [x, z] of [[-2, -40], [27, -27], [-31, -21]]) addSpot({ kind: 'view', venue: 'nature', x, z, y: height(x, z), rot: Math.atan2(-x * 0.2, 1), anim: 'view' });
    for (const [x, z] of [[2, -38], [24, -25]]) addSpot({ kind: 'photo', venue: 'nature', x, z, y: height(x, z), rot: 0.2, anim: 'photo', prop: 'phone' });
    W.routes.hike = [{ x: 0, z: -24 }, { x: -4, z: -30 }, { x: -2, z: -36 }, { x: 4, z: -40 }, { x: 12, z: -34 }, { x: 20, z: -30 }, { x: 26, z: -24 }, { x: 18, z: -22 }];
    label('⛰️ Đồi Ngắm Cảnh', -2, height(-2, -40) + 5, -40);
  }
  // trees, palms, flowers (instanced, vertex-colored merged geos)
  const okTree = (x, z, minGap = 3) => { for (const k in V) { const v = V[k]; if (Math.abs(x - v.x) < v.w + 3 && Math.abs(z - v.z) < v.d + 3) return false; }
    for (const s of pathSegs) if (segDist(x, z, s) < minGap) return false;
    if (W.cabana && Math.hypot(x - W.cabana.x, z - W.cabana.z) < 6) return false; if (W.volley && Math.hypot(x - W.volley.x, z - W.volley.z) < 7) return false;
    if (Math.hypot(x - W.lagoon.x, z - W.lagoon.z) < 7.5) return false; if (Math.abs(x - W.pier.x) < 3 && z > W.pier.z0 - 4) return false; return true; };
  // path network (also paints terrain)
  const vv = W.venues; const center = { x: 0, z: 8 };
  const segs = [[W.spawn.x, W.pier.z0 - 0.5, -12, 36], [-12, 36, center.x, 30], [center.x, 30, center.x, center.z], [center.x, center.z, vv.restaurant.entry.x, vv.restaurant.entry.z], [center.x, center.z, vv.cafe.entry.x, vv.cafe.entry.z], [center.x, center.z, vv.bar.entry.x, vv.bar.entry.z], [center.x, center.z, vv.club.entry.x, vv.club.entry.z],
    [center.x, 30, vv.kiosk.entry.x, vv.kiosk.entry.z], [vv.bar.x, vv.bar.z - 6, 0, -24], [vv.restaurant.x - 6, vv.restaurant.z, -28, -1], [center.x, 30, 30, 34]];
  for (const s of segs) pathSegs.push(s);
  W._colorize(); W.center = center;
  // lamps along paths
  for (const s of segs) { const L = Math.hypot(s[2] - s[0], s[3] - s[1]); for (let d = 4; d < L - 2; d += 9) { const t = d / L, nx = -(s[3] - s[1]) / L, nz = (s[2] - s[0]) / L; const x = s[0] + (s[2] - s[0]) * t + nx * 1.8, z = s[1] + (s[3] - s[1]) * t + nz * 1.8; if (height(x, z) > 1 && okTreeLoose(x, z)) lamp(x, z); } }
  function okTreeLoose(x, z) { for (const k in V) { const v = V[k]; if (Math.abs(x - v.x) < v.w + 1 && Math.abs(z - v.z) < v.d + 1) return false; } return true; }
  { // palms
    const parts = []; for (let i = 0; i < 4; i++) parts.push([new THREE.CylinderGeometry(0.16 - i * 0.025, 0.2 - i * 0.025, 1.6, 7), M(i * i * 0.06, 0.8 + i * 1.55, 0, 0, 0, -0.04 * i), i % 2 ? '#8d6e4a' : '#7a5c3c']);
    const topX = 0.55, topY = 6.3; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const lg = new THREE.ConeGeometry(0.45, 3.2, 4, 1); lg.translate(0, 1.6, 0);
      parts.push([lg, M(topX, topY, 0, 0, a, 0).multiply(M(0, 0, 0, 0, 0, -1.9, 1, 1, 0.25)).multiply(new THREE.Matrix4().makeRotationX(0.25)), i % 2 ? '#3f9a3a' : '#2e7d32']); }
    for (let i = 0; i < 3; i++) parts.push([new THREE.SphereGeometry(0.17, 6, 5), M(topX + Math.cos(i * 2.1) * 0.2, topY - 0.15, Math.sin(i * 2.1) * 0.2), '#6d4c2f']);
    const pg = mergeGeos(parts); const pos = [];
    for (let i = 0; i < 400 && pos.length < 70; i++) { const a = rr(0, 6.28), r = rr(36, 47); const x = Math.cos(a) * r, z = Math.sin(a) * r; const h = height(x, z); if (h < 0.4 || h > 1.6) continue; if (!okTree(x, z, 2.5)) continue; if (z > 30 && x > -8 && x < 30 && h < 1.1) continue; if (pos.some(p => Math.hypot(p.x - x, p.z - z) < 3.5)) continue; pos.push({ x, z, h }); }
    for (const [x, z] of [[-8, 14], [8, 14], [-9, 22], [10, 22], [-6, 30], [8, 30], [-14, -4]]) pos.push({ x, z, h: height(x, z) });
    const im = new THREE.InstancedMesh(pg, vcMat, pos.length); const m4 = new THREE.Matrix4();
    pos.forEach((p, i) => { m4.compose(new THREE.Vector3(p.x, p.h - 0.1, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rr(0, 6.28), 0)), new THREE.Vector3().setScalar(rr(0.8, 1.15))); im.setMatrixAt(i, m4); W.circles.push({ x: p.x, z: p.z, r: 0.3 }); });
    if (!mobile) im.castShadow = true; scene.add(im);
    W.palms = im;
  }
  { // round trees on hills / grass
    const parts = [[new THREE.CylinderGeometry(0.15, 0.22, 1.6, 6), M(0, 0.8, 0), '#6d4c41'], [new THREE.IcosahedronGeometry(1.2, 0), M(0, 2.3, 0), '#2f7d32'], [new THREE.IcosahedronGeometry(0.9, 0), M(0.5, 2.9, 0.2), '#43a047'], [new THREE.IcosahedronGeometry(0.8, 0), M(-0.5, 2.7, -0.3), '#388e3c']];
    const parts2 = [[new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), M(0, 0.6, 0), '#5d4037'], [new THREE.ConeGeometry(1.1, 2.4, 7), M(0, 2.1, 0), '#1b5e20'], [new THREE.ConeGeometry(0.85, 1.9, 7), M(0, 3.2, 0), '#2e7d32']];
    for (const [pp, cnt] of [[parts, 90], [parts2, 60]]) { const g = mergeGeos(pp); const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), cnt); let k = 0; const m4 = new THREE.Matrix4();
      for (let i = 0; i < 2000 && k < cnt; i++) { const x = rr(-55, 55), z = rr(-58, 32); const h = height(x, z); const r = Math.hypot(x, z); if (h < 1.5 || r > 44) continue; if (r < 34 && z > -18 && rand() < 0.85) continue; if (!okTree(x, z, 3.5)) continue;
        m4.compose(new THREE.Vector3(x, h - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rr(0, 6), 0)), new THREE.Vector3().setScalar(rr(0.8, 1.4))); im.setMatrixAt(k++, m4); W.circles.push({ x, z, r: 0.35 }); }
      im.count = k; if (!mobile) im.castShadow = true; scene.add(im); W.trees.push(im); }
  }
  { // flowers & bushes
    const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 500); const m4 = new THREE.Matrix4(); const fc = ['#ff4081', '#ffeb3b', '#ffffff', '#e040fb', '#ff7043', '#40c4ff'].map(x => new THREE.Color(x)); let k = 0;
    for (let cl = 0; cl < 55 && k < 500; cl++) { let cx, cz, tries = 0; do { cx = rr(-42, 42); cz = rr(-45, 34); tries++; } while ((height(cx, cz) < 1.35 || !okTree(cx, cz, 1.8)) && tries < 40);
      const col = fc[cl % fc.length]; for (let j = 0; j < 9 && k < 500; j++) { const x = cx + rr(-1.2, 1.2), z = cz + rr(-1.2, 1.2); m4.makeTranslation(x, height(x, z) + 0.15, z); fl.setMatrixAt(k, m4); fl.setColorAt(k++, col); } }
    fl.count = k; scene.add(fl);
    const bu = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: '#3d8b37', flatShading: true }), 80); k = 0;
    for (let i = 0; i < 600 && k < 80; i++) { const x = rr(-45, 45), z = rr(-50, 34); if (height(x, z) < 1.35 || !okTree(x, z, 2)) continue; m4.compose(new THREE.Vector3(x, height(x, z) + 0.2, z), new THREE.Quaternion(), new THREE.Vector3(rr(0.7, 1.4), rr(0.5, 0.9), rr(0.7, 1.4))); bu.setMatrixAt(k++, m4); }
    bu.count = k; scene.add(bu);
  }
  // distant islands
  for (const [x, z, s] of [[-180, 120, 30], [160, 160, 22], [220, -60, 40], [-230, -120, 35], [60, 260, 26]]) { const m = new THREE.Mesh(new THREE.ConeGeometry(s, s * 0.45, 9), new THREE.MeshStandardMaterial({ color: '#4f7f56', flatShading: true })); m.position.set(x, s * 0.2 - 2, z); scene.add(m); }
  // signposts
  const signpost = (x, z, targets) => { const y = height(x, z); cyl(0.08, 0.1, 3, '#6d4c41', x, y + 1.5, z); W.circles.push({ x, z, r: 0.2 });
    targets.forEach((t, i) => { const yaw = Math.atan2(t.x - x, t.z - z); const g = new THREE.Group(); g.position.set(x, y + 2.6 - i * 0.42, z); g.rotation.y = yaw - Math.PI / 2; scene.add(g);
      const b = sign(t.name, '#3e2723', 1.9, 0.34, 72, '#ffe0b2'); b.position.x = 1.0; g.add(b); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 3), mat('#ffe0b2')); tip.rotation.z = -Math.PI / 2; tip.position.x = 2.08; g.add(tip); }); };
  const tg2 = (v, n) => ({ x: v.x, z: v.z, name: n });
  signpost(center.x + 1.6, center.z + 1.6, [tg2(vv.bar, 'Bar Beer'), tg2(vv.club, 'Vũ Trường'), tg2(vv.restaurant, 'Quán Ăn'), tg2(vv.cafe, 'Cafe'), tg2(vv.kiosk, 'Quầy Đồ Uống'), { x: 10, z: 50, name: 'Bãi Biển' }]);
  signpost(-11, 38, [tg2(center, 'Quảng Trường'), { x: 10, z: 50, name: 'Bãi Biển' }, { x: -33, z: -9, name: 'Thác Nước' }, { x: 36, z: 44, name: 'Lều VIP' }]);
  signpost(1.6, -24, [{ x: -2, z: -40, name: 'Đồi Ngắm Cảnh' }, tg2(vv.bar, 'Bar Beer'), tg2(vv.club, 'Vũ Trường')]);
  signpost(vv.club.entry.x - 1.5, vv.club.entry.z + 3.2, [tg2(vv.club, 'Vũ Trường'), tg2(vv.bar, 'Bar Beer'), tg2(center, 'Quảng Trường')]);
  // plaza fountain
  { const y = height(center.x, center.z); cyl(1.6, 1.8, 0.5, '#e0d7c6', center.x, y + 0.25, center.z, scene, 16); const w = cyl(1.4, 1.4, 0.05, '#4fc3f7', center.x, y + 0.48, center.z, scene, 16, { emissive: '#0277bd', emissiveIntensity: 0.3 }); cyl(0.15, 0.2, 1.4, '#e0d7c6', center.x, y + 0.9, center.z);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#bdeeff', transparent: true, opacity: 0.6, side: THREE.DoubleSide })); jet.position.set(center.x, y + 1.9, center.z); jet.rotation.x = Math.PI; scene.add(jet);
    W.updaters.push((t) => jet.scale.y = 1 + Math.sin(t * 5) * 0.08); W.circles.push({ x: center.x, z: center.z, r: 1.9 }); label('⛲ Quảng Trường', center.x, y + 4, center.z); }

  // walk height & blocking
  W.walkY = (x, z) => { let y = height(x, z); for (const d of W.decks) if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) y = Math.max(y, d.y); return y; };
  W.onDeck = (x, z) => W.decks.some(d => x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ);
  W.zoneName = (x, z) => { for (const k in W.venues) { const v = W.venues[k]; if (Math.hypot(x - v.x, z - v.z) < v.radius + 1) return v.icon + ' ' + v.name; }
    if (Math.hypot(x - W.cabana.x, z - W.cabana.z) < 5) return '👑 Lều VIP'; if (W.pier && Math.abs(x - W.pier.x) < 2 && z > W.pier.z0) return '⚓ Bến tàu';
    if (Math.hypot(x - W.lagoon.x, z - W.lagoon.z) < 10) return '💧 Hồ & Thác nước'; const h = height(x, z); if (h < 0) return '🌊 Biển'; if (h < 1.25) return '🏖️ Bãi biển';
    if (h > 3) return '⛰️ Đồi ngắm cảnh'; if (Math.hypot(x - center.x, z - center.z) < 8) return '⛲ Quảng trường'; return '🌴 Đảo Ngọc'; };

  // ---- time of day ----
  const TIMES = {
    day: { top: '#2f86e0', hor: '#cdeeff', sun: [0.45, 0.75, 0.5], sunCol: '#fff4dc', sunI: 2.6, hemiS: '#d6ecff', hemiG: '#cdb685', hemiI: 1.0, fog: '#cdeeff', sea: '#1fa3c9', lamp: 0.15, neon: 0.6, warm: 0, bar: 0, spot: 0, cone: 0.04, stars: 0, exp: 1.0 },
    sunset: { top: '#33306e', hor: '#ff9a5c', sun: [-0.35, 0.12, 0.93], sunCol: '#ffa060', sunI: 1.7, hemiS: '#ffc09a', hemiG: '#5a4060', hemiI: 0.7, fog: '#f0a07a', sea: '#2a7fa8', lamp: 1.2, neon: 1.0, warm: 8, bar: 10, spot: 40, cone: 0.1, stars: 0.15, exp: 1.0 },
    night: { top: '#040716', hor: '#151c44', sun: [0.3, 0.6, 0.6], sunCol: '#9fb4ff', sunI: 0.6, hemiS: '#4a5aa0', hemiG: '#1a1a28', hemiI: 0.75, fog: '#0d1433', sea: '#0c3d5e', lamp: 3, neon: 1.4, warm: 18, bar: 28, spot: 90, cone: 0.16, stars: 1, exp: 1.1 },
  };
  W.setTime = (mode, renderer) => { const T = TIMES[mode]; W.time = mode;
    skyU.top.value.set(T.top); skyU.hor.value.set(T.hor); skyU.sunDir.value.set(...T.sun).normalize(); skyU.sunCol.value.set(T.sunCol);
    W.sunDir = new THREE.Vector3(...T.sun).normalize(); sun.color.set(T.sunCol); sun.intensity = T.sunI; hemi.color.set(T.hemiS); hemi.groundColor.set(T.hemiG); hemi.intensity = T.hemiI;
    scene.fog.color.set(T.fog); seaMat.color.set(T.sea); W.lamps.forEach(m => m.emissiveIntensity = T.lamp); W.neon.forEach(m => m.color.copy(m.userData.base).multiplyScalar(T.neon));
    W.warmLights.forEach(l => l.intensity = mobile ? 0 : T.warm); W.barLight.intensity = T.bar; W.spots3.forEach(s => { s.sl.intensity = T.spot; s.cone.material.opacity = T.cone; });
    stars.material.opacity = T.stars; moon.material && (moon.material.opacity = T.stars); if (renderer) renderer.toneMappingExposure = T.exp; W.night = mode === 'night'; };
  // ---- real-time clock: blend between presets by hour (Asia/Bangkok) ----
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff6d8', fog: false, transparent: true, opacity: 0 })); scene.add(moon); W.moon = moon;
  const KEYS = [[0, 'night'], [5, 'night'], [6.2, 'sunset'], [7.6, 'day'], [16.6, 'day'], [18.0, 'sunset'], [19.3, 'night'], [24, 'night']];
  const tc = new THREE.Color(), tc2 = new THREE.Color(), lerpC = (a, b, k) => '#' + tc.set(a).lerp(tc2.set(b), k).getHexString();
  function mix(A, B, k) { const o = {}; for (const key in A) { const a = A[key], b = B[key]; o[key] = typeof a === 'number' ? a + (b - a) * k : Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : (typeof a === 'string' && a[0] === '#') ? lerpC(a, b, k) : a; } return o; }
  W.setClock = (h, renderer) => { let i = 0; while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++; const [h0, m0] = KEYS[i], [h1, m1] = KEYS[i + 1]; const k = h1 > h0 ? Math.min(1, Math.max(0, (h - h0) / (h1 - h0))) : 0;
    TIMES._c = mix(TIMES[m0], TIMES[m1], k); if (h < 12 && (m0 === 'sunset' || m1 === 'sunset')) TIMES._c.sun = [-TIMES._c.sun[0], TIMES._c.sun[1], -TIMES._c.sun[2]]; // sunrise in the east
    W.setTime('_c', renderer); W.time = k < 0.5 ? m0 : m1; W.night = h >= 19 || h < 5.5; W.hour = h;
    const ma = (h + 6) / 24 * Math.PI * 2; moon.material.opacity = TIMES._c.stars; W.moonDir = new THREE.Vector3(Math.cos(ma) * 0.6, 0.35 + 0.4 * Math.abs(Math.sin(ma)), -0.7).normalize(); };
  W.update = (t, dt, beat, bi, playerPos) => { if (W.moonDir) moon.position.set(playerPos.x + W.moonDir.x * 300, W.moonDir.y * 300, playerPos.z + W.moonDir.z * 300); seaU.uTime.value = t; for (const u of W.updaters) u(t, beat, bi, W.night);
    sky.position.set(playerPos.x, 0, playerPos.z); stars.position.copy(sky.position);
    sun.position.set(playerPos.x + W.sunDir.x * 60, W.sunDir.y * 60 + 5, playerPos.z + W.sunDir.z * 60); sun.target.position.set(playerPos.x, 0, playerPos.z); };

  // minimap image
  const mc = document.createElement('canvas'); mc.width = mc.height = 160; const mx = mc.getContext('2d'); const img = mx.createImageData(160, 160);
  for (let j = 0; j < 160; j++) for (let i = 0; i < 160; i++) { const x = (i / 160 - 0.5) * 140, z = (j / 160 - 0.5) * 140; const h = height(x, z); let col;
    if (h < -0.5) col = [20, 110, 160]; else if (h < 0) col = [60, 170, 200]; else if (h < 1.25) col = [234, 217, 166]; else if (h > 6) col = [140, 135, 120]; else col = [92, 170, 74];
    let md = 9; if (h > 1.2) for (const s of pathSegs) md = Math.min(md, segDist(x, z, s)); if (md < 1.2) col = [216, 192, 138];
    const o = (j * 160 + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255; }
  mx.putImageData(img, 0, 0); W.minimapBase = mc; W.mapScale = 160 / 140;
  return W;
}
export function segDist(x, z, s) { const [ax, az, bx, bz] = s; const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); }
