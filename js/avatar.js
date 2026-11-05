import * as THREE from 'three';
import { RoundedBoxGeometry } from './jsm/geometries/RoundedBoxGeometry.js';
import { Q } from './quality.js';
// quality-aware geometry: rounded boxes + smoother curved parts on Trung bình/Cao
const _s = (n, min = 3) => Math.max(min, Math.round((n || 8) * Q.seg));
const _BX = (w, h, d) => Q.rounded && Math.min(w, h, d) > 0.012 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.4) : new THREE.BoxGeometry(w, h, d);
const _SG = (r, ws, hs, ...a) => new THREE.SphereGeometry(r, _s(ws, 3), _s(hs, 2), ...a);
const _CY = (rt, rb, h, rs, ...a) => new THREE.CylinderGeometry(rt, rb, h, _s(rs, 3), ...a);
const _CA = (r, l, cs, rs) => new THREE.CapsuleGeometry(r, l, _s(cs, 2), _s(rs, 4));
// smooth organic body parts: lathe through a Catmull-Rom profile [[y, r], ...] (bottom→top), closed at both ends
const _LA = (prof, rs = 16, n = 22) => { const cv = new THREE.SplineCurve(prof.map(([y, r]) => new THREE.Vector2(r, y))); const pts = cv.getPoints(_s(n, 8)).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
  pts[0].x = 0; pts[pts.length - 1].x = 0; const g = new THREE.LatheGeometry(pts, _s(rs, 8)); g.computeVertexNormals(); return g; };
const _limb = (rTop, rMid, rBot, len) => { const h = len / 2; return _LA([[-h, 0], [-h + rBot * 0.35, rBot * 0.8], [-h + rBot, rBot], [-h * 0.15, rMid], [h * 0.55, rTop * 0.97], [h - rTop * 0.9, rTop], [h - rTop * 0.3, rTop * 0.7], [h, 0]], 16, 26); };

const G = {
  leg: Q.rounded ? _limb(0.104, 0.084, 0.07, 0.81) : _CA(0.095, 0.62, 3, 8),
  arm: Q.rounded ? _limb(0.072, 0.06, 0.054, 0.596) : _CA(0.068, 0.46, 3, 8),
  hand: _SG(0.075, 12, 9),
  torso: _CA(0.22, 0.38, 4, 10),
  torsoM: Q.rounded ? _LA([[-0.41, 0], [-0.4, 0.15], [-0.34, 0.2], [-0.16, 0.198], [0.06, 0.214], [0.22, 0.228], [0.31, 0.215], [0.37, 0.16], [0.405, 0.07], [0.41, 0]], 20, 30) : null,
  torsoF: Q.rounded ? _LA([[-0.41, 0], [-0.4, 0.16], [-0.33, 0.215], [-0.18, 0.19], [-0.02, 0.182], [0.13, 0.218], [0.24, 0.212], [0.32, 0.192], [0.375, 0.14], [0.405, 0.06], [0.41, 0]], 20, 30) : null,
  hips: _CY(0.225, 0.2, 0.26, 16),
  head: _SG(0.2, 22, 16),
  eye: _SG(0.028, 6, 4),
  hairCap: _SG(0.215, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  hairLong: _BX(0.4, 0.42, 0.12),
  bun: _SG(0.1, 8, 6),
  band: _CY(0.228, 0.228, 0.13, 10),
  brim: _CY(0.36, 0.36, 0.025, 14),
  brimWide: _CY(0.46, 0.46, 0.02, 16),
  crown: _CY(0.17, 0.2, 0.16, 12),
  capTop: _SG(0.215, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
  capBill: _BX(0.26, 0.025, 0.2),
  glasses: _BX(0.3, 0.07, 0.03),
  torus: new THREE.TorusGeometry(0.19, 0.035, 6, 14),
  apron: _BX(0.36, 0.55, 0.04),
  chef: _CY(0.17, 0.15, 0.26, 10),
  shadow: new THREE.CircleGeometry(0.38, 12),
};
const matCache = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra }));
  return matCache.get(key);
}
const texCache = new Map();
function hawaiiTex(base) {
  if (texCache.has(base)) return texCache.get(base);
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 64, 64);
  const cols = ['#fff6a8', '#ff7aa8', '#ffffff', '#7af0c8'];
  for (let i = 0; i < 14; i++) { x.fillStyle = cols[i % 4]; const px = (i * 37) % 64, py = (i * 23) % 64;
    for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(px + Math.cos(k * 1.256) * 4, py + Math.sin(k * 1.256) * 4, 3, 0, 7); x.fill(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }); texCache.set(base, m); return m;
}
const PUPIL = new THREE.MeshStandardMaterial({ color: '#080808', roughness: 0.2 }), GLINT = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

// 16 inclusive skin tones (always free) – [hex, Vietnamese name, undertone]
export const SKIN_TONES = [['#fbe5d8', 'Sứ trắng', 'lạnh'], ['#f6d6c6', 'Trắng hồng', 'lạnh'], ['#f6d3b3', 'Sáng ấm', 'ấm'], ['#f1c9a3', 'Ngà', 'trung tính'], ['#e8c59c', 'Sáng olive', 'olive'],
  ['#eac096', 'Á Đông sáng', 'ấm'], ['#e0b183', 'Á Đông ấm', 'ấm'], ['#d8aa82', 'Á Đông trung tính', 'trung tính'], ['#cf9a6b', 'Rám nắng', 'ấm'], ['#c08a5a', 'Bánh mật', 'vàng'],
  ['#ad7c50', 'Olive đậm', 'olive'], ['#97603d', 'Nâu', 'ấm'], ['#7d4d33', 'Nâu đỏ', 'ấm'], ['#64402e', 'Nâu sẫm', 'lạnh'], ['#4c2e20', 'Socola', 'trung tính'], ['#352016', 'Rất sẫm', 'lạnh']];
export const SKINS = SKIN_TONES.map(t => t[0]);
export const HAIRS = ['#1b1210', '#2c1b12', '#5a3a22', '#8b5a2b', '#a0522d', '#8e2b1a', '#d8b35a', '#ead9b0', '#b8b8b8', '#7a2a5a', '#2a2a6a', '#e86aa8', '#2a6fd6', '#c0c0c0', '#f5f5f5', '#b388ff', '#26c6da', '#66bb6a', '#ff7043', '#e53935', '#3b2a5a'];

function mk(geo, m, parent, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; }

// ---- clothing / face geometry ----
const CG = {
  sleeve: _CY(0.088, 0.082, 0.2, 8), shortsLeg: _CY(0.118, 0.112, 0.28, 8), bshortsLeg: _CY(0.128, 0.12, 0.38, 8),
  cuff: _CY(0.1, 0.1, 0.06, 8), shoe: _BX(0.13, 0.08, 0.24), heel: _BX(0.11, 0.06, 0.19), heelPost: _BX(0.04, 0.07, 0.04),
  boot: _BX(0.14, 0.2, 0.24), sclera: _SG(0.036, 8, 6), pupil: _SG(0.012, 6, 4), glint: _SG(0.0075, 5, 3), iris: _SG(0.022, 8, 6), brow: _BX(0.075, 0.016, 0.02),
  lash: _BX(0.06, 0.009, 0.02), mouth: _BX(0.075, 0.018, 0.02), nose: _SG(0.025, 6, 4),
  beard: _SG(0.207, 14, 8, 0, Math.PI, Math.PI * 0.52, Math.PI * 0.3), collar: new THREE.TorusGeometry(0.13, 0.03, 6, 14),
  hood: _SG(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), necklace: new THREE.TorusGeometry(0.15, 0.014, 5, 18), pendant: _SG(0.03, 6, 4),
  watch: _BX(0.09, 0.05, 0.09), flower: _SG(0.038, 6, 4), spike: new THREE.ConeGeometry(0.055, 0.15, 5), slab: _BX(0.3, 0.08, 0.33),
  volume: _SG(0.12, 10, 8), curl: _SG(0.06, 7, 5), afro: _SG(0.28, 14, 10), dread: _CY(0.022, 0.018, 0.4, 5), braidBead: _SG(0.05, 7, 5), streak: _BX(0.035, 0.012, 0.2),
  sweep: _BX(0.24, 0.07, 0.32), strand: _BX(0.07, 0.36, 0.12), bob: _BX(0.45, 0.24, 0.3), bangs: _BX(0.32, 0.07, 0.07),
  tie: new THREE.TorusGeometry(0.045, 0.015, 5, 10), beanie: _SG(0.222, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), fedoraCrown: _CY(0.16, 0.19, 0.15, 12),
  shirtFront: _BX(0.12, 0.42, 0.02), teePanel: new THREE.PlaneGeometry(0.22, 0.42), button: _SG(0.016, 5, 4), pocket: _BX(0.06, 0.13, 0.12),
  sole: _BX(0.16, 0.08, 0.28), cuban: new THREE.TorusGeometry(0.15, 0.026, 6, 18), hipChain: new THREE.TorusGeometry(0.11, 0.012, 4, 14, Math.PI), ring: new THREE.TorusGeometry(0.03, 0.009, 4, 10),
  bead: _SG(0.017, 5, 4), shield: _BX(0.4, 0.085, 0.05), shieldBand: new THREE.PlaneGeometry(0.34, 0.03), finger: _CY(0.014, 0.012, 0.09, 5),
  clogTop: _SG(0.08, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), flap: _BX(0.36, 0.62, 0.025), aodaiTrim: _BX(0.16, 0.025, 0.01), bow: new THREE.ConeGeometry(0.035, 0.06, 4), lapel: _BX(0.3, 0.02, 0.012),
};
const BX = new Map(); const bx = (w, h, d) => { const k = w + ',' + h + ',' + d; if (!BX.has(k)) BX.set(k, _BX(w, h, d)); return BX.get(k); };
let _stripe = new Map(); function stripeMat(c) { if (_stripe.has(c)) return _stripe.get(c); const t = canvasTex('stripe' + c, 32, 32, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 4; i++) x.fillRect(i * 8, 0, 3, h); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); _stripe.set(c, m); return m; }
// ---- footwear: each kind is a distinct low-poly shape on the leg group (ground at y = -0.86 - lift) ----
let _shoeT = 't';
function buildShoe(kind, color, g, skin, lift) {
  const c = _shoeT !== 't' ? fabric(color, _shoeT, 'none') : mat(color), dark = mat('#141414'), white = mat('#f4f4f4'), wood = mat('#a8743f', { roughness: 0.6 }), gy = -0.86 - lift; const B = (w, h, d, m, y, z = 0.04, x = 0) => mk(bx(w, h, d), m, g, x, y, z);
  switch (kind) {
    case 'sneakers': B(0.13, 0.07, 0.24, c, gy + 0.06); B(0.14, 0.025, 0.25, white, gy + 0.012); break;
    case 'hightop': B(0.14, 0.16, 0.24, c, gy + 0.1); B(0.15, 0.03, 0.25, white, gy + 0.015); B(0.145, 0.02, 0.06, white, gy + 0.1, -0.05); break;
    case 'chunky': B(0.15, 0.08, 0.26, c, gy + 0.1); B(0.17, 0.06, 0.29, white, gy + 0.03, 0.045); B(0.172, 0.012, 0.292, mat('#9e9e9e'), gy + 0.05, 0.045); break;
    case 'oxford': B(0.12, 0.065, 0.25, mat(color, { metalness: 0.25, roughness: 0.3 }), gy + 0.05); B(0.125, 0.018, 0.255, dark, gy + 0.009); B(0.06, 0.008, 0.06, mat('#222'), gy + 0.085, 0.08); break;
    case 'loafers': B(0.12, 0.06, 0.24, mat(color, { roughness: 0.4 }), gy + 0.045); B(0.124, 0.012, 0.03, mat('#d4af37', { metalness: 0.7 }), gy + 0.07, 0.08); break;
    case 'platform': mk(CG.boot, c, g, 0, gy + 0.16, 0.035).scale.set(1.05, 1.05, 1.05); { const so = B(0.16, 0.08, 0.28, dark, gy + 0.04); for (let i = 0; i < 4; i++) B(0.17, 0.02, 0.03, dark, gy + 0.01, -0.08 + i * 0.07); } break;
    case 'chelsea': B(0.13, 0.22, 0.23, mat(color, { roughness: 0.45 }), gy + 0.12, 0.03); for (const s of [1, -1]) B(0.005, 0.12, 0.06, dark, gy + 0.17, 0.0, 0.066 * s); B(0.135, 0.02, 0.24, dark, gy + 0.01, 0.03); break;
    case 'boots': mk(CG.boot, c, g, 0, gy + 0.12, 0.03); break;
    case 'sandals': B(0.12, 0.022, 0.24, mat('#6d4c41'), gy + 0.011); B(0.125, 0.03, 0.025, c, gy + 0.04, 0.12); B(0.125, 0.03, 0.025, c, gy + 0.04, 0.03); B(0.125, 0.03, 0.02, c, gy + 0.05, -0.07); break;
    case 'slides': B(0.12, 0.025, 0.24, mat('#fafafa'), gy + 0.012); B(0.13, 0.04, 0.09, c, gy + 0.045, 0.09); break;
    case 'flipflops': B(0.11, 0.016, 0.24, c, gy + 0.008); for (const s of [1, -1]) { const st = B(0.008, 0.012, 0.11, mat('#fafafa'), gy + 0.03, 0.09, 0.03 * s); st.rotation.y = 0.5 * s; } break;
    case 'banhmi': mk(bx(0.14, 0.07, 0.27), mat(color, { roughness: 0.95 }), g, 0, gy + 0.035, 0.045); mk(bx(0.15, 0.05, 0.11), mat(color, { roughness: 0.95 }), g, 0, gy + 0.09, 0.08).scale.set(1, 1, 1); break;
    case 'guoc': B(0.12, 0.05, 0.24, wood, gy + 0.025); B(0.1, 0.012, 0.22, mat('#7a4e25'), gy + 0.054); B(0.13, 0.03, 0.04, c, gy + 0.07, 0.1); break;
    case 'clogs': mk(bx(0.14, 0.06, 0.27), wood, g, 0, gy + 0.03, 0.045); { const u = mk(CG.clogTop, c, g, 0, gy + 0.08, 0.08); u.scale.set(1, 0.8, 1.3); } break;
    case 'flats': B(0.11, 0.04, 0.22, mat(color, { roughness: 0.5 }), gy + 0.02, 0.045); B(0.05, 0.012, 0.02, white, gy + 0.045, 0.13); break;
    case 'stiletto': case 'heels': { const t = B(0.11, 0.035, 0.13, c, gy + 0.02, 0.1); B(0.11, 0.05, 0.12, c, gy + lift - 0.0, -0.01).rotation.x = -0.45; B(0.025, lift + 0.02, 0.025, c, gy + (lift + 0.02) / 2, -0.06); break; }
    case 'block': B(0.11, 0.035, 0.13, c, gy + 0.02, 0.1); B(0.11, 0.05, 0.12, c, gy + lift, -0.01).rotation.x = -0.35; B(0.07, lift + 0.02, 0.06, c, gy + (lift + 0.02) / 2, -0.05); break;
    case 'platformheels': B(0.12, 0.05, 0.13, c, gy + 0.025, 0.1); B(0.12, 0.06, 0.12, c, gy + lift - 0.01, -0.01).rotation.x = -0.3; B(0.04, lift + 0.02, 0.04, c, gy + (lift + 0.02) / 2, -0.06); break;
    case 'strappy': B(0.1, 0.02, 0.13, c, gy + 0.012, 0.1); B(0.1, 0.02, 0.12, c, gy + lift - 0.02, -0.01).rotation.x = -0.45; B(0.02, lift + 0.02, 0.02, c, gy + (lift + 0.02) / 2, -0.06); for (const [y, z] of [[0.04, 0.1], [0.08, 0.03], [0.13, -0.02]]) B(0.115, 0.012, 0.03, c, gy + y + lift * 0.4, z); break;
    case 'wedges': { const w = mk(bx(0.11, lift + 0.03, 0.22), mat('#d7b98a'), g, 0, gy + (lift + 0.03) / 2, 0.04); B(0.115, 0.03, 0.05, c, gy + 0.05, 0.11); B(0.115, 0.03, 0.06, c, gy + lift + 0.05, -0.03); break; }
    case 'geta': B(0.12, 0.025, 0.24, wood, gy + 0.045); for (const z of [0.1, -0.04]) B(0.11, 0.035, 0.035, wood, gy + 0.017, z); { const st = B(0.01, 0.012, 0.1, c, gy + 0.07, 0.1); st.rotation.y = 0.3; } break;
    case 'ledsneakers': B(0.13, 0.07, 0.24, c, gy + 0.06); B(0.14, 0.025, 0.25, glow(color === '#111111' ? '#21e6ff' : '#ff3fd8'), gy + 0.012); B(0.135, 0.008, 0.2, glow('#21e6ff'), gy + 0.07, 0.03, 0.0); break;
    case 'royalboots': mk(bx(0.14, 0.32, 0.23), c, g, 0, gy + 0.17, 0.03); B(0.15, 0.03, 0.25, mat('#111'), gy + 0.015, 0.035); { const r = mk(new THREE.TorusGeometry(0.075, 0.012, 4, 16), mat('#d4af37', { metalness: 0.85, roughness: 0.2, emissive: '#d4af37', emissiveIntensity: 0.2 }), g, 0, gy + 0.32, 0.03); r.rotation.x = Math.PI / 2; r.scale.set(1, 1.6, 1); } break;
    default: mk(CG.shoe, c, g, 0, gy + 0.05, 0.04);
  }
}
const canvasTex = (key, w, h, draw) => { if (texCache.has(key)) return texCache.get(key); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t; };
// graphic tee: white face print + red brush "text" accent (no real slogan/brand)
let _gm = null; const graphicMat = () => _gm || (_gm = new THREE.MeshStandardMaterial({ roughness: 0.8, map: canvasTex('graphic', 64, 128, (x, w, h) => {
  x.fillStyle = '#121212'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2f2f2'; x.beginPath(); x.ellipse(32, 46, 19, 26, 0, 0, 7); x.fill();
  x.fillStyle = '#121212'; x.fillRect(19, 38, 10, 5); x.fillRect(35, 38, 10, 5); x.beginPath(); x.ellipse(32, 62, 7, 5, 0, 0, 7); x.fill(); x.fillRect(16, 22, 32, 6);
  x.strokeStyle = '#d32f2f'; x.lineWidth = 4; x.lineCap = 'round'; for (const [y, a] of [[86, 0], [100, 4], [114, -3]]) { x.beginPath(); x.moveTo(12, y); for (let i = 0; i < 6; i++) x.lineTo(14 + i * 8, y + ((i % 2) ? -5 : 4) + a * 0.3); x.stroke(); } }) }));
let _sm = null; const shieldBandMat = () => _sm || (_sm = new THREE.MeshBasicMaterial({ map: canvasTex('shieldT', 256, 24, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.font = 'bold 17px sans-serif'; x.textAlign = 'center'; x.fillText('ĐẢO NGỌC', w / 2, 18); }) }));

const skirtGeo = new Map(); const skirt = (h, rb) => { const k = h + ':' + rb; if (!skirtGeo.has(k)) skirtGeo.set(k, _CY(0.2, rb, h, 14, 1, true)); return skirtGeo.get(k); };
const dmat = (c, extra = {}) => mat(c, { side: THREE.DoubleSide, ...extra });
export const TOPS = { m: ['tee', 'polo', 'shirt', 'hawaii', 'tank', 'hoodie', 'blazer', 'tuxedo', 'aodai', 'pajama', 'graphic', 'jacketopen', 'none'], f: ['blouse', 'tee', 'graphic', 'crop', 'tank', 'hawaii', 'hoodie', 'blazer', 'pajama', 'aodai', 'dress', 'party', 'gown', 'onepiece', 'bikini'] };
export const BOTTOMS = { m: ['trousers', 'jeans', 'cargo', 'shorts', 'boardshorts', 'joggers', 'wide', 'pjpants'], f: ['skirt', 'longskirt', 'jeans', 'shorts', 'sarong', 'trousers', 'cargo', 'joggers', 'wide', 'pjpants', 'none'] };
const SH_COMMON = ['sneakers', 'hightop', 'chunky', 'loafers', 'platform', 'chelsea', 'boots', 'sandals', 'slides', 'flipflops', 'banhmi', 'guoc', 'clogs'];
export const SHOES = { m: [...SH_COMMON.slice(0, 3), 'oxford', ...SH_COMMON.slice(3), 'none'], f: [...SH_COMMON, 'flats', 'stiletto', 'block', 'platformheels', 'strappy', 'wedges', 'heels', 'none'] };
// shoe lift (heels raise the character) and walk stride factor
export const SHOE_LIFT = { chunky: 0.03, platform: 0.03, banhmi: 0.05, guoc: 0.04, clogs: 0.04, stiletto: 0.07, heels: 0.06, block: 0.05, platformheels: 0.09, strappy: 0.06, wedges: 0.06 };
const HEELED = new Set(['stiletto', 'heels', 'block', 'platformheels', 'strappy', 'wedges']);
export const HAIR_STYLES = { m: ['short', 'buzz', 'undercut', 'twoblock', 'spiky', 'fauxhawk', 'sidepart', 'pompadour', 'quiff', 'mullet', 'curly', 'afro', 'manbun', 'longm', 'dreads', 'bald'],
  f: ['long', 'wavy', 'curlylong', 'curtain', 'pony', 'highpony', 'bun', 'bunlow', 'spacebuns', 'halfup', 'bob', 'lob', 'pixie', 'braid', 'twinbraids', 'twintails', 'sidebraid', 'afro'] };
export const HAIR_FX = ['', 'highlight', 'ombre'];
export const FULL_TOPS = new Set(['dress', 'party', 'gown', 'onepiece']);
export const EYES = ['#3b2416', '#1b1b1b', '#5a3a1a', '#2e6b8a', '#3f7a3a', '#7a5a9a'];
/** Normalise any (legacy or new) look object into the full style schema. */
export function normLook(o = {}) {
  const f = o.gender === 'f', g = f ? 'f' : 'm';
  const L = { gender: g, age: o.age || 'adult', skin: o.skin || SKINS[0], hair: o.hair || HAIRS[0], eye: o.eye || EYES[0], beard: !f && o.beard ? o.beard : null,
    hairStyle: o.hairStyle, top: o.top, topC: o.topC || o.shirt || '#3b82f6', bottom: o.bottom, bottomC: o.bottomC || o.pants || '#263238', shoes: o.shoes, shoesC: o.shoesC || '#f2f2f2',
    hat: o.hat || null, hatC: o.hatC || o.capColor || null, glasses: !!o.glasses, glassesC: o.glassesC || '#0c0c0c', necklace: o.necklace || null, watch: !!o.watch, crown: !!o.crown, apron: o.apron, chef: o.chef, swim: !!o.swim, lips: o.lips,
    build: o.build === 'slim' ? 'slim' : null, glassesStyle: o.glassesStyle === 'shield' ? 'shield' : null, hipChain: !!o.hipChain, watchC: o.watchC || null, ring: !!o.ring, bracelet: !!o.bracelet,
    hair2: o.hair2 || null, hairFx: ['highlight', 'ombre'].includes(o.hairFx) ? o.hairFx : null,
    bag: o.bag || null, bagC: o.bagC || null, wings: o.wings || null, aura: o.aura || null, h: Math.max(0.9, Math.min(1.1, +o.h || 1)) };
  if (['slim', 'broad', 'curvy'].includes(o.build)) L.build = o.build; if (['shield', 'heart', 'led', 'round', 'visor'].includes(o.glassesStyle)) L.glassesStyle = o.glassesStyle;
  if (!HAIR_STYLES[g].includes(L.hairStyle) && !(L.hairStyle === 'bald' && L.age === 'elder')) L.hairStyle = L.hairStyle === 'long' || L.hairStyle === 'bun' || L.hairStyle === 'pony' ? (f ? L.hairStyle : 'short') : (f ? 'long' : (L.hairStyle === 'bald' ? 'bald' : 'short'));
  if (!L.top || !TOPS[g].includes(L.top)) L.top = o.swim ? (f ? 'onepiece' : 'none') : o.hawaii ? 'hawaii' : (f ? 'blouse' : 'tee');
  if (!L.bottom || !BOTTOMS[g].includes(L.bottom)) L.bottom = o.swim ? (f ? 'none' : 'boardshorts') : (f ? 'skirt' : 'trousers');
  if (o.swim && !o.top) { L.topC = o.shirt || L.topC; L.bottomC = o.pants || o.shirt || L.bottomC; }
  if (!L.shoes || !SHOES[g].includes(L.shoes)) L.shoes = o.swim ? 'sandals' : 'sneakers';
  return L;
}

/** opts: see normLook (gender, skin, hair, hairStyle, eye, beard, top/topC, bottom/bottomC, shoes/shoesC, hat, glasses, necklace, watch, crown, age, apron, chef) */
export function createAvatar(raw) {
  const o = normLook(raw); const f = o.gender === 'f';
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const skin = mat(o.skin);
  const party = o.top === 'party';
  const SP = GARB[o.top], BP = GARB_B[o.bottom], topT = tierOf('top', o.top), botT = tierOf('bottom', o.bottom);
  const topM0 = o.top === 'hawaii' ? hawaiiTex(o.topC) : o.top === 'pajama' ? stripeMat(o.topC) : o.top === 'aodai' ? mat(o.topC, { roughness: 0.45, metalness: 0.15 }) : (party || o.top === 'gown') ? mat(o.topC, { metalness: 0.55, roughness: 0.3, emissive: o.topC, emissiveIntensity: 0.18 }) : mat(o.topC);
  const TOP_PAT = { party: 'sequin', gown: 'sequin', aodai: 'embroid', blazer: 'silk', tuxedo: 'silk' };
  const topM = SP ? fabric(o.topC, topT, SP.pat, SP.acc) : (topT !== 't' && !['hawaii', 'pajama', 'graphic'].includes(o.top)) ? fabric(o.topC, topT, TOP_PAT[o.top] || 'none', '#d4af37') : topM0;
  const full = FULL_TOPS.has(o.top);
  const botKind = full ? (o.top === 'onepiece' ? 'none' : 'dress') : BP ? BP.base : o.bottom;
  const botM = BP ? fabric(o.bottomC, botT, BP.pat, BP.acc) : o.bottom === 'pjpants' && !full ? stripeMat(o.bottomC) : botT !== 't' ? fabric(o.bottomC, botT, 'none') : mat(o.bottomC);
  const bareLegs = ['shorts', 'boardshorts', 'skirt', 'sarong', 'none', 'dress', 'grass'].includes(botKind);
  const pjM = (c) => stripeMat(c);
  const av = { root, body, opts: o, anim: 'idle', animT: 0, prop: null, propKind: null, parts: {} };
  // proportions: male broader shoulders / narrower hips / taller; female narrower shoulders, waist, wider hips
  const legX = f ? 0.1 : 0.11, armX = f ? 0.255 : 0.31;
  const legs = []; for (const s of [1, -1]) { const g = new THREE.Group(); g.position.set(legX * s, 0.86, 0); body.add(g);
    const leg = mk(G.leg, bareLegs ? skin : botM, g, 0, -0.41, 0); if (f) leg.scale.set(0.92, 1, 0.92); if (botKind === 'wide' || botKind === 'pjpants') leg.scale.set(1.25, 1, 1.25);
    if (botKind === 'shorts') mk(CG.shortsLeg, botM, g, 0, -0.13, 0);
    if (botKind === 'boardshorts') mk(CG.bshortsLeg, botM, g, 0, -0.18, 0);
    if (botKind === 'cargo') mk(CG.pocket, botM, g, 0.105 * s, -0.38, 0.01);
    if (botKind === 'joggers') mk(CG.cuff, mat('#f5f5f5'), g, 0, -0.74, 0);
    _shoeT = tierOf('shoes', o.shoes); if (o.shoes !== 'none') buildShoe(o.shoes, o.shoesC, g, skin, SHOE_LIFT[o.shoes] || 0);
    legs.push(g); }
  av.legL = legs[0]; av.legR = legs[1];
  const hipsM = full ? (o.top === 'onepiece' ? topM : topM) : (botKind === 'none' ? skin : botM);
  const hips = mk(G.hips, hipsM, body, 0, 0.9, 0); hips.scale.set(f ? 1.12 : 0.92, o.swim || o.top === 'onepiece' ? 0.75 : 1, f ? 1.05 : 0.95);
  if (o.hipChain) { const hc = mk(CG.hipChain, mat('#e0b23a', { metalness: 0.9, roughness: 0.2 }), body, 0.2, 0.74, 0.08); hc.rotation.set(0, -0.5, Math.PI); }
  if (botKind === 'skirt') mk(skirt(0.4, 0.33), BP ? botM : dmat(o.bottomC), body, 0, 0.78, 0);
  if (botKind === 'grass') grassSkirt(o, body, botM);
  if (SP && SP.skirt) mk(skirt(SP.skirt[0], SP.skirt[1]), topM, body, 0, SP.skirt[2], 0);
  if (botKind === 'sarong') mk(skirt(0.62, 0.32), dmat(o.bottomC, { transparent: true, opacity: 0.85 }), body, 0, 0.68, 0);
  if (o.top === 'gown') mk(skirt(0.84, 0.46), topM, body, 0, 0.47, 0);
  else if (botKind === 'longskirt') mk(skirt(0.7, 0.36), dmat(o.bottomC), body, 0, 0.55, 0);
  if (o.top === 'aodai') for (const z of [0.13, -0.13]) { const fl = mk(CG.flap, topM, body, 0, 0.55, z); fl.scale.set(f ? 0.92 : 1, 1, 1); }
  if (botKind === 'dress' && o.top !== 'gown' && !SP) mk(skirt(party ? 0.42 : 0.52, party ? 0.31 : 0.36), party ? mat(o.topC, { side: THREE.DoubleSide, metalness: 0.55, roughness: 0.3, emissive: o.topC, emissiveIntensity: 0.18 }) : dmat(o.topC), body, 0, party ? 0.8 : 0.75, 0);
  const torsoG = new THREE.Group(); torsoG.position.y = 0.9; body.add(torsoG); av.torso = torsoG;
  const bareTorso = ['none', 'crop', 'bikini'].includes(o.top) || !!(SP && SP.bare);
  const torso = mk((f ? G.torsoF : G.torsoM) || G.torso, bareTorso ? skin : (o.top === 'graphic' ? graphicMat() : topM), torsoG, 0, 0.32, 0); torso.scale.set(f ? (o.build === 'curvy' ? 0.86 : o.build === 'slim' ? 0.76 : 0.8) : (o.top === 'jacketopen' ? 1.2 : o.build === 'slim' ? 1.02 : o.build === 'broad' ? 1.24 : 1.12), f ? 0.97 : 1, o.age === 'elder' ? 0.95 : (o.build === 'broad' || o.build === 'curvy') ? 0.92 : 0.85);
  if (o.age === 'elder') torso.scale.x *= 1.08;
  if (f && !bareTorso) { const w = mk(G.band, topM, torsoG, 0, 0.1, 0); w.scale.set(0.74, 0.9, 0.78); } // defined waist
  if (o.top === 'crop') { const b = mk(G.band, topM, torsoG, 0, 0.47, 0); b.scale.set(0.86, 2.2, 0.86); }
  if (o.top === 'bikini') { const b = mk(G.band, topM, torsoG, 0, 0.47, 0); b.scale.set(0.86, 1, 0.86); }
  if (o.top === 'polo') { const c = mk(CG.collar, mat('#ffffff'), torsoG, 0, 0.74, 0); c.rotation.x = Math.PI / 2; }
  if (o.top === 'blazer' || o.top === 'tuxedo') { mk(CG.shirtFront, mat('#ffffff'), torsoG, 0, 0.48, f ? 0.175 : 0.19); }
  if (o.top === 'tuxedo') { const bt = mat('#0a0a0a'); for (const s of [1, -1]) mk(CG.bow, bt, torsoG, 0.035 * s, 0.68, 0.2).rotation.z = 0.5 * s; mk(CG.lapel, mat(o.topC, { metalness: 0.3, roughness: 0.3 }), torsoG, 0, 0.5, 0.19); }
  if (o.top === 'aodai') { const c = mk(CG.collar, topM, torsoG, 0, 0.74, 0); c.rotation.x = Math.PI / 2; c.scale.set(0.85, 0.85, 2.2); mk(CG.aodaiTrim, mat('#d4af37', { metalness: 0.6, roughness: 0.3 }), torsoG, 0.07, 0.52, f ? 0.17 : 0.19).rotation.z = 0.5; }
  if (o.top === 'pajama') for (let i = 0; i < 4; i++) mk(CG.button, mat('#fafafa'), torsoG, 0, 0.62 - i * 0.13, f ? 0.18 : 0.2);
  if (o.top === 'jacketopen' || o.top === 'graphic') { const tp = new THREE.Mesh(CG.teePanel, graphicMat()); tp.position.set(0, o.top === 'graphic' ? 0.4 : 0.37, o.top === 'graphic' ? (f ? 0.18 : 0.2) : 0.212); torsoG.add(tp); if (o.top === 'graphic') tp.scale.set(0.9, 0.7, 1); }
  if (o.top === 'jacketopen') { const bm = mat('#2a2a2a', { metalness: 0.6, roughness: 0.4 }); for (let i = 0; i < 4; i++) for (const s of [1, -1]) mk(CG.button, bm, torsoG, 0.13 * s, 0.62 - i * 0.14, 0.205); }
  if (o.top === 'hoodie') { mk(CG.hood, topM, torsoG, 0, 0.7, -0.14).scale.set(1, 0.8, 0.8); }
  if (o.apron) mk(G.apron, mat(o.apron), torsoG, 0, 0.2, 0.2);
  av.hits = [torso];
  const longSleeve = ['shirt', 'hoodie', 'blazer', 'jacketopen', 'tuxedo', 'aodai', 'pajama'].includes(o.top) || !!(SP && (SP.sl === 'long' || SP.sl === 'wide')), shortSleeve = ['tee', 'polo', 'hawaii', 'blouse', 'crop', 'graphic'].includes(o.top) || (o.top === 'dress') || !!(SP && SP.sl === 'short');
  const arms = []; for (const s of [1, -1]) { const g = new THREE.Group(); g.position.set(armX * s, 0.56, 0); torsoG.add(g);
    const arm = mk(G.arm, longSleeve ? topM : skin, g, 0, -0.27, 0); if (f) arm.scale.set(0.86, 1, 0.86); if (o.top === 'jacketopen') arm.scale.set(1.25, 1.02, 1.25);
    if (shortSleeve) mk(CG.sleeve, o.top === 'graphic' ? mat('#121212') : topM, g, 0, -0.07, 0).scale.set(f ? 0.9 : 1, o.top === 'dress' ? 0.5 : 1, f ? 0.9 : 1);
    mk(G.hand, skin, g, 0, -0.56, 0);
    if (s === 1 && o.watch) mk(CG.watch, o.watchC ? mat(o.watchC, { metalness: 0.4, roughness: 0.35 }) : mat('#d4af37', { metalness: 0.7, roughness: 0.3 }), g, 0, -0.47, 0);
    if (s === -1 && o.bracelet) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; mk(CG.bead, mat(i % 3 ? '#3e2723' : '#111111', { roughness: 0.4 }), g, Math.sin(a) * 0.075, -0.49, Math.cos(a) * 0.075); }
    if (s === 1 && o.ring) { const r = mk(CG.ring, mat('#c0c0c0', { metalness: 0.9, roughness: 0.2 }), g, 0, -0.6, 0.05); r.rotation.y = Math.PI / 2; }
    arms.push(g);
    if (s === -1) { const hp = new THREE.Group(); hp.position.set(0, -0.6, 0.05); g.add(hp); av.handR = hp; } }
  av.armL = arms[0]; av.armR = arms[1];
  if (SP) garbDeco(SP, o, { body, torsoG, torso, topM, f, armX, arms, av });
  if (o.necklace) buildNecklace(o.necklace, torsoG, torso);
  const head = new THREE.Group(); head.position.y = 0.86; torsoG.add(head); av.head = head;
  av.hits.push(mk(G.head, skin, head));
  // face
  const white = mat('#ffffff'), iris = mat(o.eye), browM = mat(o.age === 'elder' ? '#9a9a9a' : o.hair);
  for (const s of [1, -1]) { const sc = mk(CG.sclera, white, head, 0.07 * s, 0.03, 0.168); sc.scale.set(1, f ? 1.15 : 1, 0.6); mk(CG.iris, iris, head, 0.07 * s, 0.028, 0.188).scale.set(1, 1.1, 0.5); mk(CG.pupil, PUPIL, head, 0.07 * s, 0.028, 0.199).scale.set(1, 1.1, 0.5); mk(CG.glint, GLINT, head, 0.07 * s + 0.009, 0.041, 0.203);
    const b = mk(CG.brow, browM, head, 0.072 * s, f ? 0.088 : 0.082, 0.185); b.rotation.z = (f ? 0.18 : 0.06) * s; if (!f) b.scale.set(1.05, 1.5, 1);
    if (f) { const l = mk(CG.lash, mat('#111111'), head, 0.075 * s, 0.062, 0.19); l.rotation.z = -0.25 * s; } }
  mk(CG.nose, skin, head, 0, -0.02, 0.198);
  const mouth = mk(CG.mouth, mat(o.lips || (f ? '#d2506e' : '#a0604e')), head, 0, -0.085, 0.183); if (f) mouth.scale.set(0.85, 1.25, 1);
  if (o.beard && o.age !== 'kid') { const bm = o.beard === 'stubble' ? mat(o.hair, { transparent: true, opacity: 0.38 }) : mat(o.hair); mk(CG.beard, bm, head, 0, 0.0, 0).rotation.y = Math.PI; }
  // hair
  const hairM = mat(o.hair); const hs = o.hairStyle; const fx = o.hairFx, h2M = fx ? mat(o.hair2 || '#d8b35a') : hairM;
  const lowM = fx === 'ombre' ? h2M : hairM; // ombre: lengths/tips use the 2nd colour
  const H = (geo, m, x, y, z) => mk(geo, m, head, x, y, z);
  const chain = (x0, y0, z0, dx, dy, dz, n, r, m) => { for (let i = 0; i < n; i++) { const b = H(CG.braidBead, i >= n / 2 ? lowM : m, x0 + dx * i, y0 + dy * i, z0 + dz * i); b.scale.setScalar(r * (1 - i * 0.05)); } };
  const tail = (x, y, z, rx, rz, len = 1.7) => { const p = H(G.bun, lowM, x, y, z); p.scale.set(0.62, len, 0.62); p.rotation.set(rx, 0, rz); return p; };
  const CAP_SC = { undercut: [0.97, 0.85, 0.97], buzz: [0.955, 0.9, 0.955], twoblock: [0.97, 0.88, 0.97], fauxhawk: [0.95, 0.84, 0.95], pixie: [1, 0.95, 1], afro: null, bald: null };
  if (!(hs in CAP_SC) || CAP_SC[hs]) { const cap = H(G.hairCap, hairM, 0, 0.01, -0.01); cap.rotation.x = -0.25; if (CAP_SC[hs]) cap.scale.set(...CAP_SC[hs]); }
  if (hs === 'undercut') H(CG.slab, hairM, 0, 0.18, 0.02).rotation.x = -0.15;
  if (hs === 'spiky') for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const s = H(CG.spike, hairM, Math.sin(a) * 0.1, 0.2, Math.cos(a) * 0.08 - 0.02); s.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); }
  if (hs === 'sidepart') { const s = H(CG.sweep, hairM, 0.04, 0.17, 0.02); s.rotation.z = -0.28; }
  if (hs === 'twoblock') { const t = H(CG.volume, hairM, 0, 0.17, 0.0); t.scale.set(1.15, 0.6, 1.2); const b = H(CG.bangs, hairM, 0, 0.12, 0.17); b.rotation.x = -0.35; b.scale.set(0.95, 1.6, 1); }
  if (hs === 'fauxhawk') for (let i = 0; i < 5; i++) { const s = H(CG.spike, hairM, 0, 0.215 - Math.abs(i - 1) * 0.012, 0.12 - i * 0.065); s.rotation.x = 0.35 - i * 0.18; s.scale.set(0.8, 1.15, 0.8); }
  if (hs === 'pompadour') { const v = H(CG.volume, hairM, 0, 0.2, 0.07); v.scale.set(1.25, 0.8, 1.35); v.rotation.x = -0.35; }
  if (hs === 'quiff') { const q = H(CG.slab, hairM, 0, 0.215, 0.09); q.rotation.x = -0.6; q.scale.set(0.85, 1.4, 0.55); }
  if (hs === 'mullet') { const m = H(CG.slab, lowM, 0, -0.08, -0.16); m.scale.set(1.05, 2.6, 0.45); m.rotation.x = 0.12; }
  if (hs === 'curly' || hs === 'afro') { const R = hs === 'afro' ? 1.0 : 0.62, n = hs === 'afro' ? 18 : 14; for (let i = 0; i < n; i++) { const a = i * 2.399, k = (i + 0.5) / n, yy = 0.24 * (1 - k * 1.25) + 0.04, rr = Math.sqrt(Math.max(0, 1 - Math.pow((yy - 0.04) / 0.26, 2)));
      H(CG.curl, i % 3 === 0 ? h2M : hairM, Math.cos(a) * 0.2 * rr * (hs === 'afro' ? 1.25 : 1), yy * (hs === 'afro' ? 1.15 : 1) + 0.02, Math.sin(a) * 0.19 * rr - 0.02).scale.setScalar(R * (hs === 'afro' ? 1.15 : 1)); }
    if (hs === 'afro') { const ab = H(CG.afro, hairM, 0, 0.07, -0.04); ab.scale.set(1.05, 0.95, 1); } }
  if (hs === 'manbun') H(G.bun, lowM, 0, 0.16, -0.17).scale.setScalar(0.75);
  if (hs === 'longm') { const l = H(G.hairLong, lowM, 0, -0.08, -0.12); l.scale.set(0.98, 0.55, 1); for (const s of [1, -1]) H(CG.strand, lowM, 0.175 * s, -0.04, 0.0).scale.set(1, 0.6, 1); }
  if (hs === 'dreads') for (let i = 0; i < 12; i++) { const a = Math.PI * 0.18 + (i / 11) * Math.PI * 1.64; const d = H(CG.dread, i % 2 ? lowM : hairM, Math.sin(a) * 0.19, -0.05, Math.cos(a) * 0.18 - 0.02); d.rotation.set(Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2); }
  const LONG = new Set(['long', 'wavy', 'curtain', 'halfup', 'braid']);
  if (LONG.has(hs)) { if (hs !== 'braid') H(G.hairLong, lowM, 0, -0.17, -0.12); for (const s of [1, -1]) H(CG.strand, lowM, 0.175 * s, -0.1, 0.0); }
  if (hs === 'wavy') for (let i = 0; i < 7; i++) H(CG.curl, lowM, -0.18 + i * 0.06, -0.38 + (i % 2) * 0.03, -0.12).scale.setScalar(0.75);
  if (hs === 'curlylong') { for (let i = 0; i < 22; i++) { const a = Math.PI * 0.25 + (i % 11) / 10 * Math.PI * 1.5, row = Math.floor(i / 11); H(CG.curl, row ? lowM : hairM, Math.sin(a) * 0.22, -0.08 - row * 0.17, Math.cos(a) * 0.2 - 0.04).scale.setScalar(0.95); } }
  if (hs === 'curtain') for (const s of [1, -1]) { const b = H(CG.bangs, hairM, 0.08 * s, 0.13, 0.165); b.scale.set(0.5, 1.4, 1); b.rotation.z = 0.5 * s; }
  if (hs === 'halfup') H(G.bun, hairM, 0, 0.1, -0.2).scale.setScalar(0.6);
  if (hs === 'bun') H(G.bun, hairM, 0, 0.2, -0.12);
  if (hs === 'bunlow') H(G.bun, lowM, 0, -0.08, -0.23);
  if (hs === 'spacebuns') for (const s of [1, -1]) H(G.bun, hairM, 0.13 * s, 0.17, -0.03).scale.setScalar(0.8);
  if (hs === 'pony') { tail(0, -0.02, -0.26, 0, 0); const t = H(CG.tie, mat('#ff5fa2'), 0, 0.1, -0.22); t.rotation.x = 0.4; }
  if (hs === 'highpony') { tail(0, 0.08, -0.27, 0.55, 0, 1.9); const t = H(CG.tie, mat('#ff5fa2'), 0, 0.19, -0.18); t.rotation.x = 0.9; }
  if (hs === 'twintails') for (const s of [1, -1]) { tail(0.21 * s, 0.0, -0.08, 0, -0.35 * s, 1.5); H(CG.tie, mat('#ff5fa2'), 0.19 * s, 0.1, -0.08).rotation.y = Math.PI / 2; }
  if (hs === 'bob' || hs === 'lob') { const b = H(CG.bob, hs === 'lob' ? lowM : hairM, 0, hs === 'lob' ? -0.11 : -0.06, -0.05); if (hs === 'lob') b.scale.set(1, 1.45, 1); H(CG.bangs, hairM, 0, 0.13, 0.165).rotation.x = -0.2; }
  if (hs === 'pixie') { const s = H(CG.sweep, hairM, 0.03, 0.16, 0.05); s.rotation.z = -0.35; s.scale.set(1.05, 1, 0.95); }
  if (hs === 'braid') chain(0, -0.06, -0.21, 0, -0.075, -0.012, 8, 1, hairM);
  if (hs === 'twinbraids') for (const s of [1, -1]) chain(0.17 * s, -0.1, 0.02, 0.006 * s, -0.07, 0.012, 7, 0.85, hairM);
  if (hs === 'sidebraid') chain(0.16, -0.08, 0.04, 0.008, -0.07, 0.016, 8, 0.95, hairM);
  if (f && !['bob', 'lob', 'bald', 'pixie', 'curtain', 'afro', 'curlylong'].includes(hs)) H(CG.bangs, hairM, 0.05, 0.15, 0.155).scale.set(0.7, 0.8, 1);
  if (fx === 'highlight' && hs !== 'bald') for (let i = 0; i < 4; i++) { const st = H(CG.streak, h2M, -0.09 + i * 0.06, 0.16 + (i % 2) * 0.012, 0.11); st.rotation.x = -0.75; }
  av.accessory = {};
  setAccessories(av, o);
  const sh = new THREE.Mesh(G.shadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; root.add(sh); av.shadow = sh;
  if (o.age === 'kid') root.scale.setScalar(0.62); else if (o.age === 'elder') root.scale.setScalar((f ? 0.92 : 0.97) * o.h);
  else root.scale.setScalar((f ? 0.94 : 1.03) * o.h);
  if (f && o.build === 'curvy') hips.scale.x *= 1.08;
  av.lift = o.age === 'kid' ? 0 : (SHOE_LIFT[o.shoes] || 0); av.stride = HEELED.has(o.shoes) ? 0.62 : 1;
  buildExtras(av, o, torsoG);
  const tiers = [tierOf('top', o.top), FULL_TOPS.has(o.top) ? 't' : tierOf('bottom', o.bottom), tierOf('shoes', o.shoes), tierOf('hat', o.hat), tierOf('wings', o.wings), tierOf('aura', o.aura), tierOf('bag', o.bag), tierOf('necklace', o.necklace)];
  av.tier = tiers.includes('l') ? 'l' : tiers.includes('s') ? 's' : tiers.includes('h') ? 'h' : 't';
  if (av.tier === 'l' && !av.sparks && Q.particles > 0.3) { const ag = new THREE.Group(); root.add(ag); av.sparks = []; for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(XG.spark, glow(i % 2 ? '#ffd54f' : '#fff3b0', 0.9)); sp.scale.setScalar(0.7); ag.add(sp); av.sparks.push(sp); } }
  return av;
}

// ---- necklaces: links laid along a U-shaped curve that sits on the collar and drapes onto the chest (never at the jaw) ----
const LINK = { cuban: new THREE.TorusGeometry(0.017, 0.0075, 5, 10), gold: new THREE.TorusGeometry(0.011, 0.0042, 4, 8), bling: new THREE.TorusGeometry(0.014, 0.006, 4, 8), pearl: new THREE.SphereGeometry(0.0135, 8, 6), pendant: new THREE.OctahedronGeometry(0.03, 0) };
const NECK_MAT = {}; const neckMat = (k) => NECK_MAT[k] || (NECK_MAT[k] = k === 'pearl' ? new THREE.MeshStandardMaterial({ color: '#fbf3e6', roughness: 0.25, metalness: 0.1 })
  : k === 'bling' ? new THREE.MeshStandardMaterial({ color: '#eef3f7', metalness: 1, roughness: 0.12, emissive: '#30363c', emissiveIntensity: 0.3 })
  : new THREE.MeshStandardMaterial({ color: k === 'cuban' ? '#f2c14e' : '#e6b84a', metalness: 1, roughness: 0.22, emissive: '#4a3208', emissiveIntensity: 0.25 }));
function neckCurve(torso, drop) { const sx = torso.scale.x, sz = torso.scale.z, fz = 0.22 * sz + 0.018, yb = 0.62 - drop;
  return new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.705, -0.1 * sz), new THREE.Vector3(0.15 * sx, 0.69, -0.03), new THREE.Vector3(0.17 * sx, 0.655, 0.07 * sz), new THREE.Vector3(0.12 * sx, yb + 0.06, fz - 0.012), new THREE.Vector3(0, yb, fz),
    new THREE.Vector3(-0.12 * sx, yb + 0.06, fz - 0.012), new THREE.Vector3(-0.17 * sx, 0.655, 0.07 * sz), new THREE.Vector3(-0.15 * sx, 0.69, -0.03)], true, 'centripetal'); }
function buildNecklace(kind, torsoG, torso) {
  const g = new THREE.Group(); g.name = 'necklace'; torsoG.add(g);
  if (kind === 'lei') { const cv = neckCurve(torso, 0.13), cols = ['#ff5fa2', '#fff176', '#ff8a65', '#ffffff', '#ce93d8'];
    for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(CG.flower, mat(cols[i % 5])); m.position.copy(cv.getPointAt(i / 22)); m.scale.setScalar(0.85); g.add(m); } return g; }
  const drop = { cuban: 0.12, gold: 0.17, bling: 0.14, pearl: 0.1 }[kind] ?? 0.14; const cv = neckCurve(torso, drop);
  const n = { cuban: 46, gold: 70, bling: 58, pearl: 40 }[kind] || 50; const geo = LINK[kind] || LINK.gold; const im = new THREE.InstancedMesh(geo, neckMat(kind in LINK ? kind : 'gold'), n);
  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), M4 = new THREE.Matrix4(), X = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) { const u = i / n, p = cv.getPointAt(u), t = cv.getTangentAt(u);
    q.setFromUnitVectors(X, t); // torus axis is Z; lay each link along the curve, alternate 90° twist so it reads as interlocking chain
    q2.setFromAxisAngle(X, (i % 2) * Math.PI / 2 + (kind === 'cuban' ? 0.35 : 0)); q.multiply(q2);
    const sc = kind === 'cuban' ? one.set(1.25, 1, 0.8) : one.set(1.2, 1, 1); M4.compose(p, q, sc); im.setMatrixAt(i, M4); }
  im.instanceMatrix.needsUpdate = true; im.castShadow = false; g.add(im);
  if (kind === 'gold' || kind === 'pearl' || kind === 'bling') { const pt = cv.getPointAt(0.5 - 0.5 / n * 0 + 0); const pd = new THREE.Mesh(LINK.pendant, kind === 'bling' ? glow('#b3f5ff') : neckMat(kind === 'pearl' ? 'gold' : kind)); pd.position.set(0, pt.y - 0.03, pt.z + 0.008); pd.scale.set(kind === 'bling' ? 1.3 : 0.9, 1.25, 0.5); g.add(pd); }
  return g; }

// ---- bags, wings, aura (catalog extras) ----
const XG = { wing: (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(0.25, 0.35, 0.6, 0.45, 0.72, 0.3); sh.bezierCurveTo(0.6, 0.12, 0.55, -0.05, 0.42, -0.12); sh.bezierCurveTo(0.3, -0.3, 0.12, -0.25, 0, 0); return new THREE.ShapeGeometry(sh, 6); })(),
  bat: (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.25, 0.32); sh.lineTo(0.68, 0.36); sh.lineTo(0.58, 0.18); sh.lineTo(0.5, 0.0); sh.lineTo(0.38, 0.06); sh.lineTo(0.3, -0.12); sh.lineTo(0.18, -0.02); sh.lineTo(0, 0); return new THREE.ShapeGeometry(sh); })(),
  ring: new THREE.TorusGeometry(0.55, 0.025, 6, 32), spark: new THREE.OctahedronGeometry(0.045, 0), heart: (() => { const sh = new THREE.Shape(); sh.moveTo(0, -0.05); sh.bezierCurveTo(-0.08, 0.01, -0.05, 0.07, 0, 0.035); sh.bezierCurveTo(0.05, 0.07, 0.08, 0.01, 0, -0.05); return new THREE.ShapeGeometry(sh); })() };
const glow = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, side: THREE.DoubleSide, toneMapped: false, depthWrite: op >= 1 });
const WINGS = { angel: ['#ffffff', 'wing', 0.95], devil: ['#5a0d18', 'bat', 1], fairy: ['#b3e5fc', 'wing', 0.55], neon: ['#21e6ff', 'wing', 0.8], cupid: ['#ff8fc8', 'wing', 0.9], gold: ['#ffd54f', 'wing', 0.95] };
const AURAS = { gold: ['#ffd54f', '#fff3b0'], pink: ['#ff6fb5', '#ffd1ea'], neon: ['#21e6ff', '#ff3fd8'], snow: ['#e3f6ff', '#ffffff'], heart: ['#ff3f7f', '#ff9ac1'], tet: ['#e53935', '#ffd54f'] };
function buildExtras(av, o, torsoG) {
  if (o.bag) { const c = mat(o.bagC || ({ tote: '#c8a96a', cross: '#3e2723', backpack: '#37474f', clutch: '#c2185b', luxe: '#d4af37' })[o.bag] || '#5d4037', o.bag === 'luxe' ? { metalness: 0.5, roughness: 0.3 } : {}); const strap = mat('#2b1d14');
    if (o.bag === 'backpack') { mk(bx(0.34, 0.4, 0.15), c, torsoG, 0, 0.36, -0.27); mk(bx(0.26, 0.14, 0.05), c, torsoG, 0, 0.26, -0.36); for (const s of [1, -1]) mk(bx(0.04, 0.42, 0.02), strap, torsoG, 0.12 * s, 0.42, 0.2); }
    else if (o.bag === 'cross') { const st = mk(bx(0.035, 0.75, 0.015), strap, torsoG, 0.02, 0.4, 0.205); st.rotation.z = 0.72; mk(bx(0.2, 0.15, 0.07), c, torsoG, -0.24, 0.08, 0.13); }
    else if (o.bag === 'clutch' || o.bag === 'luxe') { const b = mk(bx(o.bag === 'luxe' ? 0.24 : 0.2, o.bag === 'luxe' ? 0.17 : 0.1, 0.07), c, av.armL, 0, -0.38, 0.1); if (o.bag === 'luxe') { const hd = mk(new THREE.TorusGeometry(0.06, 0.01, 4, 10, Math.PI), mat('#d4af37', { metalness: 0.8 }), b, 0, 0.085, 0); } }
    else { mk(bx(0.24, 0.28, 0.08), c, torsoG, -0.34, -0.05, 0.02); mk(bx(0.03, 0.5, 0.02), strap, torsoG, -0.3, 0.33, 0.05).rotation.z = -0.15; } }
  if (o.wings && WINGS[o.wings]) { const [c, shp, op] = WINGS[o.wings]; const m = glow(c, op); const wg = new THREE.Group(); wg.position.set(0, 0.48, -0.22); torsoG.add(wg); av.wingsL = []; 
    for (const s of [1, -1]) { const piv = new THREE.Group(); piv.position.x = 0.05 * s; wg.add(piv); const w = new THREE.Mesh(XG[shp], m); w.scale.set(s * 0.9, 0.9, 1); w.rotation.y = -0.35 * s; piv.add(w); av.wingsL.push([piv, s]); } }
  if (o.aura && AURAS[o.aura]) { const [c1, c2] = AURAS[o.aura]; const ag = new THREE.Group(); av.root.add(ag); av.auraG = ag; const r = new THREE.Mesh(XG.ring, glow(c1, 0.75)); r.rotation.x = Math.PI / 2; r.position.y = 0.05; ag.add(r);
    av.sparks = []; for (let i = 0; i < 10; i++) { const sp = new THREE.Mesh(o.aura === 'heart' ? XG.heart : XG.spark, glow(i % 2 ? c1 : c2, 0.9)); ag.add(sp); av.sparks.push(sp); } }
}
function animateExtras(av, t) {
  animateFabrics(t); if (av.cape) av.cape.rotation.x = 0.1 + Math.abs(Math.sin(t * 1.7)) * 0.08 * (av.anim === 'walk' || av.anim === 'run' ? 2.5 : 0.6);
  const hat = av.accessory && av.accessory.hat; if (hat && hat.userData.float) hat.position.y = 0.36 + Math.sin(t * 2) * 0.02;
  if (av.wingsL) for (const [p, s] of av.wingsL) p.rotation.y = s * (0.15 + Math.sin(t * 3) * 0.22);
  if (av.sparks) av.sparks.forEach((sp, i) => { const a = t * 0.9 + i / av.sparks.length * Math.PI * 2, k = ((t * 0.35 + i * 0.137) % 1); sp.position.set(Math.cos(a) * 0.5, 0.1 + k * 1.9, Math.sin(a) * 0.5); sp.rotation.y = t * 2 + i; sp.scale.setScalar(1 - k * 0.6); });
}
export function setAccessories(av, o) {
  for (const k in av.accessory) { av.head.remove(av.accessory[k]); } av.accessory = {};
  const add = (k, obj) => { av.head.add(obj); av.accessory[k] = obj; };
  if (o.hat === 'straw' || o.hat === 'sunhat') { const g = new THREE.Group(); const m = mat(o.hatC || (o.hat === 'sunhat' ? '#f5efe0' : '#e2c27a'));
    mk(o.hat === 'sunhat' ? G.brimWide : G.brim, m, g, 0, 0, 0); mk(G.crown, m, g, 0, 0.08, 0);
    if (o.hat === 'sunhat') mk(G.band, mat('#ff6fa8'), g, 0, 0.04, 0).scale.set(0.8, 0.4, 0.8);
    g.position.y = 0.16; add('hat', g); }
  if (o.hat === 'fedora') { const g = new THREE.Group(); const m = mat(o.hatC || '#3e2c22'); mk(G.brim, m, g).scale.set(0.9, 1, 0.9); mk(CG.fedoraCrown, m, g, 0, 0.08, 0); mk(G.band, mat('#111'), g, 0, 0.03, 0).scale.set(0.82, 0.35, 0.82); g.position.y = 0.17; add('hat', g); }
  if (o.hat === 'beanie') { const g = new THREE.Group(); mk(CG.beanie, mat(o.hatC || '#455a64'), g); g.position.y = 0.03; g.rotation.x = -0.15; add('hat', g); }
  if (o.hat === 'cap') { const g = new THREE.Group(); const m = mat(o.hatC || o.capColor || '#e53935'); mk(G.capTop, m, g); mk(G.capBill, m, g, 0, 0.0, 0.2); g.position.y = 0.04; add('hat', g); }
  if (o.hat === 'flower' || o.crown) { const g = new THREE.Group(); const t = mk(G.torus, mat('#5b8f3a'), g); t.rotation.x = Math.PI / 2; t.scale.setScalar(1.08);
    const cols = ['#ff5fa2', '#fff176', '#ffffff', '#ff8a65', '#ce93d8']; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; mk(CG.flower, mat(cols[i % 5], { emissive: cols[i % 5], emissiveIntensity: 0.15 }), g, Math.sin(a) * 0.205, 0, Math.cos(a) * 0.205); }
    g.position.y = 0.13; add('crown', g); }
  if (o.hat === 'nonla') { const g = new THREE.Group(); mk(new THREE.ConeGeometry(0.44, 0.24, 18), mat(o.hatC || '#e9d8a6', { roughness: 0.9 }), g, 0, 0.12, 0); g.position.y = 0.13; add('hat', g); }
  if (o.hat === 'santa') { const g = new THREE.Group(); const c = mk(new THREE.ConeGeometry(0.2, 0.36, 12), mat(o.hatC || '#d32f2f'), g, 0, 0.2, -0.02); c.rotation.x = -0.35; mk(G.band, mat('#fafafa'), g, 0, 0.02, 0).scale.set(0.95, 0.6, 0.95); mk(CG.pendant, mat('#fafafa'), g, 0, 0.33, -0.16).scale.setScalar(1.8); g.position.y = 0.12; add('hat', g); }
  if (o.hat === 'witch') { const g = new THREE.Group(); const m = mat(o.hatC || '#4a148c'); mk(G.brimWide, m, g); const c = mk(new THREE.ConeGeometry(0.18, 0.5, 10), m, g, 0, 0.25, -0.03); c.rotation.x = -0.25; mk(G.band, mat('#ffb300'), g, 0, 0.04, 0).scale.set(0.78, 0.4, 0.78); g.position.y = 0.16; add('hat', g); }
  if (o.hat === 'horns') { const g = new THREE.Group(); const m = mat(o.hatC || '#d50000', { emissive: o.hatC || '#d50000', emissiveIntensity: 0.25 }); for (const s of [1, -1]) { const h = mk(new THREE.ConeGeometry(0.04, 0.14, 6), m, g, 0.1 * s, 0.2, 0.03); h.rotation.z = -0.35 * s; } add('hat', g); }
  if (o.hat === 'beret') { const g = new THREE.Group(); const b = mk(_SG(0.22, 12, 6), mat(o.hatC || '#b71c1c'), g); b.scale.set(1.12, 0.32, 1.12); g.position.set(0.03, 0.17, -0.01); g.rotation.z = -0.18; add('hat', g); }
  if (o.hat === 'catears') { const g = new THREE.Group(); const m = mat(o.hatC || '#f8bbd0'); const t = mk(G.torus, m, g); t.scale.set(1.12, 1.12, 0.4); t.rotation.y = Math.PI / 2; for (const s of [1, -1]) { const e = mk(new THREE.ConeGeometry(0.06, 0.12, 4), m, g, 0.12 * s, 0.2, 0); e.rotation.z = -0.3 * s; } g.position.y = 0.03; add('hat', g); }
  if (o.hat === 'headphones') { const g = new THREE.Group(); const m = mat(o.hatC || '#212121', { metalness: 0.4, roughness: 0.4 }); const t = mk(new THREE.TorusGeometry(0.22, 0.02, 6, 16, Math.PI), m, g); t.rotation.y = Math.PI / 2; t.rotation.x = 0; for (const s of [1, -1]) { const e = mk(_CY(0.07, 0.07, 0.05, 10), m, g, 0.21 * s, 0, 0); e.rotation.z = Math.PI / 2; mk(_CY(0.05, 0.05, 0.052, 10), glow('#21e6ff'), g, 0.215 * s, 0, 0).rotation.z = Math.PI / 2; } g.position.y = 0.02; add('hat', g); }
  if (o.hat === 'khanvan') { const g = new THREE.Group(); const t = mk(new THREE.TorusGeometry(0.2, 0.05, 6, 16), mat(o.hatC || '#c62828', { roughness: 0.4, metalness: 0.2 }), g); t.rotation.x = Math.PI / 2 - 0.15; g.position.y = 0.13; add('hat', g); }
  if (o.hat === 'tiara' || o.hat === 'kingcrown') { const g = new THREE.Group(); const gm = mat('#ffd54f', { metalness: 0.85, roughness: 0.2, emissive: '#7a5a00', emissiveIntensity: 0.3 }); const king = o.hat === 'kingcrown';
    const b = mk(_CY(king ? 0.17 : 0.18, king ? 0.17 : 0.19, king ? 0.09 : 0.03, 14, 1, true), gm, g); for (let i = 0; i < (king ? 8 : 5); i++) { const a = king ? i / 8 * Math.PI * 2 : -0.9 + i * 0.45; mk(new THREE.ConeGeometry(0.03, king ? 0.09 : 0.07, 4), gm, g, Math.sin(a) * 0.175, king ? 0.09 : 0.04, Math.cos(a) * 0.175); }
    mk(CG.pendant, glow(king ? '#e53935' : '#80deea'), g, 0, king ? 0.03 : 0.06, king ? 0.175 : 0.19); g.position.y = king ? 0.2 : 0.16; add('crown', g); }
  if (o.chef) { const g = new THREE.Group(); mk(G.chef, mat('#ffffff'), g, 0, 0.0, 0); g.position.y = 0.25; add('hat', g); }
  if (extraHeadwear(o, add)) {}
  else if (o.glasses && o.glassesStyle === 'shield') { const gg = new THREE.Group(); mk(CG.shield, mat('#050505', { metalness: 0.6, roughness: 0.15 }), gg); const b = new THREE.Mesh(CG.shieldBand, shieldBandMat()); b.position.set(0, 0.032, 0.026); gg.add(b); gg.position.set(0, 0.035, 0.19); add('glasses', gg); }
  else if (o.glasses && o.glassesStyle === 'heart') { const gg = new THREE.Group(); const m = glow(o.glassesC && o.glassesC !== '#0c0c0c' ? o.glassesC : '#ff3f7f', 0.85); for (const s of [1, -1]) { const h = new THREE.Mesh(XG.heart, m); h.scale.setScalar(1.35); h.position.set(0.07 * s, 0, 0); gg.add(h); } mk(bx(0.06, 0.012, 0.01), mat('#222'), gg, 0, 0.02, 0); gg.position.set(0, 0.035, 0.205); add('glasses', gg); }
  else if (o.glasses && o.glassesStyle === 'led') { const gg = new THREE.Group(); mk(CG.shield, mat('#0a0a0a', { metalness: 0.6 }), gg); mk(bx(0.36, 0.02, 0.01), glow(o.glassesC && o.glassesC !== '#0c0c0c' ? o.glassesC : '#21e6ff'), gg, 0, 0, 0.027); gg.position.set(0, 0.035, 0.19); add('glasses', gg); }
  else if (o.glasses && o.glassesStyle === 'round') { const gg = new THREE.Group(); const m = mat(o.glassesC || '#6d4c41', { metalness: 0.6, roughness: 0.3 }); for (const s of [1, -1]) mk(new THREE.TorusGeometry(0.045, 0.008, 4, 14), m, gg, 0.07 * s, 0, 0); gg.position.set(0, 0.03, 0.2); add('glasses', gg); }
  else if (o.glasses) add('glasses', mk(G.glasses, mat(o.glassesC || '#0c0c0c', { metalness: 0.5, roughness: 0.2 }), new THREE.Group(), 0, 0.03, 0.2).parent);
}

// ---- props ----
const PG = {
  glass: _CY(0.05, 0.04, 0.14, 10), coconut: _SG(0.1, 10, 8),
  straw: _CY(0.008, 0.008, 0.16, 4), cup: _CY(0.045, 0.035, 0.1, 10),
  plate: _CY(0.15, 0.12, 0.025, 14), food: _SG(0.06, 8, 6),
  phone: _BX(0.08, 0.15, 0.012), book: _BX(0.22, 0.03, 0.16),
  micH: _CY(0.022, 0.016, 0.2, 8), micB: _SG(0.045, 8, 6), shaker: _CY(0.05, 0.042, 0.2, 10), tray: _CY(0.24, 0.24, 0.02, 16),
};
export function createProp(kind, color = '#ffb347') {
  const g = new THREE.Group();
  if (kind === 'glass' || kind === 'beer') {
    mk(PG.glass, new THREE.MeshStandardMaterial({ color: kind === 'beer' ? '#f2b233' : color, transparent: true, opacity: 0.85, emissive: kind === 'beer' ? '#5a3a00' : color, emissiveIntensity: 0.35 }), g, 0, 0.07, 0);
    if (kind === 'beer') mk(PG.glass, mat('#fffbe8'), g, 0, 0.155, 0).scale.set(1.05, 0.15, 1.05);
    else mk(PG.straw, mat('#ff3d7f'), g, 0.02, 0.16, 0).rotation.z = 0.25;
  } else if (kind === 'coconut') { mk(PG.coconut, mat('#5c9c2e'), g, 0, 0.09, 0); mk(PG.straw, mat('#ff3d7f'), g, 0.02, 0.22, 0).rotation.z = 0.2;
  } else if (kind === 'cup') { mk(PG.cup, mat(color), g, 0, 0.05, 0); mk(PG.cup, mat('#ffffff'), g, 0, 0.012, 0).scale.set(1.3, 0.1, 1.3);
  } else if (kind === 'plate') { mk(PG.plate, mat('#ffffff'), g, 0, 0.01, 0); for (let i = 0; i < 3; i++) mk(PG.food, mat(color), g, Math.cos(i * 2.1) * 0.06, 0.05, Math.sin(i * 2.1) * 0.06).scale.y = 0.6;
  } else if (kind === 'receiver') { const m = mat('#141414', { metalness: 0.3, roughness: 0.35 }); mk(_CY(0.022, 0.022, 0.2, 8), m, g, 0, 0.06, 0); mk(_BX(0.06, 0.04, 0.055), m, g, 0, 0.17, 0.02); mk(_BX(0.06, 0.04, 0.055), m, g, 0, -0.05, 0.02);
    for (let i = 0; i < 6; i++) mk(new THREE.TorusGeometry(0.018, 0.005, 4, 8), m, g, 0, -0.08 - i * 0.022, 0.0);
  } else if (kind === 'armchair') { const v = mat('#2f6fb3', { roughness: 0.9 }), wd = mat('#4e1f12', { roughness: 0.5 }), bt = mat('#1f4f86');
    mk(_BX(0.82, 0.16, 0.7), v, g, 0, 0.42, -0.02); mk(_BX(0.86, 0.95, 0.16), v, g, 0, 0.85, -0.38); mk(_CY(0.43, 0.43, 0.16, 12, 1, false, 0, Math.PI), v, g, 0, 1.33, -0.38).rotation.set(Math.PI / 2, 0, Math.PI / 2 * 0 + Math.PI / 2);
    for (const x of [-0.43, 0.43]) { mk(_BX(0.12, 0.3, 0.68), v, g, x, 0.6, -0.04); mk(_BX(0.14, 0.05, 0.7), wd, g, x, 0.77, -0.04); for (const z of [-0.32, 0.26]) mk(_BX(0.06, 0.34, 0.06), wd, g, x * 0.92, 0.17, z); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) mk(_SG(0.02, 5, 4), bt, g, -0.25 + i * 0.25, 0.62 + j * 0.25, -0.29);
  } else if (kind === 'phone') { mk(PG.phone, mat('#222', { metalness: 0.6, roughness: 0.3 }), g, 0, 0.05, 0);
  } else if (kind === 'book') { mk(PG.book, mat(color), g, 0, 0, 0);
  } else if (kind === 'mic') { mk(PG.micH, mat('#111', { metalness: 0.5 }), g, 0, 0.06, 0); mk(PG.micB, mat('#9e9e9e', { metalness: 0.8, roughness: 0.3 }), g, 0, 0.18, 0);
  } else if (kind === 'shaker') { mk(PG.shaker, mat('#cfd8dc', { metalness: 0.9, roughness: 0.2 }), g, 0, 0.1, 0);
  } else if (kind === 'tray') { mk(PG.tray, mat('#3e2723'), g, 0, 0.0, 0); for (let i = 0; i < 3; i++) mk(PG.glass, new THREE.MeshStandardMaterial({ color: '#f2b233', transparent: true, opacity: 0.85, emissive: '#5a3a00', emissiveIntensity: 0.35 }), g, Math.cos(i * 2.1) * 0.12, 0.08, Math.sin(i * 2.1) * 0.12); }
  return g;
}
export function holdProp(av, kind, color) {
  if (av.prop) { av.handR.remove(av.prop); av.prop = null; av.propKind = null; }
  if (!kind) return; av.prop = createProp(kind, color); av.propKind = kind;
  if (kind === 'plate') av.prop.position.set(0, 0.02, 0.1);
  if (kind === 'tray') av.prop.position.set(0, 0.03, 0.16);
  if (kind === 'book') { av.prop.rotation.x = Math.PI / 2.4; av.prop.position.set(0.12, 0, 0.1); }
  av.handR.add(av.prop);
}

// ---- animation ----
/** Global beat clock shared by every dancer so the whole bar moves in sync. b = beats elapsed, energy = 1 normal, ~1.4 during live show. */
export const BEAT = { b: 0, bpm: 124, energy: 1 };
export const DANCES = ['dance1', 'quaytay', 'vinahouse', 'dance2', 'dance3', 'disco', 'spin', 'headbang', 'conga', 'circle', 'couple'];
const lerp = (a, b, k) => a + (b - a) * k;
export function animateAvatar(av, dt, t) {
  av.animT += dt; const a = av.anim, T = av.animT + (av.phase || 0);
  let lL = 0, lR = 0, aLx = 0, aRx = 0, aLz = 0.08, aRz = -0.08, bodyY = 0, bodyRx = 0, bodyRz = 0, torsoRx = av.opts.age === 'elder' ? 0.12 : 0, torsoRy = 0, headRx = 0, headRy = 0, legSpread = 0, bodyRy = 0; const B = BEAT.b + (av.beatOff || 0), E = BEAT.energy * (av.energyMul || 1);
  if (av.drop > 0) av.drop -= dt;
  switch (a) {
    case 'walk': case 'hike': { const k = av.stride || 1, s = Math.sin(T * (a === 'hike' ? 7 : 9) * (k < 1 ? 1.25 : 1)); lL = s * 0.6 * k; lR = -s * 0.6 * k; aLx = -s * 0.5 * k; aRx = s * 0.5 * k; bodyY = Math.abs(Math.cos(T * 9)) * 0.04; if (a === 'hike') torsoRx += 0.15; break; }
    case 'run': { const s = Math.sin(T * 13); lL = s * 0.9; lR = -s * 0.9; aLx = -s * 0.9; aRx = s * 0.9; bodyY = Math.abs(Math.cos(T * 13)) * 0.08; torsoRx += 0.2; break; }
    case 'idle': case 'queue': bodyY = Math.sin(T * 2) * 0.008; headRy = Math.sin(T * 0.5) * 0.3; break;
    case 'sit': case 'sitRock': lL = lR = -1.5; aLx = aRx = -0.35; headRy = Math.sin(T * 0.4) * 0.4; break;
    case 'eat': case 'sip': { lL = lR = -1.5; aLx = -0.4; const k = (Math.sin(T * 1.6) + 1) / 2; aRx = lerp(-0.6, -2.3, k * k); aRz = lerp(-0.1, 0.35, k * k); break; }
    case 'read': lL = lR = -1.5; aLx = aRx = -1.1; aLz = -0.25; aRz = 0.25; headRx = 0.35; break;
    case 'laptop': lL = lR = -1.5; aLx = aRx = -1.05 + Math.sin(T * 14) * 0.04; aLz = -0.15; aRz = 0.15; headRx = 0.25; break;
    case 'lie': bodyRx = -Math.PI / 2; aLx = aRx = -2.9; aLz = 0.5; aRz = -0.5; legSpread = 0.08; break;
    case 'swim': { bodyRx = 1.35; const s = T * 4; aLx = -(s % (Math.PI * 2)); aRx = -((s + Math.PI) % (Math.PI * 2)); lL = Math.sin(T * 8) * 0.3; lR = -lL; headRx = -0.9; bodyY = Math.sin(T * 2) * 0.03; break; }
    case 'wade': bodyY = Math.sin(T * 1.5) * 0.04; aLz = 0.6 + Math.sin(T * 2) * 0.2; aRz = -0.6 - Math.sin(T * 2) * 0.2; break;
    case 'dig': lL = lR = -1.5; legSpread = 0.15; torsoRx = 0.5; aLx = -0.9 + Math.sin(T * 5) * 0.4; aRx = -0.9 - Math.sin(T * 5) * 0.4; headRx = 0.4; break;
    case 'photo': aLx = aRx = -1.55; aLz = -0.32; aRz = 0.32; headRx = 0.05; break;
    case 'view': aRx = -2.6; aRz = 0.5; headRy = Math.sin(T * 0.3) * 0.5; break;
    case 'volley': { const p = (T * 1.1) % 2; const j = p < 0.6 ? Math.sin(p / 0.6 * Math.PI) : 0; bodyY = j * 0.35; aLx = aRx = j > 0.1 ? -2.9 : -0.9; aLz = 0.15; aRz = -0.15; lL = lR = j * -0.3; break; }
    // ---- beat-synced dances (B = global beats) ----
    case 'dance1': { // Nhún nhảy – bounce
      const k = Math.abs(Math.sin(Math.PI * B)); bodyY = k * 0.09 * E; aLx = -0.7 - k * 0.35 * E; aRx = -0.7 - (1 - k) * 0.35 * E; aLz = 0.25; aRz = -0.25; headRx = k * 0.18; bodyRz = Math.sin(Math.PI * B / 2) * 0.06; break; }
    case 'quaytay': { // Quẩy tay – hands up waving
      const s = Math.sin(Math.PI * B / 2), k = Math.abs(Math.sin(Math.PI * B)); bodyY = k * 0.08 * E; aLz = 2.55 + s * 0.35 * E; aRz = -2.55 + s * 0.35 * E; aLx = aRx = -0.25; bodyRz = s * 0.12; headRy = s * 0.25; break; }
    case 'vinahouse': { // Quẩy Vinahouse – side-to-side hand swing + head shake
      const s = Math.sin(Math.PI * B), k = Math.abs(s); aLx = -1.05 - k * 0.2; aRx = -1.05 - k * 0.2; aLz = s * 0.85 * E; aRz = s * 0.85 * E; torsoRy = s * 0.4 * E; headRy = -s * 0.45; headRx = k * 0.15; bodyY = Math.abs(Math.sin(Math.PI * B * 2)) * 0.05 * E; legSpread = 0.1; break; }
    case 'dance2': { // Shuffle – alternating kicks, twice per beat
      const s = Math.sin(Math.PI * B * 2); lL = Math.max(0, s) * -0.9 * E; lR = Math.max(0, -s) * -0.9 * E; bodyY = Math.abs(s) * 0.12; aLx = -1.2 - s * 0.5; aRx = -1.2 + s * 0.5; torsoRy = s * 0.3; break; }
    case 'dance3': { // Robot – snaps to a new pose every beat
      const st = Math.floor(B) % 4; aLz = [1.57, 0.2, 1.57, 0.2][st]; aRz = -[0.2, 1.57, 1.57, 0.2][st]; aLx = st === 3 ? -1.5 : 0; aRx = st === 3 ? -1.5 : 0; torsoRy = [0.4, -0.4, 0, 0][st]; headRy = [-0.5, 0.5, 0, 0][st]; break; }
    case 'disco': { // Disco chỉ tay (Saturday Night Fever)
      const up = Math.floor(B) % 2 === 0; const k = Math.abs(Math.sin(Math.PI * B)); aRz = up ? -2.45 : 0.55; aRx = up ? -0.35 : -0.45; aLz = 0.75; aLx = -0.25; bodyRz = (up ? -0.12 : 0.12) * E; headRy = up ? -0.35 : 0.25; headRx = up ? -0.2 : 0.1; bodyY = k * 0.04; legSpread = up ? 0.12 : 0.04; break; }
    case 'spin': { // Xoay vòng – one full turn every 4 beats
      bodyRy = (B % 4) / 4 * Math.PI * 2; aLz = 1.35; aRz = -1.35; aLx = aRx = -0.2; bodyY = Math.abs(Math.sin(Math.PI * B)) * 0.07 * E; headRx = -0.1; break; }
    case 'headbang': { // Lắc đầu EDM – headbang + fist pump
      const k = Math.abs(Math.sin(Math.PI * B)); torsoRx += 0.18 + k * 0.15 * E; headRx = -0.25 + k * 0.6 * E; aRx = -2.4 - k * 0.5; aRz = 0.2; aLx = -0.9; aLz = 0.3; legSpread = 0.14; bodyY = k * 0.04; break; }
    case 'conga': { // Đoàn tàu conga – hands on shoulders, kick on 4
      const q = B % 4; aLx = aRx = -1.45; aLz = -0.12; aRz = 0.12; lL = q >= 2 && q < 3 ? -0.65 * E : 0; lR = q >= 3 ? -0.65 * E : 0; bodyY = Math.abs(Math.sin(Math.PI * B)) * 0.05; bodyRz = Math.sin(Math.PI * B / 2) * 0.1; break; }
    case 'circle': { // Vòng tròn – holding hands, side-steps
      const s = Math.sin(Math.PI * B); aLz = 0.95; aRz = -0.95; aLx = aRx = -0.35 + Math.abs(s) * -0.2; legSpread = 0.05 + Math.abs(s) * 0.15; bodyY = Math.abs(s) * 0.06 * E; headRy = Math.sin(Math.PI * B / 4) * 0.3; break; }
    case 'couple': { // Nhảy đôi – sway together, role b twirls every 8 beats
      const s = Math.sin(Math.PI * B / 2); bodyRz = s * 0.12; aLx = aRx = -1.0; aLz = -0.35; aRz = 0.35; bodyY = Math.abs(Math.sin(Math.PI * B)) * 0.04;
      if (av.coupleRole === 'b' && B % 8 >= 6) { bodyRy = ((B % 8) - 6) / 2 * Math.PI * 2; aRz = -2.6; aRx = 0; } break; }
    // ---- bar actions ----
    case 'chug': { const k = Math.min(1, av.animT * 1.5); aRx = -1.6 - 1.3 * k; aRz = 0.35; headRx = -0.6 * k; torsoRx -= 0.15 * k; aLz = 0.7; aLx = -0.2; break; }
    case 'lean': { const talk = Math.sin(T * 0.7) > 0; torsoRx += 0.22; aLx = -1.35; aLz = -0.05; aRx = talk ? -0.9 + Math.sin(T * 4) * 0.35 : -1.3; aRz = talk ? -0.25 + Math.sin(T * 3) * 0.2 : 0.1; headRy = Math.sin(T * 0.9) * 0.45; headRx = talk ? Math.sin(T * 6) * 0.08 : 0; bodyRz = Math.sin(Math.PI * B / 2) * 0.03; break; }
    case 'pour': { const k = (Math.sin(T * 0.9) + 1) / 2; aRx = -1.15 + k * 0.1; aRz = 0.25; aLx = -2.0 - k * 0.5; aLz = 0.25; headRx = 0.25; torsoRx += 0.08; break; }
    case 'shake': { const s = Math.sin(T * 26); aRx = -2.4 + s * 0.3; aLx = -2.3 + s * 0.3; aLz = -0.55; aRz = 0.15; headRy = -0.25; bodyY = Math.abs(s) * 0.01; break; }
    case 'stoolSway': { lL = lR = -1.5; bodyRz = Math.sin(Math.PI * B / 2) * 0.08 * E; headRx = Math.abs(Math.sin(Math.PI * B)) * 0.15; const raise = B % 16 > 14; aRx = raise ? -2.7 : -0.9 - Math.abs(Math.sin(Math.PI * B)) * 0.2; aRz = raise ? 0.15 : 0.1; aLx = -0.5; break; }
    case 'hype': { const k = Math.abs(Math.sin(Math.PI * B)); bodyY = k * 0.22 * E; aLz = 2.75; aRz = -2.75; aLx = aRx = -0.3 - k * 0.3; headRx = -0.25; lL = lR = -k * 0.25; break; }
    case 'film': { aRx = -2.15; aRz = 0.12; aLx = -0.2; aLz = 0.2; headRx = -0.15; bodyRz = Math.sin(Math.PI * B / 2) * 0.05; break; }
    case 'selfie': { const k = (Math.sin(T * 0.8) + 1) / 2; aRx = -1.85; aRz = -0.55; aLz = 2.4 * k; aLx = -0.4; headRy = -0.35; headRx = -0.1; bodyRz = 0.08; break; }
    case 'mc': { const k = Math.abs(Math.sin(Math.PI * B)); aRx = -2.45; aRz = 0.6; aLx = -2.2 - k * 0.7 * E; aLz = 0.2 + k * 0.3; bodyY = k * 0.06 * E; headRx = -0.1 + k * 0.1; break; }
    case 'hug': { const k = Math.min(1, av.animT * 2); aLx = aRx = -1.35 * k; aLz = -0.75 * k; aRz = 0.75 * k; headRy = 0.35 * k; bodyY = Math.sin(T * 2) * 0.01; torsoRx += 0.08 * k; break; }
    case 'holdhand': aLz = 0.35; aLx = -0.25; aRz = -0.35; aRx = -0.25; headRy = Math.sin(T * 0.8) * 0.35; bodyY = Math.sin(T * 2.2) * 0.012; break;
    case 'pairdance': { const s = Math.sin(B * Math.PI); bodyRz = s * 0.12; bodyY = Math.abs(s) * 0.05; lL = s * 0.3; lR = -s * 0.3; aLx = -1.2; aRx = -1.2; aLz = -0.4 + s * 0.1; aRz = 0.4 + s * 0.1; torsoRy = s * 0.2; break; }
    case 'rock': { const k = Math.min(1, av.animT * 4); aRx = -1.45 * k; aRz = 0.9 * k; aLx = -0.15; torsoRy = -0.12 * k; headRy = 0.18 * k; headRx = -0.08 * k; bodyY = Math.abs(Math.sin(T * 5)) * 0.015; legSpread = 0.08; break; }
    case 'boss': case 'bossp': lL = lR = -1.32; legSpread = 0.34; torsoRx = -0.16; headRx = -0.05; headRy = 0.12; aLx = -0.55; aLz = 0.32; aRx = -2.7; aRz = 0.62; break;
    case 'wave': aRz = -2.7 + Math.sin(T * 12) * 0.35; break;
    case 'stargaze': aLz = 0.35; aLx = -0.25; aRz = -0.35; aRx = -0.25; headRx = -0.7; headRy = Math.sin(T * 0.3) * 0.25; bodyY = Math.sin(T * 1.2) * 0.008; break;
    case 'toast2': { const k = Math.min(1, av.animT * 2.5); aRx = -1.7 * k; aRz = 0.35 * k; aLx = -0.3; headRx = -0.1; bodyY = Math.sin(T * 3) * 0.008; break; }
    case 'cheers': { const k = Math.min(1, av.animT * 3); aRx = -2.0 * k; aRz = 0.2 * k; bodyY = Math.sin(T * 6) * 0.01; break; }
    case 'clap': { aLx = aRx = -1.3; const s = (Math.sin(T * 18) + 1) / 2; aLz = -0.25 - s * 0.35; aRz = 0.25 + s * 0.35; break; }
    case 'serve': { const s = Math.sin(T * 2); aRx = -1.2 + s * 0.3; aLx = -1.0 - s * 0.2; headRy = Math.sin(T * 0.7) * 0.5; break; }
    case 'grill': { const s = Math.sin(T * 4); aRx = -1.1; aRz = s * 0.4; aLx = -0.9; torsoRx += 0.15; headRx = 0.3; break; }
    case 'dj': { const md = Math.floor(B / 16) % 3, k = Math.abs(Math.sin(Math.PI * B)); aLx = -2.7; aLz = 0.9; bodyY = k * 0.05 * E; headRx = k * 0.28 * E;
      if (md === 0) { const s = Math.sin(T * 3); aRx = -1.1 + s * 0.15; aRz = s * 0.35; } // mixing knobs
      else if (md === 1) { aRx = -1.05; aRz = Math.sin(Math.PI * B * 2) * 0.5; torsoRx += 0.1; } // scratching
      else { aRx = -2.4 - k * 0.6; aRz = 0.15; } // fist pump
      if (av.drop > 0) { aLz = 2.7; aRz = -2.7; aLx = aRx = -0.3; bodyY = k * 0.2; } break; }
    case 'serveTray': { const s = Math.sin(T * 9); lL = s * 0.5; lR = -s * 0.5; aRx = -1.6; aRz = 0.3; aLx = -s * 0.4; bodyY = Math.abs(Math.cos(T * 9)) * 0.03; break; }
    case 'bartend': { const s = Math.sin(T * 9); aRx = -1.8 + s * 0.6; aLx = -1.8 - s * 0.6; aRz = 0.3; aLz = -0.3; break; }
    case 'drink': { const k = (Math.sin(T * 2.4) + 1) / 2; aRx = lerp(-0.8, -2.5, k); aRz = lerp(0, 0.4, k); break; }
  }
  // Rock tay: horns fingers on the right hand
  if (a === 'rock' && !av.horns) { const hg = new THREE.Group(); const sm = mat(av.opts.skin || '#e0ac69'); for (const x of [0.03, -0.03]) { const f = new THREE.Mesh(CG.finger, sm); f.rotation.x = Math.PI / 2; f.position.set(x, 0.0, 0.07); hg.add(f); } av.handR.add(hg); av.horns = hg; }
  if (av.horns) av.horns.visible = a === 'rock';
  // Ngồi ghế boss: receiver prop + a portable velvet armchair when not on a real seat
  const bossA = a === 'boss' || a === 'bossp';
  if (bossA && !av._boss) { av._boss = true; holdProp(av, 'receiver'); }
  else if (!bossA && av._boss) { av._boss = false; if (av.propKind === 'receiver') holdProp(av, null); }
  if (a === 'bossp') { if (!av.bossChair) { av.bossChair = createProp('armchair'); av.root.add(av.bossChair); } av.bossChair.visible = true; bodyY = -0.38; lL = lR = -1.32; }
  else if (av.bossChair) av.bossChair.visible = false;
  animateExtras(av, t);
  const sitting = ['sit', 'sitRock', 'stoolSway', 'eat', 'sip', 'read', 'laptop', 'dig'].includes(a);
  if (av.seated && a !== "lie") { lL = lR = -1.5; bodyY = Math.min(bodyY, 0.03); }
  av.legL.rotation.x = lL; av.legR.rotation.x = lR; av.legL.rotation.z = legSpread; av.legR.rotation.z = -legSpread;
  av.armL.rotation.x = aLx; av.armR.rotation.x = aRx; av.armL.rotation.z = aLz; av.armR.rotation.z = aRz;
  av.body.position.y = bodyY + (av.seated || sitting || bossA || a === 'lie' || a === 'swim' ? 0 : (av.lift || 0)); av.body.rotation.x = bodyRx; av.body.rotation.z = bodyRz; av.body.rotation.y = bodyRy;
  av.torso.rotation.x = torsoRx; av.torso.rotation.y = torsoRy; av.head.rotation.x = headRx; av.head.rotation.y = headRy;
  if (sitting || a === 'lie' || a === 'swim') av.body.position.y += 0; // vertical offsets handled by caller via root.y
  av.shadow.visible = !(a === 'swim');
}

// ---- sprites (name tag, bubble) ----
export function textSprite(text, { color = '#fff', bg = 'rgba(10,5,25,0.6)', size = 30, h = 0.32, border = null, legend = false } = {}) {
  const c = document.createElement('canvas'); const x = c.getContext('2d');
  if (legend) { text = '✦ ' + text + ' ✦'; color = '#fff6d0'; }
  x.font = `bold ${size}px system-ui,sans-serif`; const w = Math.ceil(x.measureText(text).width) + (legend ? 44 : 28);
  c.width = w; c.height = size + (legend ? 28 : 20); x.font = `bold ${size}px system-ui,sans-serif`;
  if (legend) { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#5a3a00'); g.addColorStop(0.5, '#2a1640'); g.addColorStop(1, '#5a3a00'); bg = g; }
  x.fillStyle = bg; roundRect(x, 2, 2, w - 4, c.height - 4, 14); x.fill();
  if (legend) { const g = x.createLinearGradient(0, 0, w, c.height); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#d4af37'); g.addColorStop(1, '#ffe082'); x.strokeStyle = g; x.lineWidth = 4; x.stroke(); roundRect(x, 7, 7, w - 14, c.height - 14, 10); x.strokeStyle = 'rgba(255,236,160,0.5)'; x.lineWidth = 1.5; x.stroke(); x.shadowColor = '#ffb300'; x.shadowBlur = 10; }
  if (border) { x.strokeStyle = border; x.lineWidth = 3; x.stroke(); }
  x.fillStyle = color; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(text, w / 2, c.height / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(h * w / c.height, h, 1); s.renderOrder = 10; return s;
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
export function disposeSprite(s) { if (!s) return; s.material.map.dispose(); s.material.dispose(); s.parent && s.parent.remove(s); }

// =====================================================================================
// PREMIUM & TRADITIONAL GARMENTS
// Rule: free items = plain matte. Paid items get a finish by rarity:
//   Hiếm (h) = satin/metallic sheen + pattern · Sử thi (s) = glitter/sequin + gold accents + subtle glow
//   Huyền thoại (l) = animated emissive shimmer/holographic + sparkle particles (+ name-tag frame & entrance FX, see style.js)
// TIERS is filled by catalog.js ('slot:kind' -> rarity of paid items).
// =====================================================================================
export const TIERS = {};
export const tierOf = (slot, kind) => (kind && TIERS[slot + ':' + kind]) || 't';
const ANIM_TEX = [];
const _rng = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function patTex(pat, c, acc) {
  const t = canvasTex('pat:' + pat + c + acc, 128, 128, (x, w, h) => {
    const R = _rng(7); x.fillStyle = c; x.fillRect(0, 0, w, h);
    const dot = (px, py, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); };
    const flower = (px, py, r, col, mid) => { for (let k = 0; k < 5; k++) dot(px + Math.cos(k * 1.2566) * r, py + Math.sin(k * 1.2566) * r, r * 0.75, col); dot(px, py, r * 0.5, mid || '#fff3b0'); };
    switch (pat) {
      case 'damask': x.globalAlpha = 0.5; x.strokeStyle = acc; x.lineWidth = 3; for (let i = -1; i < 3; i++) for (let j = -1; j < 3; j++) { const cx = i * 64 + (j % 2 ? 32 : 0), cy = j * 64; x.beginPath(); x.moveTo(cx, cy - 26); x.quadraticCurveTo(cx + 22, cy, cx, cy + 26); x.quadraticCurveTo(cx - 22, cy, cx, cy - 26); x.stroke(); dot(cx, cy, 5, acc); } x.globalAlpha = 1; break;
      case 'sequin': for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const v = R(); dot(i * 8 + (j % 2) * 4 + 4, j * 8 + 4, 3.6, v > 0.7 ? '#ffffff' : v > 0.35 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'); } break;
      case 'cyber': x.strokeStyle = acc; x.globalAlpha = 0.8; x.lineWidth = 2; for (let i = 0; i < 9; i++) { const y = R() * h, x0 = R() * w; x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + 30, y); x.lineTo(x0 + 42, y + 12); x.lineTo(x0 + 70, y + 12); x.stroke(); dot(x0 + 70, y + 12, 3, acc); } x.globalAlpha = 1; break;
      case 'flame': for (let i = 0; i < 6; i++) { const px = i * 22 + 6; x.fillStyle = i % 2 ? acc : '#ffb300'; x.beginPath(); x.moveTo(px - 12, h); x.quadraticCurveTo(px - 10, h - 50, px, h - 80 - R() * 30); x.quadraticCurveTo(px + 10, h - 50, px + 12, h); x.fill(); } break;
      case 'silk': { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0.0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); break; }
      case 'embroid': x.strokeStyle = acc; x.lineWidth = 2.5; for (let k = 0; k < 3; k++) { const px = 20 + k * 44, py = 20 + (k % 2) * 60; x.beginPath(); x.arc(px, py + 20, 18, 3.6, 6.0); x.stroke(); flower(px + 14, py + 8, 6, acc); flower(px - 12, py + 30, 4, acc); } break;
      case 'scale': for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) { x.strokeStyle = j % 2 ? acc : 'rgba(255,255,255,0.45)'; x.lineWidth = 2; x.beginPath(); x.arc(i * 16 + (j % 2) * 8, j * 16, 9, 0.1, Math.PI - 0.1); x.stroke(); } break;
      case 'holo': { const g = x.createLinearGradient(0, 0, w, h); ['#ff4fd8', '#7c4dff', '#21e6ff', '#69f0ae', '#ffee58', '#ff4fd8'].forEach((s, i) => g.addColorStop(i / 5, s)); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) dot(R() * w, R() * h, 1.5 + R() * 2, '#ffffff'); break; }
      case 'sakura': for (let i = 0; i < 9; i++) flower(R() * w, R() * h, 5 + R() * 3, acc, '#ffe082'); break;
      case 'stripes': x.fillStyle = acc; for (let i = 0; i < 8; i++) x.fillRect(i * 16, 0, 4, h); break;
      case 'floral': for (let i = 0; i < 7; i++) flower(R() * w, R() * h, 7, acc, '#fff'); x.strokeStyle = 'rgba(0,80,0,0.4)'; break;
      case 'paisley': x.fillStyle = acc; x.fillRect(0, h - 18, w, 10); for (let i = 0; i < 5; i++) { const px = 12 + i * 26, py = 30 + (i % 2) * 34; x.beginPath(); x.ellipse(px, py, 7, 12, 0.6, 0, 7); x.fill(); dot(px + 7, py - 12, 2.5, acc); } break;
      case 'polka': for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) dot(i * 26 + (j % 2) * 13 + 6, j * 26 + 6, 6, '#ffffff'); break;
      case 'andes': { const cols = ['#c62828', '#ffb300', '#1565c0', '#2e7d32', '#fafafa']; for (let j = 0; j < 8; j++) { x.fillStyle = cols[j % 5]; x.fillRect(0, j * 16, w, 8); x.fillStyle = cols[(j + 2) % 5]; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 16, j * 16 + 8); x.lineTo(i * 16 + 8, j * 16 + 14); x.lineTo(i * 16 + 16, j * 16 + 8); x.fill(); } } break; }
      case 'pleat': x.fillStyle = 'rgba(0,0,0,0.28)'; for (let i = 0; i < 8; i++) x.fillRect(i * 16, 0, 3, h); break;
      case 'tartan': x.globalAlpha = 0.45; x.fillStyle = acc; for (let i = 0; i < 4; i++) { x.fillRect(i * 32 + 4, 0, 10, h); x.fillRect(0, i * 32 + 4, w, 10); } x.fillStyle = '#111'; for (let i = 0; i < 4; i++) { x.fillRect(i * 32 + 20, 0, 3, h); x.fillRect(0, i * 32 + 20, w, 3); } x.globalAlpha = 1; break;
      case 'grass': for (let i = 0; i < 64; i++) { x.fillStyle = i % 3 ? '#c8b26a' : '#7cb342'; x.fillRect(i * 2, 0, 1.6, h); } break;
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
}
let _glit = null; const glitterTex = () => _glit || (_glit = (() => { const t = canvasTex('glitter', 128, 128, (x, w, h) => { const R = _rng(3); x.fillStyle = '#000'; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const v = R(); x.fillStyle = v > 0.8 ? '#ffffff' : v > 0.5 ? '#ffe9a8' : '#555'; x.fillRect(R() * w, R() * h, 1.6, 1.6); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); ANIM_TEX.push([t, 0.03, 0.05]); return t; })());
let _shim = null; const shimmerTex = () => _shim || (_shim = (() => { const t = canvasTex('shimmer', 128, 128, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0.35, 'rgba(0,0,0,0)'); g.addColorStop(0.5, '#fff6d0'); g.addColorStop(0.65, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.rotation = 0.6; ANIM_TEX.push([t, 0.25, 0]); return t; })());
const fabCache = new Map();
/** fabric material: colour + optional pattern, finished by rarity tier */
export function fabric(c, tier = 't', pat = 'none', acc = null) {
  const k = [c, tier, pat, acc].join('|'); if (fabCache.has(k)) return fabCache.get(k);
  const map = pat && pat !== 'none' ? patTex(pat, c, acc || '#d4af37') : null, low = Q.level === 'low';
  const P = { color: map ? '#ffffff' : c, map, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 };
  if (tier === 'h') Object.assign(P, { roughness: 0.38, metalness: 0.22 });
  if (tier === 's') Object.assign(P, { roughness: 0.28, metalness: 0.45, emissive: '#ffffff', emissiveMap: glitterTex(), emissiveIntensity: 0.4 });
  if (tier === 'l') { const hol = pat === 'holo'; if (hol) { const ht = map; ANIM_TEX.push([ht, 0.06, 0.03]); } Object.assign(P, { roughness: 0.22, metalness: 0.55, emissive: '#ffffff', emissiveMap: hol ? map : shimmerTex(), emissiveIntensity: hol ? 0.55 : 0.45 }); }
  const m = (tier === 'h' || tier === 's' || tier === 'l') && !low ? new THREE.MeshPhysicalMaterial({ ...P, sheen: 0.8, sheenRoughness: 0.3, sheenColor: new THREE.Color(acc || '#ffffff'), clearcoat: tier === 't' ? 0 : 0.35, clearcoatRoughness: 0.25 }) : new THREE.MeshStandardMaterial(P);
  fabCache.set(k, m); return m;
}
export function animateFabrics(t) { for (const [tx, sx, sy] of ANIM_TEX) { tx.offset.x = (t * sx) % 1; tx.offset.y = (t * sy) % 1; } }
const GD = '#d4af37';
/** new top kinds. skirt:[h, bottomRadius, centreY] makes it a full-length garment */
export const GARB = {
  // —— premium lines ——
  royal: { g: 'm', sl: 'long', pat: 'damask', acc: GD, trim: GD, cape: '#7b1020', epaul: true, collar: 'high' },
  royalgown: { g: 'f', sl: 'long', pat: 'damask', acc: GD, trim: GD, skirt: [0.86, 0.52, 0.46], train: true, collar: 'v' },
  sequingown: { g: 'f', sl: 'none', pat: 'sequin', skirt: [0.86, 0.4, 0.46], trim: '#e0e0e0' },
  redtux: { g: 'm', sl: 'long', pat: 'silk', lapel: '#0a0a0a', bow: '#0a0a0a', shirt: true },
  cyber: { g: 'u', sl: 'long', pat: 'cyber', acc: '#21e6ff', glow: '#21e6ff' },
  angelrobe: { g: 'u', sl: 'wide', pat: 'damask', acc: '#f5e6a8', trim: GD, skirt: [0.84, 0.42, 0.47], sash: [GD, 'belt'] },
  devilsuit: { g: 'u', sl: 'long', pat: 'flame', acc: '#ff3d00', glow: '#ff3d00', cape: '#2a0008' },
  captain: { g: 'm', sl: 'long', pat: 'none', trim: GD, epaul: true, buttons: GD },
  silkresort: { g: 'f', sl: 'none', pat: 'silk', skirt: [0.7, 0.4, 0.55], sash: [GD, 'belt'] },
  aodaigold: { g: 'u', sl: 'long', pat: 'embroid', acc: '#fff3b0', collar: 'mandarin', flaps: true, trim: GD },
  kpop: { g: 'u', sl: 'long', pat: 'sequin', trim: '#e0e0e0', chains: true, glow: '#ff4fd8' },
  knight: { g: 'u', sl: 'long', pat: 'none', armor: '#2b2f38', cape: '#120f1c', trim: '#9aa4b5' },
  mermaid: { g: 'f', sl: 'none', pat: 'scale', acc: '#b2fff3', skirt: [0.78, 0.25, 0.5], tail: true, shells: true },
  seagod: { g: 'm', sl: 'none', pat: 'scale', acc: '#b2fff3', armor: '#00897b', cape: '#006064', trim: GD },
  discosuit: { g: 'u', sl: 'long', pat: 'holo', collar: 'v', glow: '#ffffff' },
  // —— traditional ——
  montsuki: { g: 'm', sl: 'wide', pat: 'none', collar: 'v', crest: true },
  aodainam: { g: 'm', sl: 'long', pat: 'none', collar: 'mandarin', flaps: true },
  aotuthan: { g: 'f', sl: 'long', pat: 'none', skirt: [0.66, 0.36, 0.56], sash: ['#ff7043', 'belt'], yem: '#e53935', flaps: true },
  kimono: { g: 'f', sl: 'wide', pat: 'sakura', acc: '#ffc1d9', skirt: [0.78, 0.27, 0.5], sash: ['#c62828', 'obi'], collar: 'v' },
  furisode: { g: 'f', sl: 'wide', pat: 'embroid', acc: GD, skirt: [0.78, 0.27, 0.5], sash: [GD, 'obi'], collar: 'v' },
  yukata: { g: 'u', sl: 'wide', pat: 'stripes', acc: '#1a237e', skirt: [0.76, 0.27, 0.51], sash: ['#263238', 'obi'], collar: 'v' },
  hanbok: { g: 'f', sl: 'long', pat: 'none', bolero: '#fff3e0', skirt: [0.82, 0.5, 0.5], ribbon: '#c62828', high: true },
  hanbokm: { g: 'm', sl: 'long', pat: 'none', bolero: '#1a237e', ribbon: '#263238' },
  qipao: { g: 'f', sl: 'short', pat: 'floral', acc: '#ffd54f', skirt: [0.66, 0.27, 0.56], collar: 'mandarin', frog: true },
  qipaogold: { g: 'f', sl: 'none', pat: 'embroid', acc: GD, skirt: [0.8, 0.27, 0.49], collar: 'mandarin', frog: true, trim: GD },
  tangsuit: { g: 'm', sl: 'long', pat: 'damask', acc: GD, collar: 'mandarin', frog: true },
  chutthai: { g: 'f', sl: 'none', pat: 'embroid', acc: GD, skirt: [0.8, 0.32, 0.49], sash: [GD, 'diag'], trim: GD, collarGold: true },
  saree: { g: 'f', sl: 'short', pat: 'paisley', acc: GD, skirt: [0.8, 0.33, 0.49], sash: ['@', 'drape'], trim: GD },
  kurta: { g: 'm', sl: 'long', pat: 'none', tunic: true, collar: 'mandarin', buttons: GD },
  flamenco: { g: 'f', sl: 'short', pat: 'polka', skirt: [0.78, 0.4, 0.5], ruffle: 4 },
  fiesta: { g: 'f', sl: 'short', pat: 'none', skirt: [0.66, 0.46, 0.56], ruffle: 3, rainbow: true },
  carnival: { g: 'f', sl: 'none', bare: true, pat: 'sequin', skirt: [0.2, 0.33, 0.79], feathers: true, trim: GD },
  poncho: { g: 'm', sl: 'long', pat: 'andes', poncho: true },
  charro: { g: 'm', sl: 'long', pat: 'none', bolero: '@', studs: '#e0e0e0', bow: '#c62828', shirt: true },
  hulatop: { g: 'f', sl: 'none', bare: true, pat: 'floral', acc: '#ffeb3b', leiTop: true },
};
export const GARB_B = { hakama: { g: 'm', base: 'wide', pat: 'pleat' }, kilt: { g: 'm', base: 'skirt', pat: 'tartan', acc: '#2e7d32' }, grassskirt: { g: 'f', base: 'grass', pat: 'grass' }, mermaidtail: null };
for (const k in GARB) if (GARB[k].skirt) FULL_TOPS.add(k);
for (const k in GARB) { const g = GARB[k].g; if (g !== 'f') TOPS.m.push(k); if (g !== 'm') TOPS.f.push(k); }
for (const k in GARB_B) if (GARB_B[k]) { const g = GARB_B[k].g; if (g !== 'f') BOTTOMS.m.push(k); if (g !== 'm') BOTTOMS.f.push(k); }
for (const k of ['geta', 'ledsneakers', 'royalboots']) { SHOES.m.splice(SHOES.m.length - 1, 0, k); SHOES.f.splice(SHOES.f.length - 1, 0, k); }
SHOE_LIFT.geta = 0.05; SHOE_LIFT.royalboots = 0.03;
Object.assign(AURAS, { flame: ['#ff5722', '#ffd54f'], bubble: ['#80deea', '#e0f7fa'], disco: ['#ff4fd8', '#4dd0ff'], stardust: ['#b388ff', '#fff3b0'] });
const _trainG = new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
function garbDeco(S, o, c) {
  const { body, torsoG, topM, f, armX, arms, av } = c, tz = f ? 0.175 : 0.195;
  const metal = (col, e = 0.15) => mat(col, { metalness: 0.85, roughness: 0.25, emissive: col, emissiveIntensity: e });
  const trim = S.trim ? metal(S.trim) : null, accM = (col) => col === '@' ? topM : fabric(col, tierOf('top', o.top), 'none');
  if (trim) { mk(G.band, trim, torsoG, 0, 0.03, 0).scale.set(f ? 0.78 : 0.94, 0.3, f ? 0.8 : 0.9); mk(bx(0.026, 0.56, 0.012), trim, torsoG, 0, 0.42, tz + 0.012);
    if (S.skirt) { const r = mk(new THREE.TorusGeometry(S.skirt[1], 0.018, 5, 28), trim, body, 0, S.skirt[2] - S.skirt[0] / 2 + 0.02, 0); r.rotation.x = Math.PI / 2; } }
  if (S.collar === 'mandarin' || S.collar === 'high') { const cl = mk(CG.collar, trim || topM, torsoG, 0, 0.74, 0); cl.rotation.x = Math.PI / 2; cl.scale.set(0.85, 0.85, S.collar === 'high' ? 3 : 2.2); }
  if (S.collar === 'v') for (const s of [1, -1]) { const l = mk(bx(0.035, 0.32, 0.012), trim || mat(S.pat === 'holo' ? '#ffffff' : '#fafafa'), torsoG, 0.055 * s, 0.56, tz + 0.01); l.rotation.z = 0.42 * s; }
  if (S.flaps) for (const z of [0.13, -0.13]) mk(CG.flap, topM, body, 0, 0.55, z).scale.set(f ? 0.92 : 1, 1, 1);
  if (S.shirt) mk(CG.shirtFront, mat('#ffffff'), torsoG, 0, 0.48, tz - 0.005);
  if (S.lapel) for (const s of [1, -1]) { const l = mk(bx(0.07, 0.34, 0.014), mat(S.lapel, { metalness: 0.4, roughness: 0.2 }), torsoG, 0.085 * s, 0.52, tz + 0.006); l.rotation.z = 0.3 * s; }
  if (S.bow) for (const s of [1, -1]) mk(CG.bow, mat(S.bow), torsoG, 0.035 * s, 0.68, tz + 0.012).rotation.z = 0.5 * s;
  if (S.sash) { const [col, kind] = S.sash, sm = col === '@' ? topM : metal(col, 0.1);
    if (kind === 'obi') { mk(G.band, col === GD ? sm : mat(col, { roughness: 0.5 }), torsoG, 0, 0.2, 0).scale.set(f ? 0.84 : 0.98, 1.7, f ? 0.86 : 0.94); mk(bx(0.24, 0.17, 0.09), mat(col, { roughness: 0.5 }), torsoG, 0, 0.22, -0.21); }
    else if (kind === 'belt') mk(G.band, sm, torsoG, 0, 0.06, 0).scale.set(f ? 0.8 : 0.95, 0.45, f ? 0.82 : 0.92);
    else if (kind === 'diag') { const d = mk(bx(0.085, 0.72, 0.02), sm, torsoG, -0.02, 0.42, tz + 0.012); d.rotation.z = -0.62; }
    else if (kind === 'drape') { const d = mk(bx(0.12, 0.72, 0.02), topM, torsoG, -0.02, 0.42, tz + 0.014); d.rotation.z = -0.62; mk(bx(0.16, 0.8, 0.02), topM, torsoG, -0.12, 0.2, -0.2).rotation.z = 0.12; } }
  if (S.cape) { const cm = mat(S.cape, { side: THREE.DoubleSide, roughness: 0.45, metalness: 0.15 }); const cp = mk(bx(0.62, 1.32, 0.02), cm, torsoG, 0, 0.06, -0.215); cp.rotation.x = 0.1; av.cape = cp; if (trim) for (const s of [1, -1]) mk(CG.button, trim, torsoG, 0.2 * s, 0.7, 0.12).scale.setScalar(2); }
  if (S.train) { const tr = mk(_trainG, topM, body, 0, 0.03, -0.42); tr.scale.set(0.85, 0.12, 1.45); }
  if (S.epaul) for (const s of [1, -1]) { mk(bx(0.14, 0.04, 0.13), trim || metal(GD), torsoG, (f ? 0.22 : 0.28) * s, 0.72, 0); mk(bx(0.14, 0.05, 0.13), metal('#fff3b0', 0.3), torsoG, (f ? 0.22 : 0.28) * s, 0.68, 0).scale.set(1.05, 1, 1.05); }
  if (S.buttons) for (let i = 0; i < 4; i++) for (const s of (S.tunic ? [0] : [1, -1])) mk(CG.button, metal(S.buttons), torsoG, 0.07 * s, 0.64 - i * 0.13, tz + 0.012);
  if (S.glow) { const gm = glow(S.glow); for (const s of [1, -1]) mk(bx(0.012, 0.5, 0.008), gm, torsoG, 0.1 * s, 0.42, tz + 0.012);
    const w = mk(new THREE.TorusGeometry(0.2, 0.008, 4, 24), gm, torsoG, 0, 0.1, 0); w.rotation.x = Math.PI / 2; w.scale.set(f ? 0.82 : 1.0, f ? 0.84 : 0.92, 1);
    for (const g of arms) { const r = mk(new THREE.TorusGeometry(0.085, 0.008, 4, 16), gm, g, 0, -0.48, 0); r.rotation.x = Math.PI / 2; } }
  if (S.chains) for (let i = 0; i < 2; i++) { const ch = mk(CG.hipChain, metal('#e0e0e0', 0.2), torsoG, 0, 0.47 - i * 0.07, tz + 0.01); ch.rotation.z = Math.PI; ch.scale.setScalar(0.8 + i * 0.25); }
  if (S.armor) { const am = mat(S.armor, { metalness: 0.9, roughness: 0.28 }); mk(bx(f ? 0.36 : 0.42, 0.34, 0.07), am, torsoG, 0, 0.5, tz - 0.01); for (const s of [1, -1]) { const p = mk(_SG(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), am, torsoG, armX * s, 0.6, 0); p.scale.set(1, 0.8, 1); }
    mk(G.band, am, torsoG, 0, 0.06, 0).scale.set(f ? 0.82 : 0.97, 0.6, f ? 0.84 : 0.94); if (trim) mk(bx(f ? 0.37 : 0.43, 0.02, 0.075), trim, torsoG, 0, 0.67, tz - 0.01); }
  if (S.tail) { mk(skirt(0.2, 0.46), topM, body, 0, 0.09, 0); for (const s of [1, -1]) { const fn = mk(new THREE.ConeGeometry(0.12, 0.3, 4), topM, body, 0.12 * s, 0.06, -0.38); fn.rotation.x = -1.2; fn.scale.set(1, 1, 0.25); } }
  if (S.shells) for (const s of [1, -1]) { const sh = mk(_SG(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#fce4ec', { metalness: 0.6, roughness: 0.2, emissive: '#b2fff3', emissiveIntensity: 0.2 }), torsoG, 0.07 * s, 0.5, tz - 0.01); sh.rotation.x = Math.PI / 2; sh.scale.set(1, 0.6, 1); }
  if (S.yem) mk(bx(0.22, 0.3, 0.012), mat(S.yem, { roughness: 0.5 }), torsoG, 0, 0.48, tz + 0.008);
  if (S.bolero) { const bm = S.bolero === '@' ? topM : fabric(S.bolero, tierOf('top', o.top), 'none'); const b = mk(G.torso, bm, torsoG, 0, S.high ? 0.58 : 0.5, 0); const ts = c.torso.scale; b.scale.set(ts.x * 1.05, S.high ? 0.42 : 0.62, ts.z * 1.08);
    if (S.studs) { const sm = metal(S.studs, 0.3); for (let i = 0; i < 5; i++) for (const s of [1, -1]) mk(CG.button, sm, torsoG, 0.12 * s, 0.68 - i * 0.07, tz + 0.02); for (const g of arms) for (let i = 0; i < 4; i++) mk(CG.button, sm, g, 0.09, -0.12 - i * 0.1, 0); } }
  if (S.ribbon) { const rm = mat(S.ribbon, { roughness: 0.45 }); const r1 = mk(bx(0.04, 0.26, 0.01), rm, torsoG, 0.05, 0.42, tz + 0.03); r1.rotation.z = 0.1; mk(bx(0.07, 0.04, 0.02), rm, torsoG, 0.04, 0.56, tz + 0.03); }
  if (S.frog) { const fm = metal(S.acc || GD, 0.1); for (let i = 0; i < 3; i++) mk(bx(0.06, 0.012, 0.01), fm, torsoG, 0.07, 0.64 - i * 0.09, tz + 0.012); }
  if (S.crest) for (const s of [1, -1]) mk(_SG(0.022, 8, 6), mat('#fafafa'), torsoG, 0.11 * s, 0.6, tz + 0.006).scale.set(1, 1, 0.3);
  if (S.tunic) mk(skirt(0.34, 0.26), topM, body, 0, 0.73, 0);
  if (S.ruffle) { const base = S.skirt; const cols = S.rainbow ? ['#e53935', '#ffb300', '#43a047', '#1e88e5', '#8e24aa'] : [null, '#111111']; for (let i = 0; i < S.ruffle; i++) { const y = base[2] - base[0] / 2 + 0.05 + i * 0.12, r = base[1] + 0.05 - i * 0.05; const cc = cols[i % cols.length]; mk(skirt(0.09, r), cc ? fabric(cc, tierOf('top', o.top), 'none') : topM, body, 0, y, 0).scale.set(r / 0.2 * 0.2 + 0.8, 1, r / 0.2 * 0.2 + 0.8); } }
  if (S.feathers) { const cols = ['#ff4fd8', '#ffd54f', '#21e6ff', '#69f0ae', '#ff7043', '#7c4dff']; const fg = new THREE.Group(); fg.position.set(0, 0.5, -0.24); torsoG.add(fg); for (let i = 0; i < 11; i++) { const a = -1.35 + i * 0.27; const fe = mk(new THREE.ConeGeometry(0.06, 0.8, 5), mat(cols[i % 6], { emissive: cols[i % 6], emissiveIntensity: 0.35, roughness: 0.4 }), fg, Math.sin(a) * 0.42, Math.cos(a) * 0.42, 0); fe.rotation.z = -a; fe.scale.set(1, 1, 0.3); }
    mk(G.band, metal(GD, 0.2), torsoG, 0, 0.47, 0).scale.set(0.88, 1.1, 0.88); }
  if (S.bare && !S.feathers) mk(G.band, topM, torsoG, 0, 0.47, 0).scale.set(0.86, 1, 0.86);
  if (S.leiTop) { const fm = ['#ff4f8b', '#ffeb3b', '#ffffff', '#ff7043']; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; mk(CG.flower, mat(fm[i % 4]), torsoG, Math.sin(a) * 0.17, 0.68 - Math.max(0, Math.cos(a)) * 0.1, Math.cos(a) * 0.17); } }
  if (S.poncho) { const p = mk(new THREE.ConeGeometry(0.5, 0.62, 4, 1, true), topM, torsoG, 0, 0.46, 0); p.rotation.y = Math.PI / 4; p.scale.set(f ? 0.9 : 1.05, 1, 0.8); }
  if (S.sl === 'wide') for (const g of arms) mk(bx(0.2, 0.34, 0.26), topM, g, 0, -0.36, -0.02);
  if (S.collarGold) { const cg = mk(new THREE.TorusGeometry(0.16, 0.04, 5, 22), trim || metal(GD), torsoG, 0, 0.71, 0); cg.rotation.x = Math.PI / 2; cg.scale.set(1.1, 1.1, 0.5); }
}
function grassSkirt(o, body, botM) { const gm = botM; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; const s = mk(bx(0.05, 0.44, 0.012), gm, body, Math.sin(a) * 0.235, 0.66, Math.cos(a) * 0.235); s.rotation.y = a; s.rotation.x = 0.12; }
  const fl = ['#ff4f8b', '#ffeb3b', '#ffffff']; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mk(CG.flower, mat(fl[i % 3]), body, Math.sin(a) * 0.24, 0.88, Math.cos(a) * 0.24); } }
/** extra hats & glasses (head-local coordinates) */
function extraHeadwear(o, add) {
  const metal = (col, e = 0.2) => mat(col, { metalness: 0.85, roughness: 0.22, emissive: col, emissiveIntensity: e });
  const hc = o.hatC; let g = null;
  switch (o.hat) {
    case 'khandong': { g = new THREE.Group(); const m = fabric(hc || '#1a237e', tierOf('hat', 'khandong'), 'none'); const t = mk(new THREE.TorusGeometry(0.19, 0.055, 6, 18), m, g); t.rotation.x = Math.PI / 2; mk(_CY(0.2, 0.2, 0.05, 14), m, g, 0, 0.04, 0); for (let i = 0; i < 4; i++) { const r = mk(new THREE.TorusGeometry(0.19, 0.012, 4, 18), mat('#000', { roughness: 0.5 }), g, 0, -0.03 + i * 0.025, 0); r.rotation.x = Math.PI / 2; } g.position.y = 0.13; g.rotation.x = -0.12; break; }
    case 'nonquai': { g = new THREE.Group(); const m = mat(hc || '#3e2723', { roughness: 0.8 }); mk(_CY(0.42, 0.44, 0.03, 20), m, g); mk(_CY(0.19, 0.19, 0.06, 14, 1, true), m, g, 0, -0.04, 0); for (const s of [1, -1]) mk(bx(0.02, 0.3, 0.01), mat('#111'), g, 0.15 * s, -0.17, 0.08); const fr = mk(new THREE.TorusGeometry(0.42, 0.01, 3, 24), metal(GD, 0.1), g, 0, -0.02, 0); fr.rotation.x = Math.PI / 2; g.position.y = 0.2; break; }
    case 'halo': { g = new THREE.Group(); const r = mk(new THREE.TorusGeometry(0.17, 0.018, 6, 28), glow('#fff3b0'), g); r.rotation.x = Math.PI / 2; const r2 = mk(new THREE.TorusGeometry(0.17, 0.04, 6, 28), glow('#ffd54f', 0.3), g); r2.rotation.x = Math.PI / 2; g.position.y = 0.36; g.userData.float = true; break; }
    case 'captainhat': { g = new THREE.Group(); const w = mat(hc || '#fafafa', { roughness: 0.4 }); mk(_CY(0.23, 0.2, 0.1, 16), w, g, 0, 0.05, 0); mk(_CY(0.2, 0.2, 0.04, 16), mat('#111'), g, 0, 0.0, 0); const bill = mk(bx(0.28, 0.02, 0.12), mat('#111', { metalness: 0.4, roughness: 0.3 }), g, 0, -0.01, 0.19); bill.rotation.x = 0.2; mk(bx(0.07, 0.05, 0.02), metal(GD, 0.3), g, 0, 0.04, 0.21); mk(bx(0.26, 0.012, 0.012), metal(GD), g, 0, 0.015, 0.2); g.position.y = 0.17; break; }
    case 'sombrero': { g = new THREE.Group(); const m = mat(hc || '#e2c27a', { roughness: 0.85 }); mk(_CY(0.58, 0.6, 0.03, 22), m, g); mk(new THREE.ConeGeometry(0.2, 0.32, 16), m, g, 0, 0.16, 0); const b = mk(new THREE.TorusGeometry(0.57, 0.025, 4, 26), mat('#c62828'), g, 0, 0.02, 0); b.rotation.x = Math.PI / 2; mk(G.band, mat('#2e7d32'), g, 0, 0.05, 0).scale.set(0.82, 0.5, 0.82); g.position.y = 0.17; break; }
    case 'peruhat': { g = new THREE.Group(); const m = fabric(hc || '#c62828', 't', 'andes'); mk(_SG(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), m, g); for (const s of [1, -1]) mk(bx(0.07, 0.18, 0.04), m, g, 0.2 * s, -0.1, 0); mk(_SG(0.04, 6, 4), mat('#ffb300'), g, 0, 0.22, 0); g.position.y = 0.04; break; }
    case 'feathers': { g = new THREE.Group(); const cols = ['#ff4fd8', '#ffd54f', '#21e6ff', '#69f0ae', '#ff7043']; mk(G.band, metal(GD, 0.3), g).scale.set(0.95, 0.45, 0.95); for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.275; const fe = mk(new THREE.ConeGeometry(0.04, 0.5, 5), mat(cols[i % 5], { emissive: cols[i % 5], emissiveIntensity: 0.35 }), g, Math.sin(a) * 0.2, 0.26 + Math.cos(a) * 0.1, -0.04); fe.rotation.z = -a * 0.7; fe.scale.set(1, 1, 0.3); } mk(CG.pendant, glow('#ff4fd8'), g, 0, 0.03, 0.22); g.position.y = 0.1; break; }
    case 'kanzashi': { g = new THREE.Group(); const fm = ['#ff8fb8', '#ffffff', '#ffd54f']; for (let i = 0; i < 3; i++) mk(CG.flower, mat(fm[i]), g, 0.15, 0.1 + i * 0.03, -0.05 - i * 0.04).scale.setScalar(1.4); mk(bx(0.012, 0.012, 0.22), metal(GD), g, 0.12, 0.1, -0.05); break; }
  }
  if (g) add('hat', g);
  if (o.glasses && o.glassesStyle === 'visor') { const gg = new THREE.Group(); mk(bx(0.42, 0.075, 0.05), mat('#0a0a12', { metalness: 0.7, roughness: 0.1 }), gg); mk(bx(0.4, 0.016, 0.01), glow(o.glassesC && o.glassesC !== '#0c0c0c' ? o.glassesC : '#ff3fd8'), gg, 0, 0.01, 0.027); mk(bx(0.4, 0.008, 0.01), glow('#21e6ff'), gg, 0, -0.018, 0.027); gg.position.set(0, 0.035, 0.19); add('glasses', gg); return true; }
  return false;
}
