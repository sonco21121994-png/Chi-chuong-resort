// Bộ sưu tập phong cách + Tủ đồ (wardrobe): preset looks per gender, custom mix, premium items (Xu ảo), 3D preview, lookbook
import * as THREE from 'three';
import { createAvatar, animateAvatar, normLook, TOPS, BOTTOMS, SHOES, HAIR_STYLES, FULL_TOPS, SKINS, SKIN_TONES, HAIRS, EYES } from './avatar.js';
const HAIRS2 = ['#d8b35a', '#ead9b0', '#f5f5f5', '#c0c0c0', '#e86aa8', '#b388ff', '#2a6fd6', '#26c6da', '#66bb6a', '#ff7043', '#e53935', '#8b5a2b'];
import { LBL, itemsOfLook, priceOf, itemId, ITEM, addPresetSets } from './catalog.js';
const G = window.__game; const st = G.st; const $ = (id) => document.getElementById(id);
const clone = (o) => JSON.parse(JSON.stringify(o));

// labels, prices & ownership come from the data-driven catalog (js/catalog.js)
const itemsOf = itemsOfLook;
const owned = (k) => !!(st.owned && (st.owned['it_' + k] || st.owned['sty_' + k]));
const costOf = (L) => itemsOf(L).filter(([k]) => !owned(k)).reduce((s, [, p]) => s + p, 0);
const grant = (ids) => { st.owned = st.owned || {}; ids.forEach(k => { st.owned['it_' + k] = true; }); };

const NGAU = { gender: 'm', build: 'slim', skin: '#eac096', hair: '#0d0d0d', hairStyle: 'spiky', eye: '#1b1b1b', top: 'jacketopen', topC: '#111111', bottom: 'cargo', bottomC: '#121212', shoes: 'platform', shoesC: '#0b0b0b',
  glasses: true, glassesStyle: 'shield', glassesC: '#050505', necklace: 'cuban', hipChain: true, watch: true, watchC: '#151515', ring: true, bracelet: true };
const PRESETS = {
  m: [
    { id: 'bien', icon: '🌴', name: 'Biển nhiệt đới', desc: 'Sơ mi Hawaii, quần bơi, sandal, mũ cói và kính râm – sẵn sàng ra bãi biển.', look: { hairStyle: 'undercut', hair: '#2a1a10', skin: '#d9a577', top: 'hawaii', topC: '#ff7043', bottom: 'boardshorts', bottomC: '#00897b', shoes: 'sandals', shoesC: '#8d6e63', hat: 'straw', glasses: true } },
    { id: 'thanhlich', icon: '👔', name: 'Thanh lịch', desc: 'Sơ mi trắng, quần tây xanh navy, giày lười nâu và đồng hồ vàng.', look: { hairStyle: 'sidepart', hair: '#1b1210', top: 'shirt', topC: '#fafafa', bottom: 'trousers', bottomC: '#1a237e', shoes: 'loafers', shoesC: '#6d4c41', watch: true } },
    { id: 'duongpho', icon: '🛹', name: 'Đường phố', desc: 'Hoodie xám, jeans, sneaker trắng, mũ lưỡi trai đỏ, tóc dựng.', look: { hairStyle: 'spiky', hair: '#1b1210', top: 'hoodie', topC: '#455a64', bottom: 'jeans', bottomC: '#1565c0', shoes: 'sneakers', shoesC: '#f5f5f5', hat: 'cap', hatC: '#e53935' } },
    { id: 'datiec', icon: '🥂', name: 'Dạ tiệc', desc: 'Blazer xanh đêm, quần tây đen, giày lười, dây chuyền vàng và đồng hồ – hợp Vũ Trường.', look: { hairStyle: 'sidepart', hair: '#0d0d0d', top: 'blazer', topC: '#1a237e', bottom: 'trousers', bottomC: '#111111', shoes: 'loafers', shoesC: '#111111', necklace: 'gold', watch: true } },
    { id: 'thethao', icon: '🏐', name: 'Thể thao', desc: 'Áo ba lỗ đỏ, jogger đen, sneaker, mũ lưỡi trai – chơi bóng chuyền bãi biển.', look: { hairStyle: 'short', hair: '#1b1210', top: 'tank', topC: '#e53935', bottom: 'joggers', bottomC: '#212121', shoes: 'sneakers', shoesC: '#fafafa', hat: 'cap', hatC: '#212121' } },
    { id: 'vintage', icon: '📻', name: 'Vintage/Retro', desc: 'Polo be, quần tây nâu, giày lười, mũ fedora và kính tròn thập niên 70.', look: { hairStyle: 'sidepart', hair: '#3e2723', beard: 'stubble', top: 'polo', topC: '#c8a96a', bottom: 'trousers', bottomC: '#6d4c41', shoes: 'loafers', shoesC: '#4e342e', hat: 'fedora', hatC: '#5d4037', glasses: true, glassesC: '#6d4c41' } },
    { id: 'boho', icon: '🌾', name: 'Boho', desc: 'Sơ mi linen màu kem, quần short nâu, sandal, râu lún phún, dây chuyền vàng.', look: { hairStyle: 'short', hair: '#5a3a22', beard: 'stubble', top: 'shirt', topC: '#e8dcc8', bottom: 'shorts', bottomC: '#8d6e63', shoes: 'sandals', shoesC: '#795548', necklace: 'gold', hat: 'straw' } },
    { id: 'capdoi', icon: '💞', name: 'Cặp đôi', desc: 'Áo thun hồng + jeans – mặc đôi với bạn nữ chọn "Cặp đôi" cho buổi hẹn.', look: { hairStyle: 'undercut', hair: '#1b1210', top: 'tee', topC: '#ff4fa3', bottom: 'jeans', bottomC: '#1565c0', shoes: 'sneakers', shoesC: '#ffffff' } },
    { id: 'style_ngau', icon: '🤘', name: 'Style Ngầu', desc: 'Avatar chủ đảo: tóc dựng gai đen, kính shield đen viền trắng, áo khoác đen mở ngoài thun in hình, xích Cuban vàng, quần túi hộp, xích hông, boots đế cao, đồng hồ đen, nhẫn và vòng hạt. Kèm động tác "Rock tay" và "Ngồi ghế boss".', owner: true, look: NGAU },
  ],
  f: [
    { id: 'bien', icon: '🌺', name: 'Biển nhiệt đới', desc: 'Bikini hồng phối khăn sarong, sandal, mũ rộng vành và kính râm.', look: { hairStyle: 'long', hair: '#2c1b12', skin: '#eac096', top: 'bikini', topC: '#ff4f8b', bottom: 'sarong', bottomC: '#ffb3c6', shoes: 'sandals', shoesC: '#f5e0c0', hat: 'sunhat', glasses: true } },
    { id: 'thanhlich', icon: '👜', name: 'Thanh lịch', desc: 'Áo kiểu trắng, chân váy xám, cao gót đen, tóc búi, ngọc trai và đồng hồ.', look: { hairStyle: 'bun', hair: '#2c1b12', top: 'blouse', topC: '#fafafa', bottom: 'skirt', bottomC: '#37474f', shoes: 'heels', shoesC: '#111111', necklace: 'pearl', watch: true } },
    { id: 'duongpho', icon: '🛼', name: 'Đường phố', desc: 'Croptop vàng, jeans, sneaker, mũ lưỡi trai, tóc đuôi ngựa.', look: { hairStyle: 'pony', hair: '#1b1210', top: 'crop', topC: '#ffd54f', bottom: 'jeans', bottomC: '#1565c0', shoes: 'sneakers', shoesC: '#ffffff', hat: 'cap', hatC: '#212121' } },
    { id: 'datiec', icon: '✨', name: 'Dạ tiệc', desc: 'Đầm dạ tiệc ánh kim đỏ ruby, cao gót, dây chuyền vàng – nổi bật ở Vũ Trường.', look: { hairStyle: 'long', hair: '#1b1210', top: 'party', topC: '#c2185b', shoes: 'heels', shoesC: '#d4af37', necklace: 'gold' } },
    { id: 'thethao', icon: '🏃‍♀️', name: 'Thể thao', desc: 'Áo ba lỗ xanh ngọc, quần short đen, sneaker, tóc đuôi ngựa.', look: { hairStyle: 'pony', hair: '#2c1b12', top: 'tank', topC: '#26a69a', bottom: 'shorts', bottomC: '#212121', shoes: 'sneakers', shoesC: '#fafafa' } },
    { id: 'vintage', icon: '🎞️', name: 'Vintage/Retro', desc: 'Đầm đỏ san hô, tóc bob mái, kính tròn, mũ rộng vành – phong cách retro.', look: { hairStyle: 'bob', hair: '#3e2723', top: 'dress', topC: '#e57373', shoes: 'heels', shoesC: '#6d4c41', glasses: true, glassesC: '#6d4c41', hat: 'sunhat', hatC: '#f5efe0' } },
    { id: 'boho', icon: '🌼', name: 'Boho', desc: 'Đầm màu đất, sandal, tóc dài và vòng hoa trên đầu.', look: { hairStyle: 'long', hair: '#5a3a22', top: 'dress', topC: '#d7a86e', shoes: 'sandals', shoesC: '#8d6e63', crown: true, necklace: 'gold' } },
    { id: 'capdoi', icon: '💞', name: 'Cặp đôi', desc: 'Áo thun hồng + short jeans – mặc đôi với bạn nam chọn "Cặp đôi".', look: { hairStyle: 'long', hair: '#2c1b12', top: 'tee', topC: '#ff4fa3', bottom: 'shorts', bottomC: '#1565c0', shoes: 'sneakers', shoesC: '#ffffff' } },
  ],
};
for (const g of ['m', 'f']) for (const p of PRESETS[g]) { p.look = { gender: g, skin: '#eac096', eye: '#3b2416', ...(g === 'f' ? { lips: '#d2506e' } : {}), ...p.look }; }
addPresetSets(PRESETS);
const presetLook = (g, id) => clone((PRESETS[g].find(p => p.id === id) || PRESETS[g][0]).look);

// ---------- player look ----------
const isOwnerName = () => /^s[ơo]n$/i.test((st.name || '').trim());
function baseLook() { if (st.look && st.look.gender === st.gender) return clone(st.look); return presetLook(st.gender, st.gender === 'm' && isOwnerName() ? 'style_ngau' : 'bien'); }
G.styleLook = () => { const L = baseLook(); const e = st.equip || {}; const f = L.gender === 'f';
  if (e.hat) L.hat = e.hat; if (e.glasses) L.glasses = true; if (e.hawaii) L.top = 'hawaii';
  if (e.swim) { L.swim = true; if (f) { if (!['bikini', 'onepiece'].includes(L.top)) { L.top = 'onepiece'; } L.bottom = L.top === 'bikini' ? 'sarong' : 'none'; } else { L.top = 'none'; L.bottom = 'boardshorts'; } L.shoes = 'sandals'; }
  return L; };

// ---------- offscreen preview renderer ----------
const PW = 240, PH = 300; let R = null, scn, camP, av = null, avKey = '';
function ensureR() { if (R) return; R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.setSize(PW, PH, false); R.outputColorSpace = THREE.SRGBColorSpace;
  scn = new THREE.Scene(); scn.add(new THREE.HemisphereLight('#ffffff', '#6a4a7a', 1.6)); const d = new THREE.DirectionalLight('#fff4e0', 1.8); d.position.set(2, 4, 3); scn.add(d);
  const fl = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ color: '#ff4fd8', transparent: true, opacity: 0.18 })); fl.rotation.x = -Math.PI / 2; scn.add(fl);
  camP = new THREE.PerspectiveCamera(30, PW / PH, 0.1, 20); camP.position.set(0, 1.15, 4.1); camP.lookAt(0, 0.92, 0); }
function setAv(L, anim = 'idle') { const k = JSON.stringify(L) + anim; if (k === avKey && av) return; if (av) scn.remove(av.root); av = createAvatar(L); av.anim = anim; scn.add(av.root); avKey = k; }
function renderLook(L, yaw = 0.35, t = 0, anim = 'idle') { ensureR(); setAv(L, anim); av.root.rotation.y = yaw; av.animT = t; animateAvatar(av, 0.016, t); R.render(scn, camP); return R.domElement; }
const thumbCache = new Map();
function thumb(L) { const k = JSON.stringify(L); if (!thumbCache.has(k)) thumbCache.set(k, renderLook(L, 0.35, 0).toDataURL('image/png')); return thumbCache.get(k); }
// live rotating previews
const live = new Set(); let lastT = 0;
function liveLoop(ts) { requestAnimationFrame(liveLoop); if (ts - lastT < 33) return; lastT = ts;
  for (const c of live) { if (!c.isConnected || !c.offsetParent || !c._look) continue; const src = renderLook(c._look, ts / 1400, ts / 1000, c._anim || 'idle'); const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height); } }
requestAnimationFrame(liveLoop);

// ---------- CSS ----------
const css = document.createElement('style'); css.textContent = `
.styStrip{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 8px}
.styCard{flex:0 0 auto;width:74px;border:1px solid #5a3a85;border-radius:10px;background:#1d1033;color:#fff;cursor:pointer;padding:3px;text-align:center;font-size:11px;position:relative}
.styCard img{width:100%;height:84px;object-fit:cover;display:block;border-radius:7px;background:radial-gradient(circle at 50% 70%,#4a2370,#1a0d2e)}
.styCard.sel{border-color:#ff4fd8;box-shadow:0 0 10px rgba(255,79,216,.6);background:#3a1350}
.styCard .lk{position:absolute;top:3px;right:3px;background:rgba(0,0,0,.7);border-radius:8px;padding:1px 4px;font-size:10px;color:#ffe39a}
.styCard .ow{position:absolute;top:3px;left:3px;font-size:12px}
.styPrevRow{display:flex;gap:10px;align-items:center;margin-bottom:6px}
.styPrevRow canvas{width:110px;height:138px;border-radius:12px;background:radial-gradient(circle at 50% 70%,#4a2370,#140a24);border:1px solid #5a3a85}
.styPrevRow .info{flex:1;font-size:12.5px;opacity:.92}
.styPrevRow .info b{display:block;font-size:14px;margin-bottom:3px}
.styBtn{padding:7px 12px;border-radius:10px;border:1px solid #ff4fd8;background:#3a1350;color:#fff;cursor:pointer;margin-top:6px}
#wardrobe .card{width:min(860px,100%);max-height:94vh;display:flex;flex-direction:column}
.wdBody{display:flex;gap:12px;min-height:0;flex:1}
.wdLeft{flex:0 0 220px;display:flex;flex-direction:column;align-items:center;gap:6px}
.wdLeft canvas{width:210px;height:262px;border-radius:14px;background:radial-gradient(circle at 50% 70%,#4a2370,#140a24);border:1px solid #5a3a85}
.wdRight{flex:1;overflow:auto;min-height:0;max-height:62vh;padding-right:4px}
.wdTabs{display:flex;gap:6px;margin:6px 0 8px}.wdTabs button{flex:1}
.wdGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}
.wdGrid .styCard{width:auto}.wdGrid .styCard img{height:120px}
.wdRow{margin:0 0 8px}.wdRow>div:first-child{font-size:12px;opacity:.8;margin-bottom:3px}
.wdRow .opts{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.wdRow .opts button{padding:5px 9px;border-radius:12px;border:1px solid #5a3a85;background:#1d1033;color:#fff;cursor:pointer;font-size:12px}
.wdRow .opts button.sel{background:#6a1f78;border-color:#ff4fd8}
.wdRow .sw{width:22px;height:22px;border-radius:50%;border:2px solid #fff3;cursor:pointer;display:inline-block}
.wdRow .sw.sel{border-color:#ff4fd8;box-shadow:0 0 8px #ff4fd8}
.wdRow input[type=color]{width:30px;height:24px;border:none;background:none;padding:0;cursor:pointer}
.wdFoot{display:flex;gap:8px;align-items:center;margin-top:10px}.wdFoot .tiny{flex:1}
@media (max-width:640px){.wdBody{flex-direction:column}.wdLeft{flex:0 0 auto}.wdLeft canvas{width:140px;height:175px}.wdRight{max-height:40vh}}
`; document.head.appendChild(css);

// ---------- start screen ----------
const gRow = $('genderRow'), cRow = $('colorRow');
if (cRow) { cRow.style.display = 'none'; const lb = cRow.previousElementSibling; if (lb && lb.tagName === 'LABEL') lb.style.display = 'none'; }
const startBox = document.createElement('div'); startBox.innerHTML = `<label>Bộ sưu tập phong cách</label><div id="styStrip" class="styStrip"></div>
  <div class="styPrevRow"><canvas id="styPrev" width="220" height="276"></canvas><div class="info"><b id="styName"></b><span id="styDesc"></span><br><button class="styBtn" id="styCustom">🎨 Tùy chỉnh / Tủ đồ</button></div></div>`;
gRow.after(startBox);
const curPresetId = () => { const L = baseLook(); const p = PRESETS[L.gender].find(p => JSON.stringify(p.look) === JSON.stringify(L)); return p ? p.id : null; };
function cardHTML(g, p, sel) { const c = costOf(p.look); return `<div class="styCard${sel ? ' sel' : ''}" data-p="${p.id}" title="${p.name}">${p.owner ? '<span class="ow">👑</span>' : ''}${c ? `<span class="lk">🔒${c}</span>` : ''}<img alt="" src="${thumb(p.look)}"><div>${p.icon} ${p.name}</div></div>`; }
function renderStart() { const g = st.gender, id = curPresetId(); $('styStrip').innerHTML = PRESETS[g].map(p => cardHTML(g, p, p.id === id)).join('');
  const L = baseLook(); const p = PRESETS[g].find(x => x.id === id); $('styName').textContent = p ? `${p.icon} ${p.name}` : '🎨 Phong cách tự phối'; $('styDesc').textContent = p ? p.desc : 'Bộ đồ bạn tự phối trong Tủ đồ.';
  const c = $('styPrev'); c._look = L; live.add(c); }
$('styStrip').onclick = (e) => { const el = e.target.closest('[data-p]'); if (!el) return; const L = presetLook(st.gender, el.dataset.p);
  if (costOf(L)) return openWardrobe(L, 'col'); applyLook(L); };
$('styCustom').onclick = () => openWardrobe(baseLook(), 'custom');
gRow.addEventListener('click', (e) => { if (!e.target.closest('[data-g]')) return; setTimeout(() => { if (!st.look || st.look.gender !== st.gender) { st.look = presetLook(st.gender, 'bien'); G.save(); } renderStart(); }, 0); });

function applyLook(L) { L = clone(L); st.look = L; st.gender = L.gender; G.save();
  gRow.querySelectorAll('[data-g]').forEach(b => b.classList.toggle('sel', b.dataset.g === st.gender));
  renderStart(); if (G.isPlaying && G.isPlaying()) G.updateTag(); }

// ---------- wardrobe overlay ----------
const wd = document.createElement('div'); wd.id = 'wardrobe'; wd.className = 'overlay hidden'; wd.style.zIndex = 40;
wd.innerHTML = `<div class="card"><h2 style="margin:0 0 4px">👗 Tủ đồ · Bộ sưu tập phong cách</h2>
  <div class="row" id="wdGender"><button class="chip" data-g="m">🧑 Nam</button><button class="chip" data-g="f">👩 Nữ</button></div>
  <div class="wdTabs"><button class="chip" data-t="col">✨ Bộ sưu tập</button><button class="chip" data-t="custom">🎨 Tùy chỉnh</button></div>
  <div class="wdBody"><div class="wdLeft"><canvas id="wdPrev" width="240" height="300"></canvas><div id="wdName" style="font-weight:700;text-align:center"></div><div id="wdDesc" class="tiny" style="text-align:center"></div></div><div class="wdRight" id="wdRight"></div></div>
  <div class="wdFoot"><span class="tiny" id="wdCost"></span><button class="styBtn" id="wdCancel">Hủy</button><button class="primary" id="wdSave" style="width:auto;padding:9px 18px">Lưu</button></div></div>`;
document.body.appendChild(wd);
let draft = null, tab = 'col';
function openWardrobe(L, t = 'col') { draft = normLook(clone(L || baseLook())); draft = { ...clone(L || baseLook()) }; tab = t; wd.classList.remove('hidden'); renderWd(); }
function closeWardrobe() { wd.classList.add('hidden'); draft = null; }
const sel = (a, b) => (a === b ? ' sel' : '');
function rowChips(label, key, list, names, cur) { return `<div class="wdRow"><div>${label}</div><div class="opts">${list.map(v => { const n = names[v] !== undefined ? names[v] : v; const pr = v && ['top', 'bottom', 'shoes', 'hat', 'glasses', 'necklace', 'bag', 'wings', 'aura'].includes(key) ? priceOf(key, v) : 0; const lk = pr && !owned(itemId(key, v)) ? ` 🔒${pr}` : ''; return `<button data-k="${key}" data-v="${v}" class="${sel(String(cur || ''), v)}">${n}${lk}</button>`; }).join('')}</div></div>`; }
function rowSw(label, key, list, cur, picker = true) { return `<div class="wdRow"><div>${label}</div><div class="opts">${list.map(c => `<span class="sw${sel(cur, c)}" data-k="${key}" data-v="${c}" style="background:${c}"></span>`).join('')}${picker ? `<input type="color" data-k="${key}" value="${/^#[0-9a-f]{6}$/i.test(cur || '') ? cur : '#888888'}">` : ''}</div></div>`; }
const TOG = (label, key, cur, price) => `<button data-tog="${key}" class="${cur ? 'sel' : ''}">${label}${price && !owned(key) ? ` 🔒${price}` : ''}</button>`;
// skin fine-tune (always free): lightness & undertone on top of a palette tone
const hx = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const toHex = (a) => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function tuneSkin(base, l, u) { let [r, g, b] = hx(base); const k = 1 + l / 100; r *= k; g *= k; b *= k; if (l > 0) { r += (255 - r) * l / 160; g += (255 - g) * l / 160; b += (255 - b) * l / 160; } r += u * 1.2; g += u * 0.3; b -= u * 1.3; return toHex([r, g, b]); }
function skinRow(L) { const base = draft._sb || (SKINS.includes(L.skin) ? L.skin : SKINS[5]);
  return `<div class="wdRow"><div>Tông da · ${SKIN_TONES.length} tông miễn phí <span class="tiny">(${(SKIN_TONES.find(t => t[0] === base) || ['', 'Tự chỉnh'])[1]})</span></div><div class="opts">${SKIN_TONES.map(([c, n, u]) => `<span class="sw${sel(base, c)}" title="${n} · undertone ${u}" data-k="skinBase" data-v="${c}" style="background:${c}"></span>`).join('')}</div>
  <div class="opts" style="margin-top:4px;font-size:12px">☀️ Sáng/tối <input type="range" min="-30" max="30" value="${draft._sl || 0}" data-tune="l" style="width:110px"> 🌡️ Lạnh ⇄ Ấm <input type="range" min="-20" max="20" value="${draft._su || 0}" data-tune="u" style="width:110px"> <span class="sw" style="background:${L.skin};cursor:default" title="Tông da hiện tại"></span> <span class="tiny">Miễn phí</span></div></div>`; }
function renderWd() {
  const g = draft.gender; wd.querySelectorAll('#wdGender [data-g]').forEach(b => b.classList.toggle('sel', b.dataset.g === g)); wd.querySelectorAll('.wdTabs [data-t]').forEach(b => b.classList.toggle('sel', b.dataset.t === tab));
  const pid = (PRESETS[g].find(p => JSON.stringify(p.look) === JSON.stringify(draft)) || {}).id; const p = PRESETS[g].find(x => x.id === pid);
  $('wdName').textContent = p ? `${p.icon} ${p.name}` : '🎨 Tự phối'; $('wdDesc').textContent = p ? (p.owner ? '👑 Avatar chủ đảo' : '') : '';
  const c = $('wdPrev'); c._look = normLook(draft); live.add(c);
  const R = $('wdRight');
  if (tab === 'col') R.innerHTML = `<div class="wdGrid">${PRESETS[g].map(x => cardHTML(g, x, x.id === pid)).join('')}</div><p class="tiny" style="margin-top:8px">🔒 = món cao cấp, mở khóa bằng Xu ảo (không nạp tiền thật). Chọn "Cặp đôi" cả nam và nữ để mặc đồ đôi khi hẹn hò.</p>`;
  else { const L = normLook(draft), full = FULL_TOPS.has(L.top); const glassesV = !draft.glasses ? '' : draft.glassesStyle || 'on';
    R.innerHTML = skinRow(L) + rowChips('Vóc dáng', 'build', ['', 'slim', g === 'm' ? 'broad' : 'curvy'], { '': 'Cân đối', slim: 'Mảnh', broad: 'Vạm vỡ', curvy: 'Đầy đặn' }, draft.build || '') + rowChips('Kiểu tóc (miễn phí ✂️)', 'hairStyle', HAIR_STYLES[g].filter(h => h !== 'bald' || g === 'm'), LBL.hair, L.hairStyle) + rowSw('Màu tóc', 'hair', HAIRS, L.hair) + rowChips('Hiệu ứng màu tóc', 'hairFx', ['', 'highlight', 'ombre'], LBL.hairFx, draft.hairFx || '') + (draft.hairFx ? rowSw('Màu thứ hai', 'hair2', HAIRS2, draft.hair2 || '#d8b35a') : '') + rowSw('Màu mắt', 'eye', EYES, L.eye, false)
      + (g === 'm' ? rowChips('Râu', 'beard', ['', 'stubble', 'full'], LBL.beard, draft.beard || '') : rowSw('Màu son', 'lips', ['#d2506e', '#c0392b', '#e57373', '#b5651d', '#f06292'], L.lips || '#d2506e', false))
      + rowChips('Áo / Đầm', 'top', TOPS[g], LBL.top, L.top) + rowSw('Màu áo', 'topC', ['#fafafa', '#111111', '#ff4fa3', '#e53935', '#ff7043', '#ffd54f', '#66bb6a', '#26a69a', '#29b6f6', '#1a237e', '#ab47bc', '#c8a96a'], L.topC)
      + (full ? '' : rowChips('Quần / Váy', 'bottom', BOTTOMS[g], LBL.bottom, L.bottom) + rowSw('Màu quần', 'bottomC', ['#111111', '#263238', '#1565c0', '#6d4c41', '#f5f5f5', '#8d6e63', '#37474f', '#ffb3c6', '#00897b'], L.bottomC))
      + rowChips('Giày', 'shoes', SHOES[g], LBL.shoes, L.shoes) + rowSw('Màu giày', 'shoesC', ['#ffffff', '#111111', '#6d4c41', '#d4af37', '#e91e63', '#8d6e63', '#29b6f6', '#c62828'], L.shoesC)
      + rowChips('Kính', 'glasses', Object.keys(LBL.glasses), LBL.glasses, glassesV) + rowChips('Mũ', 'hat', Object.keys(LBL.hat), LBL.hat, draft.hat || '') + (draft.hat ? rowSw('Màu mũ', 'hatC', ['#e2c27a', '#f5efe0', '#212121', '#e53935', '#1e88e5', '#5d4037'], L.hatC || '#e2c27a') : '')
      + rowChips('Dây chuyền', 'necklace', Object.keys(LBL.necklace), LBL.necklace, draft.necklace || '') + rowChips('Túi', 'bag', Object.keys(LBL.bag).filter(b => g === 'f' || b !== 'clutch'), LBL.bag, draft.bag || '') + (draft.bag ? rowSw('Màu túi', 'bagC', ['#c8a96a', '#3e2723', '#111111', '#c2185b', '#d4af37', '#37474f', '#fafafa'], draft.bagC || '#c8a96a') : '')
      + rowChips('Cánh', 'wings', Object.keys(LBL.wings), LBL.wings, draft.wings || '') + rowChips('Hào quang', 'aura', Object.keys(LBL.aura), LBL.aura, draft.aura || '')
      + `<div class="wdRow"><div>Phụ kiện khác</div><div class="opts">${TOG('⌚ Đồng hồ vàng', 'watch', draft.watch && !draft.watchC, ITEM.watch.price)}${TOG('⌚ Đồng hồ đen', 'watchBlack', draft.watch && draft.watchC)}${TOG('💍 Nhẫn', 'ring', draft.ring)}${TOG('📿 Vòng hạt', 'bracelet', draft.bracelet)}${g === 'f' ? TOG('🌼 Vòng hoa', 'crown', draft.crown, ITEM.crown.price) : TOG('⛓️ Xích hông', 'hipChain', draft.hipChain)}</div></div>`; }
  const cost = costOf(normLook(draft)); $('wdCost').textContent = cost ? `Cần mở khóa: ${itemsOf(normLook(draft)).filter(([k]) => !owned(k)).map(i => i[2]).join(', ')} · Bạn có 🪙 ${st.xu} Xu` : 'Tất cả món đã sở hữu ✔'; $('wdSave').textContent = cost ? `Mua & Lưu (🪙 ${cost} Xu)` : 'Lưu';
}
wd.onclick = (e) => { if (!draft) return; const t = e.target;
  if (t === wd) return closeWardrobe();
  const gb = t.closest('#wdGender [data-g]'); if (gb) { if (gb.dataset.g !== draft.gender) draft = presetLook(gb.dataset.g, 'bien'); return renderWd(); }
  const tb = t.closest('.wdTabs [data-t]'); if (tb) { tab = tb.dataset.t; return renderWd(); }
  const pc = t.closest('[data-p]'); if (pc) { draft = presetLook(draft.gender, pc.dataset.p); return renderWd(); }
  const tg = t.closest('[data-tog]'); if (tg) { const k = tg.dataset.tog;
    if (k === 'watch') { const on = draft.watch && !draft.watchC; draft.watch = !on; delete draft.watchC; }
    else if (k === 'watchBlack') { const on = draft.watch && draft.watchC; draft.watch = !on; if (!on) draft.watchC = '#151515'; else delete draft.watchC; }
    else if (k === 'build') draft.build = draft.build === 'slim' ? null : 'slim'; else draft[k] = !draft[k]; return renderWd(); }
  const el = t.closest('[data-k]'); if (!el || el.tagName === 'INPUT') return; const k = el.dataset.k, v = el.dataset.v;
  if (k === 'glasses') { draft.glasses = !!v; draft.glassesStyle = v && v !== 'on' ? v : null; if (v === 'shield') draft.glassesC = '#050505'; }
  else if (k === 'skinBase') { draft._sb = v; draft.skin = tuneSkin(v, +draft._sl || 0, +draft._su || 0); }
  else if (k === 'hat') { draft.hat = v || null; if (v) draft.crown = false; }
  else if (k === 'top') { draft.top = v; if (FULL_TOPS.has(v)) delete draft.bottom; else if (!draft.bottom) draft.bottom = BOTTOMS[draft.gender][0]; }
  else draft[k] = v || null;
  renderWd(); };
wd.addEventListener('input', (e) => { const el = e.target;
  if (el.dataset.tune && draft) { draft[el.dataset.tune === 'l' ? '_sl' : '_su'] = +el.value; const base = draft._sb || (SKINS.includes(draft.skin) ? draft.skin : SKINS[5]); draft._sb = base; draft.skin = tuneSkin(base, +draft._sl || 0, +draft._su || 0); $('wdPrev')._look = normLook(draft); return; } if (el.tagName === 'INPUT' && el.dataset.k && draft) { draft[el.dataset.k] = el.value; $('wdPrev')._look = normLook(draft); } });
wd.addEventListener('change', (e) => { if (e.target.tagName === 'INPUT' && draft) renderWd(); });
$('wdCancel').onclick = closeWardrobe;
$('wdSave').onclick = () => { const L = normLook(draft); const items = itemsOf(L).filter(([k]) => !owned(k)); const cost = items.reduce((s, i) => s + i[1], 0);
  if (cost) { if (st.xu < cost) return G.toast(`Chưa đủ Xu ảo (cần ${cost}, bạn có ${st.xu}) – điểm danh hoặc tham gia sự kiện để nhận thêm`); G.setXu(-cost); st.owned = st.owned || {}; grant(items.map(i => i[0])); G.toast(`🛍️ Đã mở khóa ${items.map(i => i[2]).join(', ')} (−${cost} Xu ảo)`); }
  const out = clone(draft); for (const k in out) if (out[k] === null || out[k] === undefined || out[k] === false || k[0] === '_') delete out[k];
  applyLook(out); closeWardrobe(); G.toast('👗 Đã lưu phong cách mới!'); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && draft) closeWardrobe(); });

// topbar button
const tb = document.createElement('button'); tb.id = 'wardrobeBtn'; tb.className = 'pill btn'; tb.textContent = '👗 Tủ đồ'; tb.onclick = () => openWardrobe(baseLook(), 'col'); $('shopBtn').before(tb);

// ---------- lookbook (for screenshots / guide) ----------
function lookbook(g, cols = 3) { const L = PRESETS[g], cw = PW, ch = PH + 34, rows = Math.ceil(L.length / cols); const c = document.createElement('canvas'); c.width = cols * cw + 20; c.height = rows * ch + 70; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#2a0f45'); gr.addColorStop(1, '#0b0518'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#ffd6f5'; x.font = 'bold 30px system-ui,sans-serif'; x.textAlign = 'center'; x.fillText(`ĐẢO NGỌC · Lookbook ${g === 'm' ? 'Nam' : 'Nữ'}`, c.width / 2, 44);
  L.forEach((p, i) => { const cx = 10 + (i % cols) * cw, cy = 60 + Math.floor(i / cols) * ch; x.fillStyle = 'rgba(255,79,216,0.10)'; x.fillRect(cx + 4, cy + 4, cw - 8, ch - 8);
    x.drawImage(renderLook(p.look, 0.35, 0), cx, cy); x.fillStyle = '#fff'; x.font = 'bold 17px system-ui,sans-serif'; x.fillText(`${p.icon} ${p.name}`, cx + cw / 2, cy + PH + 20); });
  return c.toDataURL('image/png'); }
function shot(L, yaw = 0, anim = 'idle', t = 0.5) { return renderLook(normLook(L), yaw, t, anim).toDataURL('image/png'); }

// skin-tone lookbook: same outfit in all 16 free tones (for character creation guide/screenshot)
function skinLookbook(g = 'm', cols = 8) { const T = SKIN_TONES, cw = PW * 0.62, ch = PH * 0.62 + 40, rows = Math.ceil(T.length / cols); const c = document.createElement('canvas'); c.width = cols * cw + 20; c.height = rows * ch + 70; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#2a0f45'); gr.addColorStop(1, '#0b0518'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#ffd6f5'; x.font = 'bold 26px system-ui,sans-serif'; x.textAlign = 'center';
  x.fillText(`ĐẢO NGỌC · Tạo nhân vật · ${T.length} tông da miễn phí + thanh tinh chỉnh`, c.width / 2, 40);
  const base = presetLook(g, 'bien'); T.forEach(([hex, n, u], i) => { const cx = 10 + (i % cols) * cw, cy = 56 + Math.floor(i / cols) * ch; x.drawImage(renderLook(normLook({ ...base, skin: hex, gender: g, hairStyle: g === 'f' ? ['long', 'bob', 'pony', 'bun'][i % 4] : ['undercut', 'short', 'spiky', 'sidepart'][i % 4], hair: HAIRS[i % HAIRS.length] }), 0.35, 0), cx, cy, cw, PH * 0.62);
    x.fillStyle = hex; x.beginPath(); x.arc(cx + 16, cy + PH * 0.62 + 14, 9, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 13px system-ui,sans-serif'; x.fillText(n, cx + cw / 2 + 8, cy + PH * 0.62 + 14); x.font = '11px system-ui,sans-serif'; x.fillStyle = '#d9c7ff'; x.fillText('undertone ' + u, cx + cw / 2 + 8, cy + PH * 0.62 + 30); });
  return c.toDataURL('image/png'); }
// generic lookbook for arbitrary looks: [{look, title}] (used by boutique & guide)
function gridBook(title, list, cols = 6, sc = 0.7) { const cw = PW * sc, ch = PH * sc + 36, rows = Math.ceil(list.length / cols); const c = document.createElement('canvas'); c.width = cols * cw + 20; c.height = rows * ch + 64; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#2a0f45'); gr.addColorStop(1, '#0b0518'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#ffd6f5'; x.font = 'bold 26px system-ui,sans-serif'; x.textAlign = 'center'; x.fillText(title, c.width / 2, 40);
  list.forEach((it, i) => { const cx = 10 + (i % cols) * cw, cy = 54 + Math.floor(i / cols) * ch; x.drawImage(renderLook(normLook(it.look), it.yaw ?? 0.35, 0.5, it.anim || 'idle'), cx, cy, cw, PH * sc); x.fillStyle = '#fff'; x.font = 'bold 13px system-ui,sans-serif'; x.fillText(it.title, cx + cw / 2, cy + PH * sc + 16); if (it.sub) { x.font = '11px system-ui,sans-serif'; x.fillStyle = '#d9c7ff'; x.fillText(it.sub, cx + cw / 2, cy + PH * sc + 31); } });
  return c.toDataURL('image/png'); }
G.style = { PRESETS, presetLook, open: openWardrobe, close: closeWardrobe, apply: applyLook, refresh: renderStart, lookbook, shot, costOf, itemsOf, owned, grant, renderLook, thumb, live, baseLook, skinLookbook, gridBook, NGAU };
renderStart();
