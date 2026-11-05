// ✂️ Tiệm Tóc: tiệm làm tóc nhỏ cạnh quảng trường – đổi kiểu tóc / màu tóc / highlight / ombre MIỄN PHÍ.
import * as THREE from 'three';
import { createAvatar, animateAvatar, normLook, textSprite, HAIR_STYLES, HAIRS } from './avatar.js';
import { height } from './world.js';
const G = window.__game, S = G.style, W = G.W, scene = G.scene;
const V = { x: 17, z: 25, w: 8, d: 7 }, HW = V.w / 2, HD = V.d / 2, WH = 3.3;
const Y = height(V.x, V.z); const B = new THREE.Group(); B.position.set(V.x, Y, V.z); B.rotation.y = 0; scene.add(B);
const M = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...x });
const bx = (w, h, d, m, x, y, z, p = B) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; p.add(o); return o; };
const col = (x, z, w, d) => W.colliders.push({ minX: V.x + x - w / 2, maxX: V.x + x + w / 2, minZ: V.z + z - d / 2, maxZ: V.z + z + d / 2, on: true, tag: 'salon' });
const wallM = M('#e8f7f4'), trimM = M('#c9a227', { metalness: 0.75, roughness: 0.28 }), darkM = M('#263238'), chromeM = M('#dfe6ea', { metalness: 0.9, roughness: 0.18 });
const glassM = new THREE.MeshStandardMaterial({ color: '#d8f3ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false });
// floor: checkerboard tiles
{ const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#1d1d24' : '#f4f1ea'; x.fillRect(i * 32, j * 32, 32, 32); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.75); bx(V.w, 0.12, V.d, M('#ffffff', { map: t, roughness: 0.3 }), 0, 0.06, 0); }
bx(V.w, WH, 0.2, wallM, 0, WH / 2, HD); col(0, HD, V.w, 0.3);
for (const s of [-1, 1]) { bx(0.2, WH, V.d, wallM, s * HW, WH / 2, 0); col(s * HW, 0, 0.3, V.d); }
bx(V.w + 0.5, 0.22, V.d + 0.5, M('#00897b'), 0, WH + 0.11, 0);
// outside murals so the back (beach side) and side walls are never a blank white slab
function mural(w, h, big) { const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const x = c.getContext('2d'), H = c.height;
  const gr = x.createLinearGradient(0, 0, 1024, H); gr.addColorStop(0, '#00897b'); gr.addColorStop(0.55, '#26c6da'); gr.addColorStop(1, '#f48fb1'); x.fillStyle = gr; x.fillRect(0, 0, 1024, H);
  x.globalAlpha = 0.18; x.fillStyle = '#ffffff'; for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(Math.random() * 1024, Math.random() * H, 30 + Math.random() * 90, 0, 7); x.fill(); } x.globalAlpha = 1;
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 6; for (let k = 0; k < 3; k++) { x.beginPath(); for (let i = 0; i <= 1024; i += 16) x.lineTo(i, H * (0.82 + k * 0.06) + Math.sin(i / 60 + k) * 10); x.stroke(); }
  // stylised hair silhouettes
  const heads = big ? 5 : 3; for (let i = 0; i < heads; i++) { const cx = 1024 * (i + 0.5) / heads, cy = H * (big ? 0.62 : 0.5), r = H * 0.11;
    x.fillStyle = '#ffe0c2'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.fillStyle = ['#3e2723', '#ff4fa8', '#ffd54f', '#7e57c2', '#212121'][i % 5]; x.beginPath();
    if (i % 2) { x.ellipse(cx, cy - r * 0.35, r * 1.25, r * 0.95, 0, Math.PI, 0); x.fillRect(cx - r * 1.25, cy - r * 0.4, r * 0.45, r * 2.1); x.fillRect(cx + r * 0.8, cy - r * 0.4, r * 0.45, r * 2.1); }
    else { x.ellipse(cx, cy - r * 0.45, r * 1.1, r * 0.8, 0, Math.PI, 0); for (let k = -2; k <= 2; k++) x.moveTo(cx + k * r * 0.4, cy - r * 1.1), x.lineTo(cx + k * r * 0.4 + r * 0.3, cy - r * 1.7), x.lineTo(cx + k * r * 0.4 + r * 0.45, cy - r * 1.0); }
    x.fill(); }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 12; x.fillStyle = '#ffffff';
  x.font = `900 ${big ? 120 : 96}px system-ui,sans-serif`; x.fillText('✂️ TIỆM TÓC', 512, H * (big ? 0.2 : 0.18));
  x.font = `800 ${big ? 44 : 46}px system-ui,sans-serif`; x.fillStyle = '#fff59d'; x.fillText(big ? 'Đổi kiểu · nhuộm màu · ombre — MIỄN PHÍ' : 'MIỄN PHÍ', 512, H * (big ? 0.36 : 0.82));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); }
{ const back = mural(V.w - 0.4, WH - 0.35, true); back.position.set(0, WH / 2 + 0.05, HD + 0.11); B.add(back);
  for (const s of [-1, 1]) { const m = mural(V.d - 0.4, WH - 0.35, false); m.position.set(s * (HW + 0.11), WH / 2 + 0.05, 0); m.rotation.y = s * Math.PI / 2; B.add(m); } }
for (const s of [-1, 1]) { bx(2.6, WH - 0.3, 0.06, glassM, s * (HW - 1.3), (WH - 0.3) / 2 + 0.1, -HD); col(s * (HW - 1.3), -HD, 2.6, 0.25); bx(0.1, WH, 0.1, trimM, s * 1.4, WH / 2, -HD); bx(0.1, WH, 0.1, trimM, s * HW, WH / 2, -HD); }
for (let i = 0; i < 8; i++) { const a = bx(V.w / 8, 0.05, 1.2, M(i % 2 ? '#ffffff' : '#26a69a'), -HW + V.w / 16 + i * V.w / 8, WH - 0.3, -HD - 0.6); a.rotation.x = 0.28; }
// barber pole (spinning stripes)
const pc = document.createElement('canvas'); pc.width = 64; pc.height = 256; { const x = pc.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 256); x.lineWidth = 18; for (let i = -4; i < 12; i++) { x.strokeStyle = i % 2 ? '#e53935' : '#1e88e5'; x.beginPath(); x.moveTo(-10, i * 32); x.lineTo(74, i * 32 + 64); x.stroke(); } }
const poleT = new THREE.CanvasTexture(pc); poleT.colorSpace = THREE.SRGBColorSpace; poleT.wrapT = THREE.RepeatWrapping;
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 20), new THREE.MeshStandardMaterial({ map: poleT, roughness: 0.2, emissive: '#ffffff', emissiveMap: poleT, emissiveIntensity: 0.35 })); pole.position.set(HW - 0.2, 1.6, -HD - 0.25); B.add(pole);
for (const y of [1.02, 2.18]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), chromeM); c.position.set(HW - 0.2, y, -HD - 0.25); B.add(c); }
// sign
{ const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#063b36'; x.fillRect(0, 0, 512, 96); x.font = 'bold 56px system-ui,sans-serif'; x.textAlign = 'center'; x.shadowColor = '#4dffe0'; x.shadowBlur = 18; x.fillStyle = '#d9fff8'; x.fillText('✂️ TIỆM TÓC', 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.83), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); sg.position.set(0, WH + 0.62, -HD - 0.12); sg.rotation.y = Math.PI; B.add(sg); bx(4.6, 0.95, 0.08, trimM, 0, WH + 0.62, -HD - 0.06); }
const lamp = new THREE.PointLight('#fff4e0', 5, 10, 1.6); lamp.position.set(0, WH - 0.4, 0); B.add(lamp);
// 3 stations: mirror with bulbs, barber chair, trolley
const bulbM = new THREE.MeshStandardMaterial({ color: '#fff8e1', emissive: '#ffe9a8', emissiveIntensity: 1.6 });
const mirM = new THREE.MeshStandardMaterial({ color: '#cfe3ea', metalness: 1, roughness: 0.04 });
const chairs = [];
for (let i = -1; i <= 1; i++) { const x0 = i * 2.4, z0 = HD - 0.14;
  bx(1.1, 1.3, 0.04, mirM, x0, 1.75, z0); bx(1.24, 0.06, 0.08, trimM, x0, 2.43, z0 - 0.02); bx(1.24, 0.06, 0.08, trimM, x0, 1.07, z0 - 0.02);
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), bulbM); b.position.set(x0 + s * 0.64, 1.2 + k * 0.27, z0 - 0.05); B.add(b); }
  bx(1.3, 0.08, 0.4, M('#fafafa', { roughness: 0.2 }), x0, 0.95, z0 - 0.2); // counter
  const ch = new THREE.Group(); ch.position.set(x0, 0, z0 - 1.25); B.add(ch); chairs.push(ch);
  bx(0.06, 0.4, 0.06, chromeM, 0, 0.3, 0, ch); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 20), chromeM); base.position.y = 0.15; ch.add(base);
  const leather = M('#b71c1c', { roughness: 0.35 }); bx(0.56, 0.12, 0.52, leather, 0, 0.55, 0, ch); bx(0.56, 0.7, 0.1, leather, 0, 0.95, 0.24, ch); bx(0.3, 0.18, 0.08, leather, 0, 1.42, 0.25, ch);
  for (const s of [-1, 1]) bx(0.08, 0.06, 0.5, chromeM, s * 0.3, 0.75, 0, ch);
  bx(0.4, 0.04, 0.12, chromeM, 0, 0.22, -0.34, ch);
  col(x0, z0 - 0.2, 1.3, 0.5); }
// shampoo shelf + plants
for (const s of [-1, 1]) { bx(0.3, 1.6, 1.6, M('#5d4037'), s * (HW - 0.3), 0.8, 0.6); col(s * (HW - 0.3), 0.6, 0.4, 1.6);
  for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), M(['#ff80ab', '#80deea', '#fff59d', '#b39ddb', '#a5d6a7', '#ffab91'][k], { roughness: 0.2 })); b.position.set(s * (HW - 0.3), 1.72, 0.05 + k * 0.22); B.add(b); } }
// hair-model busts on the window sill (rotating, showing styles)
const busts = []; let bustT = 0, bustI = 0;
function bustLook(i) { const g = i % 2 ? 'f' : 'm', L = HAIR_STYLES[g]; const hs = L[Math.floor(i / 2) % L.length]; return normLook({ ...S.presetLook(g, 'bien'), gender: g, hairStyle: hs, hair: HAIRS[(i * 3) % HAIRS.length], hat: null, glasses: false }); }
for (const s of [-1, 1]) { const holder = new THREE.Group(); holder.position.set(s * (HW - 1.3), 0, -HD + 0.6); B.add(holder); bx(1, 0.8, 0.5, M('#f5f5f5'), 0, 0.4, 0, holder); col(s * (HW - 1.3), -HD + 0.6, 1, 0.5); busts.push({ holder, av: null, yaw: s }); }
function setBust(b, i) { if (b.av) b.holder.remove(b.av.root); b.av = createAvatar(bustLook(i)); b.av.root.position.y = 0.8; b.av.root.scale.setScalar(0.9); b.holder.add(b.av.root); }
busts.forEach((b, k) => setBust(b, k)); bustI = 2;
const lbl = textSprite('✂️ Đổi tóc miễn phí', { size: 34, h: 0.36 }); lbl.position.set(0, 2.75, 0.2); B.add(lbl);
W.venues.salon = { id: 'salon', name: 'Tiệm Tóc', icon: '✂️', x: V.x, z: V.z, counter: { x: V.x, z: V.z + 0.5 }, entry: { x: V.x, z: V.z - HD - 2 }, radius: 4.8 };
W.salonV = V;
export function openSalon() { S.open(S.baseLook(), 'custom'); G.toast('✂️ Tiệm Tóc: mọi kiểu tóc, màu tóc, highlight & ombre đều MIỄN PHÍ!'); setTimeout(() => { const el = [...document.querySelectorAll('#wardrobe *')].find(e => /Kiểu tóc/.test(e.textContent) && e.children.length < 3); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' }); }, 120); }
G.salon = { open: openSalon, V };
G.onFrame.push((dt, t) => { const p = G.player, d = Math.hypot(p.x - V.x, p.z - V.z); poleT.offset.y = (poleT.offset.y - dt * 0.35) % 1; if (d > 40) return;
  for (const b of busts) if (b.av) { b.yaw += dt * 0.6; b.av.root.rotation.y = b.yaw; animateAvatar(b.av, dt, t); }
  chairs.forEach((c, i) => { c.rotation.y = Math.sin(t * 0.3 + i) * 0.25; });
  bustT += dt; if (bustT > 4 && d < 25) { bustT = 0; setBust(busts[bustI % 2], bustI); bustI++; } });
(G.ctxExtra = G.ctxExtra || []).push((btns, px, pz) => { if (Math.abs(px - V.x) > HW + 2.5 || Math.abs(pz - V.z) > HD + 3) return; btns.unshift(['✂️ Vào Tiệm Tóc (miễn phí)', () => openSalon()]); });
