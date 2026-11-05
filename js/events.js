// Real-time clock (Asia/Bangkok), venue opening hours, weekly events calendar, seasonal themes, photo mode.
import * as THREE from 'three';
const G = window.__game; const { W, scene, renderer, camera, st, toast, setXu, save, npcs, LIVE } = G;
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const flagOn = (name) => /^(1|true|yes|on)$/i.test(Q.get(name) || '');
// Playtest: ?clubAlways=1 opens the nightclub immediately (real hours stay 21:00–02:00 otherwise).
const clubAlways = flagOn('clubAlways');
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const DAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const TZ = 7; // Asia/Bangkok, UTC+7 (no DST)
const pad = (v) => String(v).padStart(2, '0');

// ---------- config (defaults; overridable in config.json -> hours / events / seasons) ----------
const CFG = await fetch('config.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
const HOURS = Object.assign({ bar: [[18, 26]], club: [[21, 26]], cafe: [[7, 17]], restaurant: [[10.5, 14], [17, 22]], kiosk: [[7, 22]] }, CFG.hours || {});
const EVENTS = CFG.events || [
  { id: 'djlive', name: '🎧 DJ Live Show', place: 'Vũ Trường (sân khấu chính)', weekday: 6, hour: 21, minute: 0, durationMin: 180, reward: 30, desc: 'DJ & MC live trên màn hình LED, nhảy cùng cả đảo' },
  { id: 'beachparty', name: '🔥 Beach party & Acoustic night', place: 'Bãi biển (lửa trại)', weekday: 0, hour: 19, minute: 30, durationMin: 150, reward: 25, desc: 'Lửa trại, guitar acoustic, ngắm sao trên biển' },
  { id: 'sunsetyoga', name: '🌅 Ngắm hoàng hôn cùng nhau', place: 'Bến tàu', weekday: 5, hour: 17, minute: 30, durationMin: 60, reward: 10, desc: 'Gặp gỡ, chụp ảnh hoàng hôn trên bến tàu' },
];
const SEASONS = CFG.seasons || [
  { id: 'tet', name: 'Tết Nguyên Đán', from: '01-20', to: '02-20', color: '#ff1744', items: [{ id: 'b_lixi', name: 'Bao lì xì', icon: '🧧' }, { id: 'b_mai', name: 'Hoa mai', icon: '🌼' }] },
  { id: 'valentine', name: 'Valentine', from: '02-07', to: '02-15', color: '#ff4fa3', items: [{ id: 'b_heart', name: 'Trái tim bay', icon: '💘' }, { id: 'b_rose', name: 'Hoa hồng', icon: '🌹' }] },
  { id: 'halloween', name: 'Halloween', from: '10-20', to: '11-02', color: '#ff8f00', items: [{ id: 'b_pumpkin', name: 'Bí ngô', icon: '🎃' }, { id: 'b_ghost', name: 'Bóng ma', icon: '👻' }] },
  { id: 'noel', name: 'Giáng sinh', from: '12-15', to: '12-31', color: '#2e7d32', items: [{ id: 'b_santa', name: 'Mũ ông già Noel', icon: '🎅' }, { id: 'b_tree', name: 'Cây thông', icon: '🎄' }] },
];
const bkk = (ms = Date.now()) => new Date(ms + TZ * 3600e3); // use getUTC* on this
let timeOverride = null; // admin slider: hour (0-24) or null for real clock
let manual = null;      // player time button: 'day' | 'sunset' | 'night' | null (auto)
const hourNow = () => timeOverride ?? (() => { const d = bkk(); return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600; })();

// ---------- opening hours ----------
function venueOpen(k) { if (k === 'club' && clubAlways) return true; if ((k === 'bar' || k === 'club') && LIVE.isLive) return true; const h = hourNow(); const r = HOURS[k]; if (!r) return true; return r.some(([a, b]) => (h >= a && h < b) || (b > 24 && h < b - 24)); }
const fmtH = (h) => `${pad(Math.floor(h % 24))}:${pad(Math.round((h % 1) * 60))}`;
function hoursText(v) { const k = typeof v === 'string' ? v : Object.keys(W.venues).find(x => W.venues[x] === v); return 'Giờ mở cửa ' + (HOURS[k] || []).map(([a, b]) => `${fmtH(a)}–${fmtH(b)}`).join(', '); }
const BAR_ACTS = new Set(['dance', 'barStool', 'barStand', 'barLean', 'crowd']);
const BEACH = new Set(['lounger', 'swim', 'wade', 'volley', 'castle', 'shore']);
G.venueOpen = venueOpen; G.hoursText = hoursText; G.clubAlways = clubAlways;
G.actMul = (k, n) => { const a = G.ACTS[k] || {}; const venue = BAR_ACTS.has(k) ? 'bar' : a.venue; if (venue && !venueOpen(venue)) return 0.03;
  const h = hourNow(); let m = 1; if (BEACH.has(k)) m *= (h > 7 && h < 17) ? 1.8 : (h >= 17 && h < 19) ? 1 : 0.25; if (k === 'photo' || k === 'view') m *= (h > 16.5 && h < 19) || (h > 5.5 && h < 7.5) ? 2 : 1;
  if (k === 'bonfire') m = activeEvent('beachparty') ? 6 : 0; if (activeEvent('beachparty') && BEACH.has(k)) m *= 0.4; return m; };

// ---------- clock + time button ----------
let lastKey = '';
function applyClock() { if (manual) { if (W.time !== manual || lastKey !== manual) { W.setTime(manual, renderer); lastKey = manual; } return; }
  const h = hourNow(); const key = Math.round(h * 30); if (key === lastKey) return; lastKey = key; W.setClock(h, renderer); }
const TIME_ICON = { day: '☀️', sunset: '🌅', night: '🌙' };
$('timeBtn').onclick = () => { const order = [null, 'day', 'sunset', 'night']; manual = order[(order.indexOf(manual) + 1) % 4]; lastKey = ''; applyClock(); updClockPill();
  toast(manual ? { day: '☀️ Xem thử: Ban ngày', sunset: '🌅 Xem thử: Hoàng hôn', night: '🌙 Xem thử: Ban đêm' }[manual] : `🕒 Theo giờ thực Việt Nam (GMT+7): ${fmtH(hourNow())}`); };
const clockPill = el('div', { id: 'clockPill', className: 'pill' }); $('topbar').insertBefore(clockPill, $('xu'));
function updClockPill() { const h = hourNow(); clockPill.textContent = (manual ? '🎛️ ' : '🕒 ') + fmtH(h) + (timeOverride != null ? ' (admin)' : ''); $('timeBtn').textContent = manual ? TIME_ICON[manual] : '🕒'; }
G.setManualTime = (m) => { manual = m; lastKey = ''; applyClock(); updClockPill(); };
G.hourNow = hourNow;

// ---------- weekly events ----------
function nextOcc(e, now = Date.now()) { const off = TZ * 3600e3, d = bkk(now); const diff = (e.weekday - d.getUTCDay() + 7) % 7; let s = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff, e.hour, e.minute || 0) - off; const dur = (e.durationMin || 120) * 60e3;
  if (s - 7 * 864e5 + dur > now) s -= 7 * 864e5; else if (s + dur <= now) s += 7 * 864e5; return { start: s, end: s + dur, on: now >= s && now < s + dur }; }
let simEvent = null; // admin: force an event on
function activeEvent(id) { if (simEvent === id) return true; if (id === 'djlive') return LIVE.isLive; const e = EVENTS.find(x => x.id === id); if (!e) return false; if (timeOverride != null) { const d = bkk(); return d.getUTCDay() === e.weekday && timeOverride >= e.hour + (e.minute || 0) / 60 && timeOverride < e.hour + (e.minute || 0) / 60 + e.durationMin / 60; } return nextOcc(e).on; }
G.activeEvent = activeEvent;
const fmtLeft = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (d ? d + ' ngày ' : '') + `${pad(h)}:${pad(m)}:${pad(s)}`; };

// ---------- season ----------
function activeSeason() { const f = Q.get('season'); if (f) return SEASONS.find(s => s.id === f) || null; const d = bkk(); const md = `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; return SEASONS.find(s => s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to) || null; }
const season = activeSeason(); G.season = season;
const deco = new THREE.Group(); scene.add(deco); const decoUpd = [];
function buildSeason(s) {
  if (!s) return; const c = W.center, y0 = (x, z) => W.walkY(x, z);
  const string = (x0, z0, x1, z1, cols, emoji) => { const n = 14; for (let i = 0; i <= n; i++) { const k = i / n, x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k; const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: cols[i % cols.length] })); m.position.set(x, y0(x, z) + 3.2 - Math.sin(k * Math.PI) * 0.6, z); deco.add(m); decoUpd.push((t) => m.material.color.set(cols[(i + Math.floor(t * 2)) % cols.length])); } };
  const bv = W.venues.bar, cf = W.venues.cafe, rs = W.venues.restaurant;
  if (s.id === 'tet') { string(c.x - 8, c.z, c.x + 8, c.z, ['#ff1744', '#ffd600']); string(rs.x - 4, rs.z + 6, rs.x + 4, rs.z + 6, ['#ff1744', '#ffd600']);
    for (const [x, z] of [[c.x - 4, c.z + 3], [c.x + 4, c.z + 3]]) { const tr = new THREE.Group(); tr.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.6), new THREE.MeshStandardMaterial({ color: '#5d4037' })));
      const bl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: '#ffd600', emissive: '#ffab00', emissiveIntensity: 0.4, flatShading: true })); bl.position.y = 1.2; tr.add(bl); tr.position.set(x, y0(x, z) + 0.8, z); deco.add(tr); } }
  if (s.id === 'valentine') { string(c.x - 8, c.z, c.x + 8, c.z, ['#ff4fa3', '#ffffff', '#ff1744']); string(cf.x - 4, cf.z + 5, cf.x + 4, cf.z + 5, ['#ff4fa3', '#fff']); }
  if (s.id === 'halloween') { string(bv.x - 6, bv.z + 6.5, bv.x + 6, bv.z + 6.5, ['#ff8f00', '#7b1fa2']);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, x = c.x + Math.cos(a) * 9, z = c.z + Math.sin(a) * 9; const p = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff8f00', emissive: '#ff6f00', emissiveIntensity: 0.6 })); p.scale.y = 0.8; p.position.set(x, y0(x, z) + 0.32, z); deco.add(p); } }
  if (s.id === 'noel') { const x = c.x, z = c.z + 2; const tree = new THREE.Group(); for (let i = 0; i < 3; i++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.4, 1.6, 10), new THREE.MeshStandardMaterial({ color: '#1b5e20' })); cn.position.y = 1 + i * 0.9; tree.add(cn); }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: '#ffd600' })); star.position.y = 3.6; tree.add(star); tree.position.set(x, y0(x, z), z); deco.add(tree); string(c.x - 8, c.z, c.x + 8, c.z, ['#ff1744', '#00e676', '#ffd600', '#2979ff']); }
  // limited-time shop badges
  const until = `Giới hạn mùa ${s.name}`; G.SHOP.event = s.items.map(it => ({ ...it, slot: 'badge', price: 60, desc: 'Huy hiệu sự kiện hiển thị trên tên', until }));
}
buildSeason(season);

// ---------- Sunday beach party: bonfire + seats ----------
const fire = new THREE.Group(); let fireLight = null; const BF = (() => { const x = W.volley.x + 9, z = W.volley.z + 3; return { x, z, y: W.walkY(x, z) }; })();
{ for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1), new THREE.MeshStandardMaterial({ color: '#4e342e' })); l.rotation.z = Math.PI / 2; l.rotation.y = i / 6 * Math.PI; l.position.y = 0.1; fire.add(l); }
  const flames = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ff9100', transparent: true, opacity: 0.85 })); flames.position.y = 0.6; flames.name = 'fl'; fire.add(flames);
  fireLight = new THREE.PointLight('#ff8a3d', 0, 14); fireLight.position.y = 1.2; fire.add(fireLight); fire.position.set(BF.x, BF.y, BF.z); scene.add(fire); fire.visible = false; }
const bonSpots = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, x = BF.x + Math.sin(a) * 2.3, z = BF.z + Math.cos(a) * 2.3; const s = { id: W.spots.length, kind: 'bonfire', venue: 'beach', x, z, y: W.walkY(x, z) + 0.22, rot: a + Math.PI, anim: i % 4 === 0 ? 'clap' : 'sitRock', seat: true, seatH: 0, occupant: null }; bonSpots.push(s); W.spots.push(s);
  const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 8), new THREE.MeshStandardMaterial({ color: '#6d4c41' })); lg.rotation.z = Math.PI / 2; lg.rotation.y = a; lg.position.set(x, s.y - 0.1, z); scene.add(lg); }
G.ACTS.bonfire = { kinds: ['bonfire'], dur: [40, 80], line: 'bonfire', text: 'Đang ngồi quanh lửa trại, hát acoustic 🔥🎸' };
G.LINES.bonfire = ['Hát bài gì đi mọi người 🎸', 'Lửa ấm ghê 🔥', 'Sao trên biển đẹp quá ✨', 'Chủ nhật chill thật sự', 'Ai nướng bắp không?'];
G.extraCafe = () => { if (!activeEvent('beachparty')) return 0; const p = G.player; return Math.pow(1 - Math.min(1, Math.hypot(p.x - BF.x, p.z - BF.z) / 25), 2) * 0.7; };
function gatherBonfire() { const pool = npcs.filter(n => !n.staff && n.mode !== 'form' && !(n.spot && n.spot.kind === 'bonfire')).sort(() => Math.random() - 0.5).slice(0, 9); pool.forEach((n, i) => setTimeout(() => G.goAct(n, 'bonfire'), i * 300)); }

// ---------- 'Sự kiện' panel + attendance rewards ----------
const evBtn = el('button', { className: 'pill btn', id: 'eventBtn' }, '📅 Sự kiện'); $('topbar').insertBefore(evBtn, $('shopBtn'));
evBtn.onclick = openEvents;
function openEvents() {
  const now = Date.now(); const rows = EVENTS.map(e => { const o = nextOcc(e); const on = activeEvent(e.id); const sd = bkk(o.start);
    return `<div class="item" style="text-align:left"><div class="nm">${e.name} ${on ? '<span class="badge">ĐANG DIỄN RA</span>' : ''}</div><div class="ds">${e.desc}<br>📍 ${e.place} · 🗓️ ${DAYS[e.weekday]} ${pad(e.hour)}:${pad(e.minute || 0)} (GMT+7) hằng tuần<br>${on ? '🎁 Có mặt ≥1 phút: +' + e.reward + ' Xu' : '⏳ Còn ' + fmtLeft(o.start - now) + ` (${pad(sd.getUTCDate())}/${pad(sd.getUTCMonth() + 1)})`}</div>
      ${on ? `<button data-go="${e.id}">Tới ngay ➜</button>` : `<button class="dis">🎁 +${e.reward} Xu khi tham gia</button>`}</div>`; }).join('');
  const hrs = Object.keys(HOURS).map(k => `${W.venues[k] ? W.venues[k].icon + ' ' + W.venues[k].name : k}: ${HOURS[k].map(([a, b]) => fmtH(a) + '–' + fmtH(b)).join(', ')} ${venueOpen(k) ? '🟢' : '🔴'}`).join('<br>');
  G.openPanel(`<h2>📅 Sự kiện trên đảo</h2>${season ? `<div class="pill" style="border-color:${season.color};display:inline-block;margin-bottom:8px">🎉 Mùa ${season.name}: trang trí & huy hiệu giới hạn trong Cửa hàng</div>` : ''}
    <div class="grid" style="grid-template-columns:1fr">${rows}</div><h3>🕒 Giờ mở cửa (giờ Việt Nam, GMT+7)</h3><p class="muted">${hrs}</p>`);
  $('panelBody').onclick = (e) => { const id = e.target.dataset.go; if (!id) return; G.closePanel(); const p = G.player; if (id === 'djlive') { const v = W.venues.club; p.target = { x: v.inner.x, z: v.inner.z }; p.afterArrive = () => { p.target = { x: W.clubFloor.x, z: W.clubFloor.z }; }; } else if (id === 'beachparty') p.target = { x: BF.x + 3, z: BF.z + 3 }; else p.target = { x: W.pier.x, z: W.pier.z1 }; toast('🚶 Đang đi tới sự kiện...'); };
}
const evPlace = (id) => id === 'djlive' ? { x: W.clubFloor.x + 1, z: W.clubFloor.z, r: 10 } : id === 'beachparty' ? { x: BF.x, z: BF.z, r: 12 } : { x: W.pier.x, z: (W.pier.z0 + W.pier.z1) / 2 || W.pier.z1, r: 14 };
const att = {}; const wasOn = {};
function eventTick() {
  for (const e of EVENTS) { const on = activeEvent(e.id);
    if (on && !wasOn[e.id] && e.id !== 'djlive') { toast(`📣 ${e.name} đang diễn ra tại ${e.place}!`); G.logChat('Sự kiện', `${e.name} bắt đầu – ${e.place}`); if (e.id === 'beachparty') gatherBonfire(); }
    wasOn[e.id] = on; if (!on || e.id === 'djlive') continue; // DJ live reward handled by live.js
    const P = evPlace(e.id), p = G.player; if (Math.hypot(p.x - P.x, p.z - P.z) < P.r) { att[e.id] = (att[e.id] || 0) + 1; const key = e.id + '-' + new Date(nextOcc(e).start).toISOString().slice(0, 10); st.evDone = st.evDone || {};
      if (att[e.id] === 60 && !st.evDone[key]) { st.evDone[key] = 1; save(); setXu(e.reward); toast(`🎉 +${e.reward} Xu: tham gia ${e.name}`); G.onEventAttend && G.onEventAttend(e.id); } } }
  const bp = activeEvent('beachparty'); fire.visible = bp;
}

// ---------- admin: time slider + event simulation ----------
function setAdminHour(h) { timeOverride = h; manual = null; lastKey = ''; applyClock(); updClockPill(); }
if (Q.has('admin')) { const b = el('button', { className: 'pill btn', title: 'Giờ / sự kiện (admin)' }, '⏱️'); $('topbar').insertBefore(b, $('muteBtn'));
  const xuB = el('button', { className: 'pill btn gold', id: 'adminXuBtn', title: 'Cộng 5000 Xu thử, có hiệu lực cả khi đang đăng nhập' }, '+5000 Xu thử'); $('topbar').prepend(xuB);
  xuB.onclick = (e) => { e.stopPropagation(); G.grantTestXu ? G.grantTestXu() : (setXu(5000), toast('🪙 +5000 Xu thử')); };
  b.onclick = () => {
  G.openPanel(`<h2>⏱️ Debug thời gian & sự kiện</h2><label>Giờ trong game: <b id="tsV"></b></label><input id="ts" type="range" min="0" max="24" step="0.25" style="width:100%" value="${hourNow().toFixed(2)}">
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><button class="pill btn gold" data-a="xu">+5000 Xu thử</button><button class="pill btn" data-h="21.5">🪩 21:30 Mở Vũ Trường</button><button class="pill btn" data-h="16.75">☀️ 16:45 Đóng cửa</button><button class="pill btn" data-a="real">🕒 Về giờ thực</button>${EVENTS.map(e => `<button class="pill btn" data-ev="${e.id}">▶ ${e.name}</button>`).join('')}<button class="pill btn" data-ev="">⏹ Tắt giả lập sự kiện</button></div>
   <p class="muted">Kéo thanh giờ tới 21:00 trở đi (hoặc bấm 21:30) để mở cửa Vũ Trường. Trên điện thoại, kéo ngang ngay trên thanh. Mùa hiện tại: ${season ? season.name : 'không'} · thử mùa khác bằng ?season=tet|valentine|halloween|noel</p>`);
  const v = () => { $('tsV').textContent = timeOverride == null ? 'giờ thực ' + fmtH(hourNow()) : fmtH(timeOverride); }; v();
  const applySlider = (e) => { setAdminHour(+e.target.value); v(); };
  $('ts').oninput = applySlider; $('ts').onchange = applySlider;
  $('panelBody').onclick = (e) => { const t = e.target.closest('[data-h],[data-a],[data-ev]'); if (!t) return; if (t.dataset.a === 'xu') { G.grantTestXu ? G.grantTestXu() : (setXu(5000), toast('🪙 +5000 Xu thử')); return; } if (t.dataset.h) { setAdminHour(+t.dataset.h); const sl = $('ts'); if (sl) sl.value = t.dataset.h; v(); toast(+t.dataset.h >= 21 && +t.dataset.h < 26 ? '🪩 Vũ Trường đang mở cửa' : '🕘 Đã đặt giờ – Vũ Trường đóng nếu ngoài 21:00–02:00'); return; } if (t.dataset.a === 'real') { timeOverride = null; lastKey = ''; applyClock(); v(); updClockPill(); } if (t.dataset.ev !== undefined) { const id = t.dataset.ev; if (id === 'djlive') { G.live && G.live.force(true); } else { simEvent = id || null; if (!id && G.live) G.live.force(false); } toast(id ? 'Giả lập sự kiện: ' + id : 'Đã tắt giả lập'); } }; }; }
G.adminTime = (h) => { timeOverride = h; lastKey = ''; applyClock(); updClockPill(); };
G.simEvent = (id) => { simEvent = id; };

// ---------- PHOTO MODE ----------
const photoBtn = el('button', { className: 'pill btn', id: 'photoBtn', title: 'Chụp ảnh' }, '📸'); $('topbar').insertBefore(photoBtn, $('muteBtn'));
const pm = el('div', { id: 'photoUI', className: 'hidden' }, `
  <div class="pmRow"><b>📸 Chế độ chụp ảnh</b><span class="muted">Kéo để xoay · lăn chuột/2 ngón để zoom</span></div>
  <div class="pmRow" id="pmPose"></div><div class="pmRow" id="pmFilter"></div><div class="pmRow" id="pmFrame"></div>
  <div class="pmRow"><button id="pmShot" class="pmBig">⚪ Chụp</button><button id="pmExit">✕ Thoát</button></div>`);
document.body.append(pm);
const prev = el('div', { id: 'photoPrev', className: 'overlay hidden' }, `<div class="card wide" style="text-align:center"><img id="ppImg" style="max-width:100%;border-radius:10px"><div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap"><button class="pill btn" id="ppDl">⬇️ Tải về</button><button class="pill btn" id="ppShare">📤 Chia sẻ (TikTok/Facebook…)</button><button class="pill btn" id="ppClose">✕ Đóng</button></div><p class="muted" id="ppNote"></p></div>`);
document.body.append(prev);
const POSES = [['idle', '🧍 Đứng'], ['wave', '👋 Vẫy'], ['photo', '✌️ Tạo dáng'], ['selfie', '🤳 Selfie'], ['hype', '🙌 Quẩy'], ['dance1', '🕺 Nhảy'], ['view', '🌅 Ngắm'], ['cheers', '🥂 Cụng ly'], ['rock', '🤘 Rock tay'], ['boss', '👑 Ngồi ghế boss']];
const FILTERS = [['none', 'Gốc', ''], ['warm', 'Nắng ấm', 'sepia(.25) saturate(1.35) brightness(1.05)'], ['film', 'Film', 'contrast(1.1) saturate(.8) sepia(.18)'], ['bw', 'Đen trắng', 'grayscale(1) contrast(1.15)'], ['neon', 'Neon', 'saturate(1.8) hue-rotate(-15deg) contrast(1.1)'], ['dream', 'Mơ màng', 'brightness(1.1) saturate(1.2) blur(.4px)']];
const FRAMES = [['none', 'Không khung'], ['polaroid', 'Polaroid'], ['neon', 'Viền neon'], ['story', 'Story 9:16']];
let pose = 'photo', filter = FILTERS[0], frameK = 'polaroid', inPhoto = false;
const chips = (id, list, cur, fn) => { const r = $(id); r.innerHTML = list.map(x => `<button class="${x[0] === cur ? 'sel' : ''}" data-k="${x[0]}">${x[1]}</button>`).join(''); r.onclick = (e) => { const k = e.target.dataset.k; if (k) { fn(k); chips(id, list, k, fn); } }; };
function enterPhoto() { if (!G.isPlaying()) return; inPhoto = true; document.body.classList.add('photo'); pm.classList.remove('hidden'); $('hud').classList.add('hideUI');
  chips('pmPose', POSES, pose, (k) => { pose = k; }); chips('pmFilter', FILTERS, filter[0], (k) => { filter = FILTERS.find(f => f[0] === k); renderer.domElement.style.filter = filter[2]; }); chips('pmFrame', FRAMES, frameK, (k) => { frameK = k; });
  G.cam.dist = 4.2; G.cam.pitch = 0.18; }
function exitPhoto() { inPhoto = false; if (!G.player.holding) G.holdProp(G.player.av, null); document.body.classList.remove('photo'); pm.classList.add('hidden'); $('hud').classList.remove('hideUI'); renderer.domElement.style.filter = ''; G.player.emote = null; G.cam.dist = 5.2; G.cam.pitch = 0.3; if (G.toggleUI && document.body.classList.contains('noui')) { G._uiQuiet = true; G.toggleUI(false); G._uiQuiet = false; } }
G.onFrame.push(() => { if (inPhoto && (!G.player.seat || ['rock', 'boss'].includes(pose))) { G.player.emote = pose === 'boss' ? (G.player.seat ? 'boss' : 'bossp') : pose; G.player.emoteT = 0.5; if (['photo', 'selfie'].includes(pose) && G.player.av.propKind !== 'phone') G.holdProp(G.player.av, 'phone'); } });
photoBtn.onclick = enterPhoto; $('pmExit').onclick = exitPhoto;
let lastBlob = null, lastURL = '';
$('pmShot').onclick = () => {
  if (G.renderFrame) G.renderFrame(0, G.now()); else renderer.render(scene, camera); const src = renderer.domElement; const W0 = src.width, H0 = src.height;
  let cw = W0, ch = H0, sx = 0, sw = W0; if (frameK === 'story') { cw = Math.round(H0 * 9 / 16); sw = Math.min(W0, cw); sx = (W0 - sw) / 2; cw = sw; }
  const pad0 = frameK === 'polaroid' ? Math.round(cw * 0.04) : 0, bottom = frameK === 'polaroid' ? Math.round(ch * 0.16) : 0;
  const c = el('canvas'); c.width = cw + pad0 * 2; c.height = ch + pad0 + bottom + (frameK === 'polaroid' ? 0 : 0); const g = c.getContext('2d');
  g.fillStyle = frameK === 'polaroid' ? '#fbf8f0' : '#000'; g.fillRect(0, 0, c.width, c.height);
  g.filter = filter[2] || 'none'; g.drawImage(src, sx, 0, sw, H0, pad0, pad0, cw, ch); g.filter = 'none';
  if (frameK === 'neon') { g.lineWidth = Math.max(8, cw * 0.012); g.strokeStyle = '#ff2fbf'; g.shadowColor = '#ff2fbf'; g.shadowBlur = 25; g.strokeRect(g.lineWidth, g.lineWidth, c.width - g.lineWidth * 2, c.height - g.lineWidth * 2); g.shadowBlur = 0; }
  const fs = Math.max(16, Math.round(cw * 0.028));
  if (frameK === 'polaroid') { g.fillStyle = '#333'; g.font = `600 ${fs * 1.3}px "Segoe Script", cursive, system-ui`; g.textAlign = 'center'; const d = bkk(); g.fillText(`${G.st.name || 'Mình'} @ ${W.zoneName(G.player.x, G.player.z)} · ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`, c.width / 2, ch + pad0 + bottom * 0.6); }
  // watermark logo
  g.textAlign = 'right'; g.font = `800 ${fs}px system-ui`; g.fillStyle = 'rgba(255,255,255,.9)'; g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText('🏝️ ĐẢO NGỌC', c.width - pad0 - fs * 0.6, pad0 + fs * 1.4); g.font = `600 ${fs * 0.6}px system-ui`; g.fillText('đảo nghỉ dưỡng 3D · ' + location.host, c.width - pad0 - fs * 0.6, pad0 + fs * 2.2); g.shadowBlur = 0;
  c.toBlob((b) => { lastBlob = b; if (lastURL) URL.revokeObjectURL(lastURL); lastURL = URL.createObjectURL(b); $('ppImg').src = lastURL; prev.classList.remove('hidden');
    $('ppNote').textContent = canShare() ? 'Bấm Chia sẻ để mở bảng chia sẻ của điện thoại (TikTok, Facebook, Zalo…). Lần chia sẻ đầu mỗi ngày: +15 Xu.' : 'Trình duyệt này không hỗ trợ chia sẻ trực tiếp – hãy Tải về rồi đăng lên TikTok/Facebook.'; G.onPhoto && G.onPhoto(); }, 'image/jpeg', 0.92);
  flash();
};
function flash() { const f = $('flashFx'); if (!f) return; f.style.transition = 'none'; f.style.opacity = 0.8; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); }
const fileOf = () => new File([lastBlob], `dao-ngoc-${Date.now()}.jpg`, { type: 'image/jpeg' });
const canShare = () => !!(navigator.canShare && lastBlob && navigator.canShare({ files: [fileOf()] }));
$('ppDl').onclick = () => { const a = el('a', { href: lastURL, download: `dao-ngoc-${Date.now()}.jpg` }); document.body.append(a); a.click(); a.remove(); };
$('ppShare').onclick = async () => {
  if (!canShare()) { $('ppDl').click(); return toast('Đã tải ảnh về – mở TikTok/Facebook để đăng nhé!'); }
  try { await navigator.share({ files: [fileOf()], title: 'Đảo Ngọc', text: 'Đang chill ở Đảo Ngọc 🏝️ #DaoNgoc' }); shareReward(); } catch (e) { if (e.name !== 'AbortError') toast('Không chia sẻ được: ' + e.message); }
};
function shareReward() { const today = bkk().toISOString().slice(0, 10); if (st.lastShare === today) return toast('Cảm ơn bạn đã chia sẻ! 💖'); st.lastShare = today; save(); setXu(15); toast('📤 +15 Xu: chia sẻ ảnh đầu tiên hôm nay!'); G.onShare && G.onShare(); }
$('ppClose').onclick = () => prev.classList.add('hidden');
addEventListener('keydown', (e) => { if (e.code === 'Escape' && inPhoto) exitPhoto(); });
G.photo = { enter: enterPhoto, exit: exitPhoto, shot: () => $('pmShot').click(), POSES, setPose: (k) => { pose = k; } };

// ---------- loop ----------
let sec = 0, t0 = 0;
G.onFrame.push((dt, t) => { sec -= dt; if (sec <= 0) { sec = 1; applyClock(); updClockPill(); eventTick(); }
  if (fire.visible) { const fl = fire.getObjectByName('fl'); fl.scale.set(1 + Math.sin(t * 13) * 0.08, 1 + Math.sin(t * 9.7) * 0.18, 1 + Math.cos(t * 11) * 0.08); fireLight.intensity = 6 + Math.sin(t * 17) * 1.5 + Math.random(); }
  for (const u of decoUpd) u(t); });
G.onEnter.push(() => { lastKey = ''; applyClock(); updClockPill(); if (season) setTimeout(() => toast(`🎉 Đảo Ngọc đang mùa ${season.name}! Xem huy hiệu giới hạn trong Cửa hàng`), 7000); });
applyClock();
