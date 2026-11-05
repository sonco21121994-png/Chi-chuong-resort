// 🛍️ Shop Thời Trang: tòa nhà trên đảo (ma-nơ-canh + gương thử đồ) và giao diện cửa hàng (bộ đồ / món lẻ, lọc, thử trước khi mua).
// Mọi giao dịch dùng Xu ẢO trong game – không nạp tiền thật, không quy đổi ra tiền.
import * as THREE from 'three';
import { createAvatar, animateAvatar, normLook, FULL_TOPS, BOTTOMS, TOPS, textSprite } from './avatar.js';
import { height } from './world.js';
import { ITEMS, ITEM, SETS, RAR, BADGE, SLOTS, CATS, itemPatch } from './catalog.js';
const G = window.__game, st = G.st, S = G.style, $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));
const W = G.W, scene = G.scene, V = W.boutiqueV || { x: -12, z: 23, w: 10, d: 8 };
const setCost = (s) => { const un = s.items.filter(k => !S.owned(k)); return Math.round(un.reduce((a, k) => a + ITEM[k].price, 0) * 0.8); };
// 'Giới hạn' items: rolling weekly window that ends Sunday 23:59 (local time) – then the limited rotation refreshes
export const limitedEnd = () => { const d = new Date(); d.setHours(23, 59, 59, 0); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return d.getTime(); };
const fmtLeft = () => { let t = Math.max(0, limitedEnd() - Date.now()) / 1000 | 0; const dd = t / 86400 | 0; t %= 86400; const p = (n) => String(n).padStart(2, '0'); return `${dd ? dd + 'n ' : ''}${p(t / 3600 | 0)}:${p((t % 3600) / 60 | 0)}:${p(t % 60)}`; };
const setOwned = (s) => s.items.every(k => S.owned(k));
export const COUNTS = { sets: SETS.length, setsM: SETS.filter(s => s.gender === 'm').length, setsF: SETS.filter(s => s.gender === 'f').length, items: ITEMS.length, variants: ITEMS.reduce((a, i) => a + i.colors.length, 0), free: ITEMS.filter(i => !i.price).length };

// ================= building =================
const Y = height(V.x, V.z); const B = new THREE.Group(); B.position.set(V.x, Y, V.z); scene.add(B);
const M = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...x });
const bx = (w, h, d, m, x, y, z, p = B) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
const col = (x, z, w, d) => W.colliders.push({ minX: V.x + x - w / 2, maxX: V.x + x + w / 2, minZ: V.z + z - d / 2, maxZ: V.z + z + d / 2, on: true, tag: 'boutique' });
const HW = V.w / 2, HD = V.d / 2, WH = 3.6;
const wallM = M('#fbe9f2'), trimM = M('#d4af37', { metalness: 0.7, roughness: 0.3 }), glassM = new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false });
bx(V.w, 0.12, V.d, M('#f3e5d8', { roughness: 0.35 }), 0, 0.06, 0); // floor
for (let i = -2; i <= 2; i++) bx(V.w - 0.4, 0.005, 0.04, M('#e0c9b5'), 0, 0.125, i * 1.5);
bx(V.w, WH, 0.2, wallM, 0, WH / 2, HD); col(0, HD, V.w, 0.3);
for (const s of [-1, 1]) { bx(0.2, WH, V.d, wallM, s * HW, WH / 2, 0); col(s * HW, 0, 0.3, V.d); }
// outside murals (back + sides) – fashion poster instead of a blank white wall
function mural(w, h, big) { const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const x = c.getContext('2d'), H = c.height;
  const gr = x.createLinearGradient(0, 0, 1024, H); gr.addColorStop(0, '#3a0f5c'); gr.addColorStop(0.5, '#c2185b'); gr.addColorStop(1, '#ff8a65'); x.fillStyle = gr; x.fillRect(0, 0, 1024, H);
  x.strokeStyle = 'rgba(255,215,120,.5)'; x.lineWidth = 5; x.strokeRect(18, 18, 1024 - 36, H - 36);
  const n = big ? 5 : 3, cols = ['#ffd54f', '#80deea', '#ffffff', '#b39ddb', '#a5d6a7'];
  for (let i = 0; i < n; i++) { const cx = 1024 * (i + 0.5) / n, top = H * (big ? 0.44 : 0.36), hh = H * (big ? 0.42 : 0.4); x.fillStyle = cols[i % 5];
    x.strokeStyle = '#ffe082'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - 26, top + 6); x.quadraticCurveTo(cx, top - 26, cx + 26, top + 6); x.stroke(); // hanger
    x.beginPath(); if (i % 2) { x.moveTo(cx - 30, top + 6); x.lineTo(cx + 30, top + 6); x.lineTo(cx + 22, top + hh * 0.4); x.lineTo(cx + 70, top + hh); x.lineTo(cx - 70, top + hh); x.lineTo(cx - 22, top + hh * 0.4); }
    else { x.moveTo(cx - 60, top + 6); x.lineTo(cx + 60, top + 6); x.lineTo(cx + 85, top + 40); x.lineTo(cx + 60, top + 55); x.lineTo(cx + 50, top + hh * 0.85); x.lineTo(cx - 50, top + hh * 0.85); x.lineTo(cx - 60, top + 55); x.lineTo(cx - 85, top + 40); }
    x.closePath(); x.fill(); }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 12; x.fillStyle = '#fff';
  x.font = `900 ${big ? 104 : 84}px system-ui,sans-serif`; x.fillText('👗 THỜI TRANG', 512, H * (big ? 0.2 : 0.17));
  x.font = `800 ${big ? 46 : 40}px system-ui,sans-serif`; x.fillStyle = '#ffe082'; x.fillText(big ? 'Bộ sưu tập mới · Cao Cấp · Truyền Thống' : 'Bộ sưu tập mới', 512, H * (big ? 0.34 : 0.88));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); }
{ const back = mural(V.w - 0.4, WH - 0.4, true); back.position.set(0, WH / 2 + 0.05, HD + 0.11); B.add(back);
  for (const s of [-1, 1]) { const m = mural(V.d - 0.4, WH - 0.4, false); m.position.set(s * (HW + 0.11), WH / 2 + 0.05, 0); m.rotation.y = s * Math.PI / 2; B.add(m); } }
bx(V.w + 0.6, 0.25, V.d + 0.6, M('#3a1350'), 0, WH + 0.12, 0); bx(V.w + 0.7, 0.08, 0.08, trimM, 0, WH, -HD - 0.3);
for (const s of [-1, 1]) { bx(3, WH - 0.3, 0.06, glassM, s * (HW - 1.5), (WH - 0.3) / 2 + 0.1, -HD); col(s * (HW - 1.5), -HD, 3, 0.25); bx(0.1, WH, 0.1, trimM, s * 2, WH / 2, -HD); bx(0.1, WH, 0.1, trimM, s * HW, WH / 2, -HD); }
// awning stripes
for (let i = 0; i < 10; i++) { const a = bx(V.w / 10, 0.05, 1.3, M(i % 2 ? '#ffffff' : '#ff4fa3'), -HW + V.w / 20 + i * V.w / 10, WH - 0.35, -HD - 0.65); a.rotation.x = 0.28; }
{ const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#2a0f45'; x.fillRect(0, 0, 512, 96); x.font = 'bold 54px system-ui,sans-serif'; x.textAlign = 'center'; x.shadowColor = '#ff4fd8'; x.shadowBlur = 18; x.fillStyle = '#ffd6f5'; x.fillText('🛍️ SHOP THỜI TRANG', 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.98), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); sg.position.set(0, WH + 0.75, -HD - 0.12); sg.rotation.y = Math.PI; B.add(sg); bx(5.4, 1.1, 0.08, trimM, 0, WH + 0.75, -HD - 0.06); }
const lampL = new THREE.PointLight('#ffd6f5', 6, 12, 1.6); lampL.position.set(0, WH - 0.5, 0); B.add(lampL);
// rails with hanging clothes on the back wall
const railC = ['#ff4fa3', '#29b6f6', '#ffd54f', '#66bb6a', '#ab47bc', '#fafafa', '#e53935', '#26a69a'];
for (const s of [-1, 1]) { bx(2.6, 0.04, 0.04, trimM, s * 3.2, 2.2, HD - 0.45); for (let i = 0; i < 8; i++) { const sh = bx(0.26, 0.7, 0.05, M(railC[(i + (s > 0 ? 3 : 0)) % 8]), s * 3.2 - 1.1 + i * 0.31, 1.82, HD - 0.45); sh.rotation.y = Math.PI / 2 * 0.8; } }
// mirror (live reflection of your try-on look)
const mc = document.createElement('canvas'); mc.width = 240; mc.height = 300; const mtex = new THREE.CanvasTexture(mc); mtex.colorSpace = THREE.SRGBColorSpace;
const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.88), new THREE.MeshBasicMaterial({ map: mtex, toneMapped: false })); mirror.position.set(0, 1.45, HD - 0.13); mirror.rotation.y = Math.PI; B.add(mirror);
bx(1.68, 2.06, 0.06, trimM, 0, 1.45, HD - 0.09);
const mLbl = textSprite('🪞 Gương thử đồ', { size: 34, h: 0.36 }); mLbl.position.set(0, 2.7, HD - 0.3); B.add(mLbl);
const MIR = { x: V.x, z: V.z + HD - 1.4 };
let mirLook = null, mirT = 0; function drawMirror(L) { const src = S.renderLook(normLook(L), Math.PI + 0.25 + Math.sin(G.now() * 0.6) * 0.3, G.now()); const x = mc.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#dfe9f3'); g.addColorStop(1, '#b8c6d6'); x.fillStyle = g; x.fillRect(0, 0, 240, 300); x.drawImage(src, 0, 0, 240, 300); mtex.needsUpdate = true; }
// mannequins
const FEAT = ['m_hoangtu', 'f_congchua', 'm_rappervang', 'f_clubqueen', 'm_aodainam', 'f_aodaitrang', 'm_tuxedo', 'f_bikininhietdoi'];
const POS = [[-HW + 1, -HD + 1.2], [HW - 1, -HD + 1.2], [-HW + 1, -0.2], [HW - 1, -0.2], [-HW + 1, 1.6], [HW - 1, 1.6], [-1.7, HD - 1.1], [1.7, HD - 1.1]];
const mannequins = [];
FEAT.forEach((uid, i) => { const s = SETS.find(x => x.uid === uid); if (!s) return; const [px, pz] = POS[i]; const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.28, 18), trimM); ped.position.set(px, 0.26, pz); B.add(ped);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.02, 4, 24), new THREE.MeshBasicMaterial({ color: '#ff4fd8', toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.set(px, 0.41, pz); B.add(ring);
  const av = createAvatar(normLook(s.look)); av.root.position.set(px, 0.4, pz); av.anim = 'idle'; av.phase = i; B.add(av.root); col(px, pz, 0.9, 0.9);
  const lb = textSprite(`${s.icon} ${s.name}`, { size: 28, h: 0.26 }); lb.position.set(px, 2.45, pz); B.add(lb); mannequins.push({ av, s, yaw: i * 0.8 }); });
W.venues.boutique = { id: 'boutique', name: 'Shop Thời Trang', icon: '🛍️', x: V.x, z: V.z, counter: { x: V.x, z: V.z + 1 }, entry: { x: V.x, z: V.z - HD - 2 }, radius: 5.5 };
G.onFrame.push((dt, t) => { const p = G.player, d = Math.hypot(p.x - V.x, p.z - V.z); if (d > 40) return;
  for (const m of mannequins) { m.yaw += dt * 0.5; m.av.root.rotation.y = m.yaw; animateAvatar(m.av, dt, t); }
  mirT -= dt; if ((d < 9 || !mirLook) && mirT <= 0) { mirT = 0.12; mirLook = open_ && tryLook ? tryLook : S.baseLook(); drawMirror(mirLook); } });
(G.ctxExtra = G.ctxExtra || []).push((btns, px, pz) => { if (Math.abs(px - V.x) > HW + 2.5 || Math.abs(pz - V.z) > HD + 3) return;
  if (Math.hypot(px - MIR.x, pz - MIR.z) < 2.4) btns.unshift(['🪞 Gương thử đồ', () => S.open(S.baseLook(), 'custom')]);
  btns.unshift(['🛍️ Vào Shop Thời Trang', () => openBoutique()]); });

// ================= shop UI =================
const css = document.createElement('style'); css.textContent = `
#boutique .card{width:min(1040px,100%);max-height:95vh;display:flex;flex-direction:column}
.btTop{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.btTop h2{margin:0;flex:1;font-size:20px}
.btCount{font-size:12px;opacity:.85;background:#2a1145;border:1px solid #5a3a85;border-radius:10px;padding:3px 8px}
.btBody{display:flex;gap:12px;min-height:0;flex:1;margin-top:6px}
.btLeft{flex:0 0 250px;display:flex;flex-direction:column;align-items:center;gap:6px}
.btLeft canvas{width:240px;height:300px;border-radius:14px;background:radial-gradient(circle at 50% 70%,#4a2370,#140a24);border:1px solid #5a3a85}
.btRight{flex:1;display:flex;flex-direction:column;min-height:0}
.btFil{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px}.btFil button{padding:4px 8px;border-radius:12px;border:1px solid #5a3a85;background:#1d1033;color:#fff;cursor:pointer;font-size:11.5px}
.btFil button.sel{background:#6a1f78;border-color:#ff4fd8}.btFil select{background:#1d1033;color:#fff;border:1px solid #5a3a85;border-radius:10px;font-size:12px;padding:3px}
.btGrid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px;padding:2px 4px 4px 0;max-height:58vh}
.btCard{border:2px solid #5a3a85;border-radius:11px;background:#1d1033;color:#fff;cursor:pointer;padding:4px;text-align:center;font-size:11.5px;position:relative;display:flex;flex-direction:column}
.btCard img,.btCard .ph{width:100%;height:118px;object-fit:cover;border-radius:8px;background:radial-gradient(circle at 50% 70%,#4a2370,#1a0d2e)}
.btCard.sel{box-shadow:0 0 12px rgba(255,79,216,.8)}
.btCard .bd{position:absolute;top:4px;left:4px;font-size:10px;background:rgba(0,0,0,.7);border-radius:7px;padding:1px 4px}
.btCard .rr{position:absolute;top:4px;right:4px;font-size:9.5px;border-radius:7px;padding:1px 4px;color:#111;font-weight:700}
.btCard .nm{font-weight:700;margin:3px 0 1px;min-height:28px}.btCard .pr{color:#ffe39a}.btCard .pr.ok{color:#8ef59a}
.btCard .sws{display:flex;justify-content:center;gap:2px;margin-top:2px}.btCard .sws i{width:9px;height:9px;border-radius:50%;display:inline-block;border:1px solid #fff4}
.btAct{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.btAct button{padding:7px 10px;border-radius:10px;border:1px solid #ff4fd8;background:#3a1350;color:#fff;cursor:pointer;font-size:12.5px}
.btAct button.buy{background:linear-gradient(90deg,#ff4fd8,#ffb04f);color:#1a0d2e;font-weight:800;border:none}
.btSw{display:flex;gap:4px;flex-wrap:wrap;justify-content:center}.btSw span{width:20px;height:20px;border-radius:50%;cursor:pointer;border:2px solid #fff3}.btSw span.sel{border-color:#ff4fd8;box-shadow:0 0 6px #ff4fd8}
/* premium presentation: rarity frames + shine, podium spotlight, limited countdown, bundle tag */
.btCard{overflow:hidden}.btCard.r-h{background:linear-gradient(160deg,#16294a,#1d1033 60%);box-shadow:inset 0 0 0 1px #42a5f555}
.btCard.r-s{background:linear-gradient(160deg,#3a1458,#1d1033 55%,#2c1340);box-shadow:0 0 8px #ab47bc88,inset 0 0 0 1px #e1bee755}
.btCard.r-l{border-color:#ffb300!important;background:linear-gradient(160deg,#4a3200,#1d1033 50%,#3b2a00);box-shadow:0 0 12px #ffb300aa,inset 0 0 0 1px #fff3b0aa;animation:btGlow 2.4s ease-in-out infinite}
.btCard.r-s::after,.btCard.r-l::after,.btCard.r-h::after{content:"";position:absolute;inset:-40% auto -40% -60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.38),transparent);transform:skewX(-18deg);animation:btShine 3.2s ease-in-out infinite;pointer-events:none}
.btCard.r-h::after{animation-duration:5s;opacity:.5}.btCard.r-l::after{background:linear-gradient(100deg,transparent,rgba(255,236,160,.6),transparent);animation-duration:2.4s}
.btCard.r-l .nm{background:linear-gradient(90deg,#ffe08a,#fff,#ffb300);-webkit-background-clip:text;background-clip:text;color:transparent}
@keyframes btShine{0%{left:-60%}55%,100%{left:130%}}@keyframes btGlow{50%{box-shadow:0 0 20px #ffd54f,inset 0 0 0 1px #fff3b0}}
.btCard .cd{font-size:10px;color:#ff8a80;font-weight:700}.btCard .off{position:absolute;top:22px;left:4px;font-size:10px;font-weight:800;background:#e53935;color:#fff;border-radius:7px;padding:1px 5px}
.btCard .pr s{opacity:.55;font-size:10px;margin-right:3px;color:#ccc}
.btPod{position:relative;width:240px;height:300px;border-radius:14px;overflow:hidden;background:radial-gradient(ellipse 60% 85% at 50% 0%,rgba(255,240,200,.35),transparent 70%),radial-gradient(circle at 50% 70%,#4a2370,#140a24)}
.btPod canvas{background:transparent!important;border:none!important;position:relative;z-index:1}
.btPod::before{content:"";position:absolute;left:50%;top:-10px;width:170px;height:320px;transform:translateX(-50%);background:conic-gradient(from 165deg at 50% 0%,transparent 0deg,rgba(255,245,210,.22) 15deg,transparent 30deg);z-index:0;animation:btSpot 4s ease-in-out infinite}
.btPod::after{content:"";position:absolute;left:50%;bottom:6px;width:180px;height:34px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse at 50% 35%,#fff7d6 0%,#d4af37 22%,#5a3a85 60%,#1d1033 100%);box-shadow:0 0 18px #d4af3788;z-index:0}
.btPod.t-l{box-shadow:0 0 18px #ffb300}.btPod.t-s{box-shadow:0 0 12px #ab47bc}@keyframes btSpot{50%{opacity:.6}}
.btLim{font-size:12px;color:#ff8a80;font-weight:800;text-align:center}
@media (max-width:700px){.btPod{width:150px;height:188px}.btBody{flex-direction:column}.btLeft{flex:0 0 auto}.btLeft canvas{width:150px;height:188px}.btGrid{max-height:38vh}}
`; document.head.appendChild(css);
const el = document.createElement('div'); el.id = 'boutique'; el.className = 'overlay hidden'; el.style.zIndex = 41;
el.innerHTML = `<div class="card"><div class="btTop"><h2>🛍️ Shop Thời Trang Đảo Ngọc</h2><span class="btCount" id="btCount"></span><span class="btCount">🪙 <b id="btXu"></b> Xu ảo</span><button class="styBtn" id="btClose" style="margin:0">✖</button></div>
 <div class="btBody"><div class="btLeft"><div class="btPod" id="btPod"><canvas id="btPrev" width="240" height="300"></canvas></div><div class="btLim" id="btLim"></div><div id="btName" style="font-weight:800;text-align:center"></div><div id="btInfo" class="tiny" style="text-align:center"></div><div class="btSw" id="btSw"></div><div class="btAct" id="btAct"></div>
 <div class="tiny" style="text-align:center;opacity:.7">Xem thử miễn phí trên avatar của bạn trước khi mua. Xu ảo không quy đổi tiền thật.</div></div>
 <div class="btRight"><div class="btFil" id="btTabs"></div><div class="btFil" id="btFil1"></div><div class="btFil" id="btFil2"></div><div class="btGrid" id="btGrid"></div></div></div></div>`;
document.body.appendChild(el);
let open_ = false, tab = 'sets', F = { g: null, slot: 'all', rar: 'all', cat: 'all', season: 'all', badge: 'all', mine: false }, selSet = null, selItem = null, selColor = null, tryLook = null;
$('btCount').textContent = `${COUNTS.sets} bộ (${COUNTS.setsM} nam · ${COUNTS.setsF} nữ) · ${COUNTS.items} món · ${COUNTS.variants} biến thể màu`;
const chip = (k, v, label, cur) => `<button data-f="${k}" data-v="${v}" class="${String(cur) === String(v) ? 'sel' : ''}">${label}</button>`;
const BADGEH = (b) => b ? `<span class="bd">${BADGE[b]}</span>` : '';
const RARH = (r) => `<span class="rr" style="background:${RAR[r].c}">${RAR[r].n}</span>`;
// lazy thumbnails
const io = new IntersectionObserver((ents) => { for (const e of ents) if (e.isIntersecting) { const d = e.target; io.unobserve(d); const L = JSON.parse(d.dataset.look); requestAnimationFrame(() => { const im = new Image(); im.src = S.thumb(normLook(L)); d.replaceWith(im); }); } }, { root: null, rootMargin: '120px' });
const NEUTRAL = (g) => { const b = S.baseLook(); return { gender: g, skin: b.gender === g ? b.skin : '#eac096', hair: '#2c1b12', hairStyle: g === 'f' ? 'long' : 'short', eye: '#3b2416', ...(g === 'f' ? { lips: '#d2506e' } : {}), top: 'tee', topC: '#eeeeee', bottom: g === 'f' ? 'skirt' : 'shorts', bottomC: '#37474f', shoes: 'sneakers', shoesC: '#fafafa' }; };
function itemLook(it, color, neutral) { const L = neutral ? NEUTRAL(gNow()) : clone(S.baseLook()); if (!neutral && L.gender !== gNow()) Object.assign(L, NEUTRAL(gNow())); const g = L.gender; Object.assign(L, itemPatch(it, color || it.colors[0]));
  if (it.slot === 'top' && FULL_TOPS.has(it.kind)) delete L.bottom; else if (it.slot === 'top' && !L.bottom) L.bottom = BOTTOMS[g][0];
  if (it.slot === 'bottom' && FULL_TOPS.has(L.top)) L.top = g === 'f' ? 'blouse' : 'tee'; if (it.slot === 'top' && !TOPS[g].includes(it.kind)) L.top = it.kind; return L; }
const gNow = () => F.g || st.gender || 'm';
function listSets() { const g = gNow(); return SETS.filter(s => s.gender === g && (F.rar === 'all' || s.rarity === F.rar) && (F.cat === 'all' || s.cat === F.cat) && (F.season === 'all' || s.season === F.season) && (F.badge === 'all' || s.badge === F.badge) && (!F.mine || setOwned(s))); }
function listItems() { const g = gNow(); return ITEMS.filter(i => (i.gender === 'u' || i.gender === g) && (F.slot === 'all' || i.slot === F.slot) && (F.rar === 'all' || i.rarity === F.rar) && (F.season === 'all' || i.season === F.season) && (F.badge === 'all' || i.badge === F.badge) && (!F.mine || !i.price || S.owned(i.id))); }
function render() { if (!open_) return; $('btXu').textContent = st.xu;
  $('btTabs').innerHTML = chip('tab', 'sets', `👗 Bộ đồ (${SETS.filter(s => s.gender === gNow()).length})`, tab) + chip('tab', 'items', `🧩 Món lẻ (${ITEMS.filter(i => i.gender === 'u' || i.gender === gNow()).length})`, tab) + ' ' + chip('g', 'm', '🧑 Nam', gNow()) + chip('g', 'f', '👩 Nữ', gNow()) + chip('mine', !F.mine, F.mine ? '✔ Đồ của tôi' : '☐ Đồ của tôi', true);
  $('btFil1').innerHTML = (tab === 'sets' ? `<select id="btCat"><option value="all">Tất cả phong cách</option>${CATS.map(c => `<option${F.cat === c ? ' selected' : ''}>${c}</option>`).join('')}</select>` : chip('slot', 'all', 'Tất cả', F.slot) + Object.entries(SLOTS).map(([k, n]) => chip('slot', k, n, F.slot)).join(''));
  $('btFil2').innerHTML = chip('rar', 'all', 'Mọi độ hiếm', F.rar) + Object.entries(RAR).map(([k, r]) => chip('rar', k, `<span style="color:${r.c}">◆</span> ${r.n}`, F.rar)).join('') + ' ' + chip('badge', 'all', 'Mọi nhãn', F.badge) + Object.entries(BADGE).map(([k, n]) => chip('badge', k, n, F.badge)).join('') + ' ' + ['all', 'Tết', 'Valentine', 'Halloween', 'Noel'].map(s => chip('season', s, s === 'all' ? 'Mọi mùa' : s === 'Tết' ? '🧧 Tết' : s === 'Noel' ? '🎄 Noel' : s === 'Halloween' ? '🎃 Halloween' : '💘 Valentine', F.season)).join('');
  const grid = $('btGrid');
  if (tab === 'sets') grid.innerHTML = listSets().map(s => { const c = setCost(s), own = setOwned(s); return `<div class="btCard r-${s.rarity}${selSet === s ? ' sel' : ''}" data-set="${s.uid}" style="border-color:${RAR[s.rarity].c}">${BADGEH(s.badge)}${RARH(s.rarity)}${!own && c && s.full > c ? `<span class="off">-${Math.round((1 - c / s.full) * 100)}%</span>` : ''}<div class="ph" data-look='${JSON.stringify(s.look).replace(/'/g, '&#39;')}'></div><div class="nm">${s.icon} ${s.name}${s.pair ? ' 💞' : ''}</div><div class="pr${own || !c ? ' ok' : ''}">${own ? '✔ Đã có' : c ? (s.full > c ? `<s>${s.full}</s>` : '') + '🪙 ' + c : 'Miễn phí'}</div>${s.limited && !own ? `<div class="cd">⏳ <span class="cdT">${fmtLeft()}</span></div>` : ''}</div>`; }).join('') || '<p class="tiny">Không có bộ đồ phù hợp bộ lọc.</p>';
  else grid.innerHTML = listItems().map(i => { const own = !i.price || S.owned(i.id); return `<div class="btCard r-${i.rarity}${selItem === i ? ' sel' : ''}" data-item="${i.id}" style="border-color:${RAR[i.rarity].c}">${i.limited && !own ? `<div class="cd" style="position:absolute;bottom:2px;left:0;right:0">⏳ <span class="cdT">${fmtLeft()}</span></div>` : ''}${BADGEH(i.badge)}${RARH(i.rarity)}<div class="ph" data-look='${JSON.stringify(itemLook(i, null, true)).replace(/'/g, '&#39;')}'></div><div class="nm">${i.name}</div><div class="pr${own ? ' ok' : ''}">${!i.price ? 'Miễn phí' : own ? '✔ Đã có' : '🪙 ' + i.price}</div>${i.colors[0] ? `<div class="sws">${i.colors.slice(0, 8).map(c => `<i style="background:${c}"></i>`).join('')}</div>` : ''}</div>`; }).join('') || '<p class="tiny">Không có món phù hợp bộ lọc.</p>';
  grid.querySelectorAll('.ph').forEach(d => io.observe(d)); renderSel(); }
function renderSel() { const cv = $('btPrev'); let name = '👀 Đang mặc', info = 'Chọn một bộ đồ hoặc món lẻ để thử.', act = '', sw = '';
  if (tab === 'sets' && selSet) { const s = selSet, c = setCost(s), own = setOwned(s); tryLook = clone(s.look); name = `${s.icon} ${s.name}`;
    info = `${RAR[s.rarity].n} · ${s.line ? '✨ ' + s.line : s.originName || s.cat}${s.season ? ' · ' + s.season : ''}${s.pair ? ' · 💞 đồ đôi' : ''}<br>${s.items.length ? s.items.map(k => ITEM[k].name + (S.owned(k) ? ' ✔' : '')).join(', ') : 'Toàn món cơ bản miễn phí'}${!own && c && s.full !== c ? `<br>Giá trọn bộ giảm 20% (lẻ: ${s.full} Xu)` : ''}`;
    act = own || !c ? `<button class="buy" data-a="wear">👗 Mặc bộ này</button>` : `<button class="buy" data-a="buy">Mua bộ 🪙 ${c}</button>`; }
  else if (tab === 'items' && selItem) { const i = selItem, own = !i.price || S.owned(i.id); tryLook = itemLook(i, selColor); name = i.name;
    info = `${RAR[i.rarity].n} · ${SLOTS[i.slot]}${i.season ? ' · ' + i.season : ''}${i.colors[0] ? ` · ${i.colors.length} màu (mua 1 lần dùng mọi màu)` : ''}`;
    if (i.colors[0]) sw = i.colors.map(c => `<span data-c="${c}" class="${(selColor || i.colors[0]) === c ? 'sel' : ''}" style="background:${c}"></span>`).join('');
    act = own ? `<button class="buy" data-a="wear">✔ Mặc ngay</button>` : `<button class="buy" data-a="buy">Mua 🪙 ${i.price}</button>`; }
  else tryLook = S.baseLook();
  const cur = tab === 'sets' ? selSet : tab === 'items' ? selItem : null, rr = cur ? cur.rarity : 't';
  $('btPod').className = 'btPod t-' + rr; $('btLim').innerHTML = cur && cur.limited ? `⏳ Giới hạn – còn <span class="cdT">${fmtLeft()}</span>` : '';
  if (rr === 'l') info += '<br><span style="color:#ffd54f">✨ Huyền thoại: chất liệu phát sáng động, hạt lấp lánh, hiệu ứng xuất hiện & khung tên vàng</span>'; else if (rr === 's') info += '<br><span style="color:#e1bee7">💜 Sử thi: kim tuyến/sequin lấp lánh, điểm vàng bạc</span>'; else if (rr === 'h') info += '<br><span style="color:#90caf9">💠 Hiếm: vải satin bóng có hoa văn</span>';
  act += `<button data-a="reset">↩ Bỏ thử</button><button data-a="mirror">🪞 Tủ đồ</button>`;
  $('btName').textContent = name; $('btInfo').innerHTML = info; $('btAct').innerHTML = act; $('btSw').innerHTML = sw; cv._look = normLook(tryLook); S.live.add(cv); }
function buy(cost, ids, what) { if (st.xu < cost) return G.toast(`Chưa đủ Xu ảo (cần ${cost}, bạn có ${st.xu}) – điểm danh, sự kiện, lên cấp để nhận thêm`), false;
  G.setXu(-cost); S.grant(ids); G.save(); G.toast(`🛍️ Đã mua ${what} (−${cost} Xu ảo)`); return true; }
function wear(L) { const out = clone(L); for (const k in out) if (out[k] === null || out[k] === undefined || out[k] === false) delete out[k]; S.apply(out); G.toast('👗 Đã thay đồ!'); }
el.onclick = (e) => { const t = e.target; if (t === el) return closeBoutique();
  const f = t.closest('[data-f]'); if (f) { const k = f.dataset.f, v = f.dataset.v; if (k === 'tab') { tab = v; selSet = selItem = null; } else if (k === 'mine') F.mine = !F.mine; else if (k === 'g') { F.g = v; selSet = selItem = null; } else F[k] = v; return render(); }
  const sc = t.closest('[data-set]'); if (sc) { selSet = SETS.find(s => s.uid === sc.dataset.set); el.querySelectorAll('.btCard.sel').forEach(x => x.classList.remove('sel')); sc.classList.add('sel'); return renderSel(); }
  const ic = t.closest('[data-item]'); if (ic) { selItem = ITEM[ic.dataset.item]; selColor = null; el.querySelectorAll('.btCard.sel').forEach(x => x.classList.remove('sel')); ic.classList.add('sel'); return renderSel(); }
  const sw = t.closest('[data-c]'); if (sw) { selColor = sw.dataset.c; return renderSel(); }
  const a = t.closest('[data-a]'); if (!a) return; const A = a.dataset.a;
  if (A === 'reset') { selSet = selItem = null; return render(); } if (A === 'mirror') { closeBoutique(); return S.open(tryLook || S.baseLook(), 'custom'); }
  if (A === 'buy') { if (tab === 'sets' && selSet) { const s = selSet; if (buy(setCost(s), s.items, `bộ ${s.icon} ${s.name}`)) { st.owned['set_' + s.uid] = true; G.save(); wear(s.look); } }
    else if (selItem) { if (buy(selItem.price, [selItem.id], selItem.name)) wear(tryLook); } return render(); }
  if (A === 'wear') { if (tryLook && S.costOf(normLook(tryLook)) === 0) wear(tryLook); else if (tryLook) { closeBoutique(); S.open(tryLook, 'custom'); G.toast('Một vài món trong đồ đang mặc chưa sở hữu – mua trong Tủ đồ'); } return render(); } };
el.addEventListener('change', (e) => { if (e.target.id === 'btCat') { F.cat = e.target.value; render(); } });
$('btClose').onclick = () => closeBoutique();
setInterval(() => { if (open_) { const v = fmtLeft(); el.querySelectorAll('.cdT').forEach(n => n.textContent = v); } }, 1000);
function openBoutique(opts = {}) { open_ = true; F.g = opts.g || st.gender || 'm'; if (opts.tab) tab = opts.tab; el.classList.remove('hidden'); render(); }
function closeBoutique() { open_ = false; tryLook = null; el.classList.add('hidden'); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open_) closeBoutique(); });
const tb = document.createElement('button'); tb.id = 'boutiqueBtn'; tb.className = 'pill btn'; tb.textContent = '🛍️ Thời trang'; tb.onclick = () => openBoutique(); const wb = $('wardrobeBtn'); (wb || $('shopBtn')).before(tb);
G.boutique = { ITEM, ITEMS, SETS, open: openBoutique, close: closeBoutique, COUNTS, V, MIR, select: (uid) => { const s = SETS.find(x => x.uid === uid); if (s) { tab = 'sets'; selSet = s; render(); } }, selectItem: (id, c) => { tab = 'items'; selItem = ITEM[id]; selColor = c || null; render(); }, F, setF: (o) => { Object.assign(F, o); render(); } };
