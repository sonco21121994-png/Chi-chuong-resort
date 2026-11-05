// Dating: profile (18+), 'Ghép đôi' swipe deck, matches, 'Rủ hẹn' places, couple emotes, romantic pier bench, mock Xu boosts.
import * as THREE from 'three';
const G = window.__game; const { st, scene, toast, setXu, save, W, npcs, player } = G; const net = G.net;
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const INTERESTS = { bien: '🏖️ Biển', cafe: '☕ Cafe', nhay: '💃 Nhảy', anuong: '🍜 Ăn uống', nhac: '🎧 Nhạc DJ', chupanh: '📸 Chụp ảnh', dulich: '🧳 Du lịch', thethao: '🏐 Thể thao' };
const todayBKK = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
st.dating = st.dating || null; const D = () => st.dating;
const ensureD = () => { if (!st.dating) st.dating = { gender: st.gender, looking: st.gender === 'm' ? 'f' : 'm', age: 22, bio: '', interests: [], adult: false }; return st.dating; };

// ---------- romantic bench at the pier (sunset spot) ----------
const P = W.pier; const BX = P.x + 4.2, BZ = P.z0 - 1.6, BY = W.walkY(BX, BZ);
const benchG = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#9a5b33', roughness: 0.8 }), iron = new THREE.MeshStandardMaterial({ color: '#2b2b33', metalness: 0.6, roughness: 0.4 });
const bx = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; benchG.add(o); return o; };
bx(1.9, 0.08, 0.5, wood, 0, 0.45, 0); bx(1.9, 0.4, 0.06, wood, 0, 0.75, -0.26); [-0.85, 0.85].forEach(x => { bx(0.07, 0.45, 0.45, iron, x, 0.22, 0); bx(0.07, 0.5, 0.07, iron, x, 0.7, -0.26); });
const heart = new THREE.Shape(); heart.moveTo(0, 0.25); heart.bezierCurveTo(0, 0.4, -0.35, 0.4, -0.35, 0.15); heart.bezierCurveTo(-0.35, -0.05, 0, -0.2, 0, -0.35); heart.bezierCurveTo(0, -0.2, 0.35, -0.05, 0.35, 0.15); heart.bezierCurveTo(0.35, 0.4, 0, 0.4, 0, 0.25);
const hm = new THREE.Mesh(new THREE.ExtrudeGeometry(heart, { depth: 0.06, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#ff3d7f', emissive: '#ff2060', emissiveIntensity: 0.8 })); hm.position.set(0, 1.35, -0.3); benchG.add(hm);
const hl = new THREE.PointLight('#ff6aa0', 0, 7); hl.position.set(0, 1.4, 0.3); benchG.add(hl);
[-1.25, 1.25].forEach(x => { bx(0.08, 1.6, 0.08, iron, x, 0.8, -0.1); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffcf70', emissiveIntensity: 1.2 })); lamp.position.set(x, 1.66, -0.1); benchG.add(lamp); });
benchG.position.set(BX, BY, BZ); scene.add(benchG);
const benchSpots = [-0.45, 0.45].map(dx => { const s = { id: W.spots.length, kind: 'lovebench', venue: 'beach', x: BX + dx, z: BZ + 0.05, y: BY, seatH: 0.5, rot: 0, anim: 'sit', seat: true, occupant: null, romantic: true }; W.spots.push(s); return s; });
G.onFrame.push((dt, t) => { const romantic = W.hour === undefined ? true : (W.hour >= 16.5 && W.hour <= 20) || W.night; hl.intensity = romantic ? 6 + Math.sin(t * 2) * 1.5 : 0; hm.rotation.y = Math.sin(t) * 0.3; });
G.ACTS.lovedate = { text: '💕 Đang hẹn hò', dur: [80, 100] };
const PLACES = { cafe: { name: '☕ Cafe Biển Xanh', get: () => W.venues.cafe.entry }, pier: { name: '🌅 Ghế tình nhân – Bến tàu hoàng hôn', get: () => ({ x: BX, z: BZ + 1.2 }) }, bar: { name: '🍺 Bar Beer (sàn nhảy)', get: () => W.venues.bar.entry } };

// ---------- topbar button + panel ----------
const btn = el('button', { id: 'datingBtn', className: 'pill btn', title: 'Ghép đôi' }, '💘'); $('topbar').insertBefore(btn, $('shopBtn'));
btn.onclick = () => openDating();
function openDating(tab = 'swipe') { const d = D(); if (!d || !d.adult || !d.bio) return openProfile(true); tab === 'matches' ? openMatches() : openSwipe(); }
G.dating = { open: openDating, invite: (uid, name) => inviteMenu({ uid, name }), coupleMenu: (r) => coupleMenu({ uid: r.uid, name: r.name }) };

function openProfile(first) { const d = ensureD(); const isAcct = !!G.account;
  G.openPanel(`<h2>💘 Hồ sơ hẹn hò</h2>${first ? '<p class="muted">Tạo hồ sơ để dùng Ghép đôi. Chỉ dành cho người <b>từ 18 tuổi</b>.</p>' : ''}
   <label>Tôi là</label><div class="chipSel" id="dpG">${[['m', '👨 Nam'], ['f', '👩 Nữ'], ['x', '🌈 Khác']].map(([k, n]) => `<button data-v="${k}" class="${d.gender === k ? 'sel' : ''}">${n}</button>`).join('')}</div>
   <label>Tìm</label><div class="chipSel" id="dpL">${[['m', 'Nam'], ['f', 'Nữ'], ['all', 'Tất cả']].map(([k, n]) => `<button data-v="${k}" class="${d.looking === k ? 'sel' : ''}">${n}</button>`).join('')}</div>
   <label>Tuổi</label><input id="dpAge" type="number" min="18" max="80" value="${d.age || 22}">
   <label>Giới thiệu (tối đa 140 ký tự)</label><textarea id="dpBio" maxlength="140" rows="2" placeholder="VD: Mê biển, thích cà phê sáng và nhảy tối thứ 7 🎧">${esc(d.bio)}</textarea>
   <label>Sở thích</label><div class="chipSel" id="dpI">${Object.entries(INTERESTS).map(([k, n]) => `<button data-v="${k}" class="${(d.interests || []).includes(k) ? 'sel' : ''}">${n}</button>`).join('')}</div>
   <label class="chk" style="text-transform:none;letter-spacing:0"><input type="checkbox" id="dpAdult" style="width:auto" ${d.adult || isAcct ? 'checked' : ''}> Tôi xác nhận đã đủ 18 tuổi</label>
   <p class="tiny">Không ghi số điện thoại/địa chỉ – hệ thống sẽ tự ẩn. Hồ sơ của Khách (offline) chỉ dùng với NPC demo.</p>
   <button class="primary" id="dpSave">Lưu hồ sơ</button>`);
  const one = (id, key) => $(id).onclick = (e) => { const v = e.target.dataset.v; if (!v) return; d[key] = v; [...$(id).children].forEach(b => b.classList.toggle('sel', b.dataset.v === v)); };
  one('dpG', 'gender'); one('dpL', 'looking');
  $('dpI').onclick = (e) => { const v = e.target.dataset.v; if (!v) return; const s = new Set(d.interests || []); s.has(v) ? s.delete(v) : s.size < 5 && s.add(v); d.interests = [...s]; [...$('dpI').children].forEach(b => b.classList.toggle('sel', s.has(b.dataset.v))); };
  $('dpSave').onclick = () => { const age = Math.round(+$('dpAge').value); if (!(age >= 18 && age <= 80)) return toast('Tuổi phải từ 18 đến 80'); if (!$('dpAdult').checked) return toast('Bạn cần xác nhận đủ 18 tuổi');
    let bio = $('dpBio').value.trim().slice(0, 140); bio = G.filter ? G.filter(bio) : bio; if (bio.length < 3) return toast('Viết vài dòng giới thiệu nhé ✍️');
    Object.assign(d, { age, bio, adult: true }); save(); toast('✅ Đã lưu hồ sơ hẹn hò'); openSwipe(); };
}

// ---------- likes quota (offline mirror; server enforces online) ----------
const quota = () => { const d = ensureD(); const t = todayBKK(); if (!d.likes || d.likes.day !== t) d.likes = { day: t, n: 0 }; const extra = d.extraLikes && d.extraLikes.day === t ? d.extraLikes.n : 0; return { used: d.likes.n, max: 20 + extra }; };
// ---------- demo profiles from NPCs (offline) ----------
const BIOS = ['Thích ngắm hoàng hôn ở bến tàu 🌅', 'Cà phê sữa đá mỗi sáng ☕', 'Tối thứ 7 là phải lên sàn 💃', 'Mê hải sản nướng & bia lạnh 🍤🍺', 'Chụp ảnh sống ảo là chân ái 📸', 'Đi bơi, đánh bóng chuyền bãi biển 🏐', 'Nghe nhạc DJ, thích EDM 🎧', 'Hiền lành, thích đi dạo trên cát 🐚'];
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function demoDeck() { const d = ensureD(); const seen = d.seen || {}; return npcs.filter(n => !n.staff && n.look.age !== 'kid' && n.look.age !== 'elder').map(n => { const h = hash(n.name + n.id); const g = n.look.gender;
  return { npc: n, uid: 'npc' + n.id, nick: n.name, gender: g, age: 19 + h % 16, bio: BIOS[h % BIOS.length], interests: Object.keys(INTERESTS).filter((k, i) => (h >> i) & 1).slice(0, 4), level: 1 + h % 15, online: true, hl: h % 9 === 0, demo: true, likesBack: h % 3 !== 0 }; })
  .filter(p => !seen[p.uid] && (d.looking === 'all' || p.gender === d.looking)).sort((a, b) => b.hl - a.hl).slice(0, 25); }

let deck = [], deckI = 0;
function openSwipe() {
  if (net && net.on) { G.openPanel('<h2>💘 Ghép đôi</h2><p class="muted">Đang tải hồ sơ…</p>'); net.send({ t: 'profiles' }); } else { deck = demoDeck(); deckI = 0; renderSwipe(); } }
function renderSwipe() { const q = quota(); const p = deck[deckI]; const d = D();
  G.openPanel(`<h2>💘 Ghép đôi ${net && net.on ? '' : '<small class="muted">(demo NPC – offline)</small>'}</h2>
   <div class="tabs"><button class="sel">Khám phá</button><button id="dgM">💞 Đã ghép (${matchList().length})</button><button id="dgP">✏️ Hồ sơ</button></div>
   <div class="swipe">${p ? cardHTML(p) : `<div class="pcardD"><div class="av">🏝️</div><p>Hết hồ sơ phù hợp rồi!<br><span class="muted">Quay lại sau khi có thêm người lên đảo nhé.</span></p></div>`}</div>
   ${p ? `<div class="swBtns"><button id="swNo" title="Bỏ qua">✖️</button><button id="swSup" title="Super Like (${d.supers || 0})">⭐</button><button id="swYes" title="Thích">💘</button></div>` : ''}
   <p class="tiny">Lượt thích hôm nay: ${q.used}/${q.max} · Super Like: ${d.supers || 0} · ${(d.hlUntil || 0) > Date.now() ? '✨ Hồ sơ đang nổi bật' : '<a href="#" id="dgShop">Mua thêm lượt / nổi bật bằng Xu</a>'}<br>Xu là tiền ảo – không nạp tiền thật.</p>`);
  $('dgM').onclick = () => openMatches(); $('dgP').onclick = () => openProfile(false); const sh = $('dgShop'); if (sh) sh.onclick = (e) => { e.preventDefault(); G.openShop('dating'); };
  if (!p) return; $('swNo').onclick = () => swipe('pass'); $('swYes').onclick = () => swipe('like'); $('swSup').onclick = () => swipe('super');
  const c = document.querySelector('.pcardD'); let x0 = null; c.onpointerdown = (e) => { x0 = e.clientX; c.setPointerCapture(e.pointerId); };
  c.onpointermove = (e) => { if (x0 === null) return; const dx = e.clientX - x0; c.style.transform = `translateX(${dx}px) rotate(${dx / 15}deg)`; };
  c.onpointerup = (e) => { const dx = e.clientX - (x0 ?? e.clientX); x0 = null; if (dx > 80) swipe('like'); else if (dx < -80) swipe('pass'); else c.style.transform = ''; };
}
const cardHTML = (p) => `<div class="pcardD ${p.hl ? 'hl' : ''}"><div class="av">${p.gender === 'f' ? '👩' : p.gender === 'm' ? '👨' : '🧑'}</div>
  <div style="font-size:20px;font-weight:700">${esc(p.nick)}, ${esc(p.age || '18+')}</div><div class="muted">⭐ Lv.${p.level || 1} ${p.online ? '· 🟢 đang trên đảo' : ''} ${p.hl ? '· ✨ Nổi bật' : ''}</div>
  <p style="margin:8px 0">${esc(p.bio || '')}</p><div>${(p.interests || []).map(k => `<span class="tagI">${INTERESTS[k] || esc(k)}</span>`).join('')}</div>${p.demo ? '<p class="tiny">Hồ sơ NPC demo</p>' : ''}</div>`;
function swipe(kind) { const p = deck[deckI]; if (!p) return; const d = ensureD(); const q = quota();
  if (kind !== 'pass' && q.used >= q.max) { toast('💘 Hết lượt thích hôm nay – mua thêm trong Cửa hàng › Hẹn hò'); return G.openShop('dating'); }
  if (kind === 'super') { if (!(d.supers > 0)) { toast('⭐ Bạn chưa có Super Like – mua trong Cửa hàng'); return G.openShop('dating'); } d.supers--; }
  if (kind !== 'pass') d.likes.n++;
  const c = document.querySelector('.pcardD'); if (c) { c.style.transform = `translateX(${kind === 'pass' ? -400 : 400}px) rotate(${kind === 'pass' ? -25 : 25}deg)`; c.style.opacity = 0; }
  if (p.demo) { d.seen = d.seen || {}; d.seen[p.uid] = kind; if (kind !== 'pass' && (p.likesBack || kind === 'super')) setTimeout(() => onMatch({ id: p.uid, nick: p.nick, npc: p.npc }), 500); }
  else net.send({ t: 'like', to: p.uid, kind });
  save(); deckI++; setTimeout(renderSwipe, 350); }

// ---------- matches ----------
const matchList = () => { const on = net && net.on ? (net.matches || []).map(m => ({ id: m.id, nick: m.nick })) : []; const off = (D() && D().npcMatches || []).map(id => { const n = npcs.find(x => 'npc' + x.id === id); return n && { id, nick: n.name, npc: n }; }).filter(Boolean); return [...on, ...off]; };
function onMatch(w) { const d = ensureD(); if (w.npc) { d.npcMatches = d.npcMatches || []; if (!d.npcMatches.includes(w.id)) d.npcMatches.push(w.id); save(); } else { net.matches = net.matches || []; if (!net.matches.some(x => x.id === w.id)) net.matches.push({ id: w.id, nick: w.nick }); }
  G.sound && G.sound.ctx && chime(); toast(`💞 Tương hợp! Bạn và ${w.nick} đã thích nhau`);
  const o = el('div', { className: 'overlay', style: 'z-index:40' }, `<div class="card" style="text-align:center"><div style="font-size:60px">💞</div><h2 class="neon">IT'S A MATCH!</h2><p>Bạn và <b>${esc(w.nick)}</b> đã thích nhau</p>
   <button class="primary" id="mDM">💬 Nhắn tin ngay</button><button class="pill btn" id="mDate" style="margin-top:8px">💑 Rủ hẹn</button><button class="pill btn" id="mX" style="margin-top:8px">Để sau</button></div>`);
  document.body.append(o); o.querySelector('#mX').onclick = () => o.remove(); o.querySelector('#mDM').onclick = () => { o.remove(); openChat(w); }; o.querySelector('#mDate').onclick = () => { o.remove(); inviteMenu({ uid: w.id, name: w.nick, npc: w.npc }); }; }
function chime() { const c = G.sound.ctx, t = c.currentTime; [659, 784, 988, 1319].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + i * 0.12); g.gain.linearRampToValueAtTime(0.12, t + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.6); o.connect(g).connect(c.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.7); }); }
function openMatches() { const L = matchList();
  G.openPanel(`<h2>💞 Đã ghép đôi (${L.length})</h2><div class="tabs"><button id="dgS">Khám phá</button><button class="sel">💞 Đã ghép</button><button id="dgP2">✏️ Hồ sơ</button></div>
   ${L.map(m => `<div class="item" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;text-align:left"><div style="flex:1"><b>${esc(m.nick)}</b> ${m.npc ? '<small class="muted">(NPC)</small>' : ''}</div>
     <button class="pill btn" data-a="dm" data-id="${m.id}">💬</button><button class="pill btn" data-a="date" data-id="${m.id}">💑 Rủ hẹn</button><button class="pill btn" data-a="cp" data-id="${m.id}">💞</button></div>`).join('') || '<p class="muted">Chưa có ai. Vuốt phải 💘 để thích – nếu người ấy cũng thích bạn sẽ thành cặp!</p>'}`);
  $('dgS').onclick = () => openSwipe(); $('dgP2').onclick = () => openProfile(false);
  $('panelBody').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const m = L.find(x => String(x.id) === b.dataset.id); if (!m) return; const w = { uid: m.id, name: m.nick, npc: m.npc };
    if (b.dataset.a === 'dm') openChat({ id: m.id, nick: m.nick, npc: m.npc }); if (b.dataset.a === 'date') inviteMenu(w); if (b.dataset.a === 'cp') coupleMenu(w); }; }
const NPC_REPLY = ['Hihi chào bạn 😊', 'Bạn đang ở khu nào trên đảo vậy?', 'Tối nay đi bar nghe DJ không? 🎧', 'Mình thích ngồi ghế tình nhân ở bến tàu lúc hoàng hôn lắm 🌅', 'Cà phê ở Cafe Biển Xanh ngon lắm đó ☕', 'Rủ mình đi hẹn đi nè 💕', 'Haha bạn vui tính ghê 😆'];
function openChat(w) { if (!w.npc) return net.openDM(w.id, w.nick); const d = ensureD(); d.npcChat = d.npcChat || {}; const arr = d.npcChat[w.id] = d.npcChat[w.id] || [];
  G.openPanel(`<h2>💬 ${esc(w.nick)} <small class="muted">(NPC demo)</small></h2><div id="dmList" style="max-height:45vh;overflow:auto;display:flex;flex-direction:column;gap:4px">${arr.map(x => `<div class="dmMsg ${x.m ? 'mine' : ''}">${esc(x.t)}</div>`).join('') || '<p class="muted">Gửi lời chào đầu tiên 👋</p>'}</div>
   <form id="dmForm" style="display:flex;gap:6px;margin-top:8px"><input id="dmIn" maxlength="300" style="flex:1" placeholder="Nhắn…"><button class="pill btn">Gửi</button></form>`);
  const L = $('dmList'); L.scrollTop = L.scrollHeight;
  $('dmForm').onsubmit = (e) => { e.preventDefault(); let v = $('dmIn').value.trim(); if (!v) return; v = G.filter ? G.filter(v) : v; arr.push({ m: 1, t: v }); if (arr.length > 40) arr.shift(); save(); openChat(w);
    setTimeout(() => { arr.push({ m: 0, t: NPC_REPLY[Math.floor(Math.random() * NPC_REPLY.length)] }); save(); if ($('dmList')) openChat(w); }, 1200); }; }

// ---------- date invites ----------
function inviteMenu(w) { G.openPanel(`<h2>💑 Rủ ${esc(w.name)} đi hẹn</h2><p class="muted">Chọn địa điểm – hai bạn sẽ được dịch chuyển hoặc chỉ đường tới đó. Ở cạnh nhau 60 giây để hoàn thành buổi hẹn (+20 Xu, +XP).</p>
  <div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow:auto">${Object.entries(PLACES).map(([k, p]) => (p.priv && !Object.entries(PLACES).slice(0, Object.keys(PLACES).indexOf(k)).some(([, q]) => q.priv) ? '<div class="muted" style="margin-top:6px">🔒 Điểm hẹn riêng tư – chỉ hai bạn thấy nhau</div>' : '') + `<button class="pill btn" data-p="${k}" style="text-align:left">${p.name}${p.tag ? ` <small style="color:#ffc94a">${p.tag()}</small>` : ''}</button>`).join('')}</div>`);
  $('panelBody').onclick = (e) => { const k = e.target.closest('[data-p]')?.dataset.p; if (!k) return; if (PLACES[k].gate && !PLACES[k].gate(() => e.target.closest('[data-p]').click())) return; const pos = PLACES[k].get(); G.closePanel();
    if (w.npc) { toast(`💌 ${w.name} đồng ý! Hẹn nhau ở ${PLACES[k].name}`); startDate({ place: k, x: pos.x, z: pos.z, with: { nick: w.name }, npc: w.npc }); }
    else net.send({ t: 'dateInvite', to: w.uid, place: k, x: pos.x, z: pos.z }); }; }
let date = null; const dateHud = el('div', { id: 'dateHud', className: 'hidden', style: 'position:fixed;top:56px;left:50%;transform:translateX(-50%);background:rgba(90,10,60,.85);border:1px solid #ff4fd8;border-radius:12px;padding:6px 12px;z-index:12;font-size:13px;pointer-events:none' }); document.body.append(dateHud);
function startDate(m) { const off = m.npc ? 0 : (Math.random() < 0.5 ? -0.7 : 0.7); const place = m.place;
  const go = (tp) => { if (tp) { if (player.seat && G.standUp) G.standUp(); player.x = m.x + off; player.z = m.z; player.target = null; } else player.target = { x: m.x + off, z: m.z };
    if (place === 'pier' && tp) { const s = benchSpots.find(s => !s.occupant); if (s && G.sitAt) setTimeout(() => G.sitAt(s), 200); } };
  date = { ...m, t: 0, name: m.with.nick }; dateHud.classList.remove('hidden');
  if (PLACES[place] && PLACES[place].enter) { if (m.npc) { const n = m.npc; if (n.spot) { n.spot.occupant = null; n.spot = null; } n.av.seated = false; n.path = []; n.act = 'lovedate'; } PLACES[place].enter(m); return; }
  if (m.npc) { const n = m.npc; if (n.spot) { n.spot.occupant = null; n.spot = null; } n.av.seated = false; n.path = []; n.act = 'lovedate';
    const s = place === 'pier' ? benchSpots.find(s => !s.occupant) : null; if (s) { s.occupant = n; n.spot = s; n.mode = 'act'; n.x = s.x; n.z = s.z; n.yaw = s.rot; n.av.seated = true; n.av.anim = 'sit'; n.baseAnim = 'sit'; n.timer = 95; }
    else { n.x = m.x + 0.8; n.z = m.z + 0.4; n.mode = 'wait'; n.timer = 95; n.av.anim = 'idle'; } G.bubble(n, 'Mình tới rồi nè 💕', 3); }
  const o = el('div', { className: 'overlay', style: 'z-index:40' }, `<div class="card" style="text-align:center"><h2>💑 Hẹn hò với ${esc(date.name)}</h2><p>${PLACES[place] ? PLACES[place].name : ''}</p><button class="primary" id="dgTp">✨ Dịch chuyển ngay</button><button class="pill btn" id="dgWalk" style="margin-top:8px">🚶 Tự đi bộ tới (chỉ đường)</button></div>`);
  document.body.append(o); o.querySelector('#dgTp').onclick = () => { o.remove(); go(true); }; o.querySelector('#dgWalk').onclick = () => { o.remove(); go(false); }; }
G.onFrame.push((dt) => { if (!date) return; let near;
  if (date.npc) near = Math.hypot(date.npc.x - player.x, date.npc.z - player.z) < 6; else { const r = [...net.remotes.values()].find(r => r.uid === date.with.id); near = r ? Math.hypot(r.x - player.x, r.z - player.z) < 12 : false; }
  if (near) date.t += dt; dateHud.textContent = `💑 Hẹn hò với ${date.name} · ${near ? `💕 ${Math.min(60, Math.floor(date.t))}/60s` : '📍 hãy tới gần người ấy'}`;
  if (date.npc && date.t >= 60) finishDate({ with: { nick: date.name }, xu: dailyNpcDate() ? 20 : 0 }); });
const dailyNpcDate = () => { const d = ensureD(); const t = todayBKK(); if (!d.npcDates || d.npcDates.day !== t) d.npcDates = { day: t, n: 0 }; return d.npcDates.n++ < 3; };
function cancelDate() { if (!date) return; date = null; dateHud.classList.add('hidden'); }
function finishDate(m) { if (!date) return; const n = date.npc; date = null; dateHud.classList.add('hidden'); if (m.xu) setXu(m.xu); G.prog && G.prog.add('date'); save();
  toast(`💞 Buổi hẹn với ${m.with.nick} thật tuyệt! ${m.xu ? `+${m.xu} Xu` : ''} +XP`); if (n) { G.bubble(n, 'Hôm nay vui quá, hẹn gặp lại nha 💕', 4); n.timer = 3; }
  [...Array(8)].forEach((_, i) => setTimeout(() => G.react && G.react('heart', false), i * 120)); }

// ---------- couple emotes ----------
const CP = { holdhand: ['🤝 Nắm tay', 8], hug: ['🤗 Ôm', 5], pairdance: ['💃🕺 Nhảy đôi', 12], stargaze: ['🌌 Ngắm sao', 14], toast2: ['🥂 Nâng ly', 5] };
function coupleMenu(w) { G.openPanel(`<h2>💞 Cử chỉ đôi với ${esc(w.name)}</h2><p class="muted">Chỉ dành cho người đã ghép đôi/bạn bè, đứng gần nhau. Người kia sẽ được hỏi đồng ý trước.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${Object.entries(CP).map(([k, v]) => `<button class="pill btn" data-e="${k}">${v[0]}</button>`).join('')}</div>`);
  $('panelBody').onclick = (e) => { const k = e.target.dataset.e; if (!k) return; G.closePanel();
    if (w.npc) { const n = w.npc; if (Math.hypot(n.x - player.x, n.z - player.z) > 8) { n.x = player.x + 1; n.z = player.z; } doCouple(k, { x: n.x, z: n.z }, true, n); }
    else net.send({ t: 'couple', to: w.uid, e: k }); }; }
function doCouple(e, lead, iFollow, npc) { const dur = CP[e][1]; const side = e === 'holdhand' || e === 'stargaze'; const gap = side ? 0.75 : e === 'hug' ? 0.55 : e === 'toast2' ? 0.8 : 0.95;
  if (player.seat && G.standUp) G.standUp(); if (player.dance && G.stopDance) G.stopDance();
  const dx = player.x - lead.x, dz = player.z - lead.z, L = Math.hypot(dx, dz) || 1; let yaw;
  if (side) { yaw = G.dateView != null ? G.dateView() : Math.atan2(W.pier.x - lead.x, W.pier.z1 - lead.z); if (iFollow) { player.x = lead.x + Math.cos(yaw) * gap; player.z = lead.z - Math.sin(yaw) * gap; } }
  else { if (iFollow) { player.x = lead.x + dx / L * gap; player.z = lead.z + dz / L * gap; } yaw = Math.atan2(lead.x - player.x, lead.z - player.z); }
  player.target = null; player.yaw = yaw; player.av.anim = e; player.av.animT = 0; player.emote = e; player.emoteT = dur;
  if (npc) { npc.path = []; npc.mode = 'wait'; npc.timer = dur + 1; npc.yaw = side ? yaw : Math.atan2(player.x - npc.x, player.z - npc.z); npc.tempAnim = e; npc.tempT = dur; npc.av.anim = e; npc.av.animT = 0; G.bubble(npc, e === 'hug' ? '🤗💕' : e === 'holdhand' ? '🤝💕' : e === 'stargaze' ? '🌌✨' : e === 'toast2' ? '🥂 Cạn ly!' : '💃🎶', 2.5); }
  G.react && G.react('heart', false); }

// ---------- network messages ----------
const prevNet = G.onNet; G.onNet = (m) => { switch (m.t) {
  case 'profiles': deck = m.list.map(p => ({ ...p, level: p.level && p.level.L || p.level })); if (!deck.length) deck = demoDeck(); deckI = 0; renderSwipe(); break;
  case 'match': onMatch(m.with); break; case 'liked': break;
  case 'superLike': toast(`⭐ ${m.name} đã Super Like bạn! Mở 💘 Ghép đôi để xem`); break;
  case 'likeLimit': toast(m.msg); G.openShop('dating'); break;
  case 'bought': if (Number.isFinite(m.xu)) { st.xu = m.xu; $('xuVal').textContent = st.xu; } if (!m.ok) { toast(m.msg || 'Không mua được'); break; } applyBuy(m.item); toast('✅ Đã mua: ' + (DSHOP.find(x => x.id === m.item) || {}).name); save(); break;
  case 'dateInvite': { if (net.blocks.has(m.from) || net.muted.has(m.from)) break; const pl = PLACES[m.place]; const o = el('div', { className: 'overlay', style: 'z-index:40' }, `<div class="card" style="text-align:center"><div style="font-size:48px">💌</div><h2>${esc(m.name)} rủ bạn đi hẹn!</h2><p>${pl ? pl.name : ''}</p><button class="primary" id="dA">💕 Đồng ý</button><button class="pill btn" id="dR" style="margin-top:8px">Để lần sau</button></div>`);
    document.body.append(o); o.querySelector('#dA').onclick = () => { o.remove(); net.send({ t: 'dateReply', from: m.from, accept: true, place: m.place, x: m.x, z: m.z }); }; o.querySelector('#dR').onclick = () => { o.remove(); net.send({ t: 'dateReply', from: m.from, accept: false }); }; break; }
  case 'dateGo': if (m.room && m.room !== st.server) { st.server = m.room; save(); net.reconnect(); toast('🏝️ Chuyển sang đảo của người ấy…'); } startDate(m); break;
  case 'dateDone': finishDate(m); break;
  case 'couple': { if (net.blocks.has(m.from)) break; const o = el('div', { className: 'overlay', style: 'z-index:40' }, `<div class="card" style="text-align:center"><h2>💞 ${esc(m.name)} muốn ${CP[m.e][0]}</h2><button class="primary" id="cA">Đồng ý</button><button class="pill btn" id="cR" style="margin-top:8px">Không</button></div>`);
    document.body.append(o); o.querySelector('#cA').onclick = () => { o.remove(); net.send({ t: 'coupleOk', to: m.from, e: m.e }); }; o.querySelector('#cR').onclick = () => o.remove(); setTimeout(() => o.remove(), 15000); break; }
  case 'coupleGo': { const iLead = m.lead.id === net.myId; const other = iLead ? m.follow : m.lead; const lead = iLead ? { x: player.x, z: player.z } : (net.remotes.get(m.lead.id) || m.lead); doCouple(m.e, { x: lead.x, z: lead.z }, !iLead); break; }
  default: prevNet && prevNet(m); } };

// ---------- mock Xu shop items ----------
const DSHOP = [{ id: 'likes10', name: '+10 lượt thích hôm nay', icon: '💘', price: 30, desc: 'Thêm 10 lượt vuốt phải trong ngày', consumable: true },
  { id: 'super', name: 'Super Like', icon: '⭐', price: 40, desc: 'Người ấy được báo ngay là bạn rất thích họ', consumable: true },
  { id: 'highlight', name: 'Nổi bật 24h', icon: '✨', price: 50, desc: 'Hồ sơ lên đầu danh sách, viền vàng 24 giờ', consumable: true }];
function applyBuy(id) { const d = ensureD(); const t = todayBKK(); if (id === 'likes10') d.extraLikes = { day: t, n: (d.extraLikes && d.extraLikes.day === t ? d.extraLikes.n : 0) + 10 }; if (id === 'super') d.supers = (d.supers || 0) + 1; if (id === 'highlight') d.hlUntil = Date.now() + 24 * 3600e3; }
DSHOP.forEach(it => it.onBuy = () => { if (net && net.on) { setXu(it.price); net.flushSave(); net.send({ t: 'buy', item: it.id }); } else { applyBuy(it.id); toast(`✅ Đã mua ${it.icon} ${it.name} (Xu ảo)`); } });
G.SHOP.dating = DSHOP;

Object.assign(G.dating, { PLACES, startDate, finishDate, cancelDate, getDate: () => date, CP, doCouple, inviteMenu, sendCouple: (k, w) => { if (w.npc) { const n = w.npc; if (Math.hypot(n.x - player.x, n.z - player.z) > 8) { n.x = player.x + 1; n.z = player.z; } doCouple(k, { x: n.x, z: n.z }, true, n); } else net.send({ t: 'couple', to: w.uid, e: k }); } });
