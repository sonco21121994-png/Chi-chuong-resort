// VŨ TRƯỜNG (nightclub): open 21:00–02:00 Asia/Saigon, VIP tables + Khu Master booked with virtual Xu (mock),
// host seats you, bouncer at the door, wall fade when inside, badges & special emotes.
import { isOwnerNick, ownerSetFrom } from './owner.js';
const G = window.__game; const { W, st, toast, setXu, save, npcs, player } = G; const C = W.club; const $ = (id) => document.getElementById(id);
const VIP_PRICE = 120, MASTER_PRICE = 250;
// club "night" = Saigon date of (now − 6h) so 00:00–02:00 belongs to the previous evening
const nightKey = () => new Date(Date.now() + 7 * 3600e3 - 6 * 3600e3).toISOString().slice(0, 10);
st.club = st.club || {};
// Owners (config.json "owners", default SonCo5G) keep VIP + Master without spending Xu. Case-insensitive.
let ownerSet = ownerSetFrom();
const isOwner = () => isOwnerNick(ownerSet, G.account && G.account.nick, st.name);
const vipTable = () => st.club.vip && st.club.vip.night === nightKey() ? st.club.vip.table : 0;
const hasMaster = () => isOwner() || !!(st.club.master && st.club.master.night === nightKey());
G.clubBadge = () => hasMaster() ? '👑' : vipTable() ? '🍾' : null;
G.club = { vipTable, hasMaster, nightKey, isOwner };
fetch('config.json', { cache: 'no-store' }).then((r) => r.json()).then((c) => { ownerSet = ownerSetFrom(c.owners); refresh(); }).catch(() => {});

// NPC paths through the gates (NPCs don't collide but should look natural)
const vx = C.x, vz = C.z;
const vipL = C.vipLocal || { x: -1.5, z: -4.5 }, masL = C.masterLocal || { x: -4, z: 6.6 };
for (const T of C.tables) for (const s of T.seats) { s.table = T.n; s.via = [{ x: vx + vipL.x, z: vz + vipL.z + 1.1 }, { x: vx + vipL.x, z: vz + vipL.z - 0.6 }]; }
for (const s of C.master.seats) s.via = [{ x: vx + masL.x + 2.4, z: vz + masL.z }, { x: vx + masL.x + 1.2, z: vz + masL.z }, { x: vx + masL.x, z: vz + masL.z }];

function evictSeats(seats) { for (const s of seats) { const n = s.occupant; if (n && n !== player && npcs.includes(n)) G.goAct(n, 'clubStand'); } }
function applyReservations() { const tn = vipTable(); for (const T of C.tables) { T.seats.forEach(s => s.reserved = T.n === tn); T.label && (T.label.material.opacity = T.n === tn ? 1 : 0.85); } if (tn) evictSeats(C.tables.find(T => T.n === tn).seats); }
function applyGates() { const v = !!vipTable() || hasMaster(), m = hasMaster(); C.vipGate.on = !v; C.vipGateMesh.visible = !v; C.masterGate.on = !m; C.masterGateMesh.visible = !m; }
function refresh() { applyReservations(); applyGates(); G.updateTag && G.updateTag(); save(); }

// ---- shop tab (mock booking, virtual Xu only) ----
G.SHOP.club = [
  ...C.tables.map(T => ({ id: 'clubvip' + T.n, icon: '🍾', name: `Bàn VIP ${T.n} – tối nay`, price: VIP_PRICE, consumable: true,
    get desc() { return isOwner() ? '👑 Chủ đảo vào mọi bàn VIP, không trừ Xu.' : vipTable() === T.n ? '✅ Bạn đã đặt bàn này tối nay. Gặp Chị Hằng ở cổng VIP để được dẫn vào.' : 'Sofa riêng, champagne & pháo que, khu dây nhung. Hiệu lực tới 02:00.'; },
    onBuy() { if (isOwner()) { setXu(VIP_PRICE); return toast('👑 Chủ đảo vào VIP miễn phí – không cần đặt bàn'); } if (vipTable() === T.n) { setXu(VIP_PRICE); return toast('Bạn đã đặt bàn này rồi'); } if (vipTable()) setXu(Math.round(VIP_PRICE / 2)); st.club.vip = { night: nightKey(), table: T.n }; refresh(); toast(`🍾 Đã đặt Bàn VIP ${T.n} cho tối nay! Gặp lễ tân để được dẫn vào bàn.`); G.logChat('Vũ Trường', `Đặt bàn VIP ${T.n} (Xu ảo) – đêm ${nightKey()}`); } })),
  { id: 'clubmaster', icon: '👑', name: 'Vé Khu Master – tối nay', price: MASTER_PRICE, consumable: true,
    get desc() { return isOwner() ? '👑 Chủ đảo có vé Master vĩnh viễn.' : hasMaster() ? '✅ Đã có vé tối nay – lên ban công vàng ngắm DJ!' : 'Ban công vàng tầng lửng, view đẹp nhất về DJ booth. Gồm quyền vào khu VIP. Hiệu lực tới 02:00.'; },
    onBuy() { if (isOwner()) { setXu(MASTER_PRICE); return toast('👑 Chủ đảo có vé Master vĩnh viễn'); } if (hasMaster()) { setXu(MASTER_PRICE); return toast('Bạn đã có vé Master tối nay'); } st.club.master = { night: nightKey() }; refresh(); toast('👑 Đã mua vé Khu Master tối nay!'); G.logChat('Vũ Trường', `Vé Khu Master (Xu ảo) – đêm ${nightKey()}`); } },
];

// ---- seat gating ----
G.seatGate = (s) => {
  if (s.clubZone === 'vip') { if (!clubIsOpen()) { toast('Vũ Trường đang đóng cửa – mở 21h'); return false; } if (isOwner()) return true; if (hasMaster() && !vipTable()) { toast('Vé Master không gồm ghế bàn VIP – mời lên ban công 👑'); return false; } if (vipTable() !== s.table) { toast(vipTable() ? `Bàn của bạn là Bàn VIP ${vipTable()}` : `🔒 Bàn VIP ${s.table} – đặt bàn trong Cửa hàng`); if (!vipTable()) G.openShop('club'); return false; } }
  if (s.clubZone === 'master' && !hasMaster()) { toast('🔒 Khu Master – cần vé Master tối nay'); G.openShop('club'); return false; }
  return true;
};

// ---- host dialog: seats you ----
function seatMe(seats) { const s = seats.find(x => !x.occupant) || seats[0]; if (s.occupant && s.occupant !== player) G.goAct(s.occupant, 'clubStand'); if (player.seat) G.standUp(); if (player.dance) G.stopDance(); player.x = s.x + Math.sin(s.rot) * 0.7; player.z = s.z + Math.cos(s.rot) * 0.7; player.y = s.y || 0; G.sitAt(s); }
function openHost() {
  const own = isOwner(), tn = vipTable(), m = hasMaster(), open = clubIsOpen();
  const vipLine = own ? '👑 <b>Chủ đảo</b> – mọi bàn VIP, không trừ Xu' : (tn ? `🍾 <b>Bàn VIP ${tn}</b> – đêm ${nightKey()}` : '— Chưa đặt bàn VIP');
  const masLine = own ? '👑 <b>Vé Khu Master vĩnh viễn</b>' : (m ? `👑 <b>Vé Khu Master</b> – đêm ${nightKey()}` : '— Chưa có vé Master');
  G.openPanel(`<h2>🛎️ Chị Hằng – Lễ tân VIP</h2><p>${open ? 'Chào mừng tới Vũ Trường! Em xem đặt chỗ của mình nha…' : 'Vũ Trường mở cửa từ 21h tới 02h. Bạn vẫn có thể đặt trước cho tối nay.'}</p>
  <p>${vipLine}<br>${masLine}</p>
  <div class="row">${(own || tn) && open ? `<button data-h="vip">🍾 Dẫn tôi vào bàn${tn ? ' ' + tn : ''}</button>` : ''}${m && open ? '<button data-h="master">👑 Lên Khu Master</button>' : ''}${own ? '' : '<button data-h="shop">🛍️ Đặt chỗ (Xu ảo)</button>'}</div>
  <p class="note">${own ? 'Cổng VIP và Master đang mở. Ngồi bất kỳ bàn VIP nào.' : 'Đặt chỗ mô phỏng bằng Xu ảo, hết hạn lúc 02:00. Không thanh toán thật.'}</p>`);
  $('panelBody').onclick = (e) => { const h = e.target.dataset.h; if (!h) return; if (h === 'shop') return G.openShop('club'); G.closePanel();
    if (h === 'vip') { const table = (tn && C.tables.find(T => T.n === tn)) || C.tables[0]; seatMe(table.seats); toast(own && !tn ? 'Mời chủ đảo vào khu VIP 👑 – ngồi bàn nào cũng được' : `Mời bạn vào Bàn VIP ${table.n} 🍾`); }
    if (h === 'master') { seatMe(C.master.seats); toast('Mời bạn lên Khu Master 👑 – view đẹp nhất về DJ!'); } };
}

// ---- special emotes ----
function myTable() { const s = player.seat; if (s && s.clubZone === 'vip') return C.tables.find(T => T.n === s.table); if (isOwner()) { const near = C.tables.find(T => Math.hypot(T.x - player.x, T.z - player.z) < 3.2); if (near) return near; } if (vipTable()) { const T = C.tables.find(T => T.n === vipTable()); if (Math.hypot(T.x - player.x, T.z - player.z) < 3) return T; } return null; }
function champagne(who, mine) { const y = (who.y || 0) + 1.8; G.floatEmoji && G.floatEmoji('🍾', who.x, y, who.z, 2); G.floatEmoji && G.floatEmoji('🥂', who.x, y + 0.3, who.z, 5); G.floatEmoji && G.floatEmoji('✨', who.x, y + 0.5, who.z, 6); if (mine) { G.bubble(player, '🍾 Khui champagne! Dzô!!', 2.5); npcs.filter(n => Math.hypot(n.x - player.x, n.z - player.z) < 5 && !n.staff).slice(0, 4).forEach(n => { n.tempAnim = 'cheers'; n.tempT = 1.8; n.av.anim = 'cheers'; n.av.animT = 0; G.bubble(n, G.pick(['Dzô! 🥂', 'Chúc mừng!! 🍾', 'Sang quá 😍']), 2.4); }); } }
function sparkler(who, mine) { const T = C.tables.reduce((a, b) => Math.hypot(b.x - who.x, b.z - who.z) < Math.hypot(a.x - who.x, a.z - who.z) ? b : a); if (Math.hypot(T.x - who.x, T.z - who.z) < 4) T.sparkOn = G.now() + 10; G.floatEmoji && G.floatEmoji('🎇', who.x, (who.y || 0) + 2, who.z, 6); if (mine) G.bubble(player, '🎇 Pháo que lên!', 2.4); }
function goldRain(who, mine) { G.floatEmoji && G.floatEmoji('👑', who.x, (who.y || 0) + 2, who.z, 3); G.floatEmoji && G.floatEmoji('💛', who.x, (who.y || 0) + 2, who.z, 8); if (mine) G.bubble(player, '👑 Master in the house!', 2.4); }
function special(e) { G.doEmote('cheers'); const f = { champagne, sparkler, goldrain: goldRain }[e]; f(player, true); G.net && G.net.on && G.net.send({ t: 'emote', e }); G.prog && G.prog.addXP && G.prog.addXP(3, e); }
const _rem = G.onRemoteEmote; G.onRemoteEmote = (r, e) => { _rem && _rem(r, e); const f = { champagne, sparkler, goldrain: goldRain }[e]; if (f) f(r, false); };

// events.js awaits config.json, so it can finish AFTER this module. Read the playtest flag here.
const clubAlways = /^(1|true|yes|on)$/i.test(new URLSearchParams(location.search).get('clubAlways') || '');
const clubIsOpen = () => clubAlways || !!(G.venueOpen && G.venueOpen('club'));

// Walk through the west door (center line). Touch uses this instead of threading the gap with the stick.
function enterClub(opts = {}) {
  const open = clubIsOpen();
  if (!open) { toast('🪩 Vũ Trường đang đóng cửa. Mở 21:00–02:00 (giờ Việt Nam).'); return false; }
  if (!C.open) C.setOpen(true);
  const e = W.venues.club.entry, inn = W.venues.club.inner;
  if (player.seat) G.standUp(); if (player.dance) G.stopDance();
  if (C.contains(player.x, player.z)) { toast('Bạn đang ở trong Vũ Trường'); return true; }
  const nearMat = Math.hypot(player.x - e.x, player.z - e.z) < 2.4;
  player.yaw = Math.PI / 2;
  if (G.cam) G.cam.yaw = -Math.PI / 2;
  if (nearMat) player.target = { x: inn.x, z: inn.z };
  else if (opts.warp) { player.x = e.x; player.z = e.z; player.y = W.walkY(e.x, e.z); player.target = { x: inn.x, z: inn.z }; }
  else { player.target = { x: e.x, z: e.z }; player.afterArrive = () => { player.target = { x: inn.x, z: inn.z }; player.yaw = Math.PI / 2; }; }
  toast('🪩 Đang vào Vũ Trường…');
  return true;
}
G.enterClub = enterClub;

// ---- context buttons ----
(G.ctxExtra = G.ctxExtra || []).push((btns, px, pz) => {
  const entry = W.venues.club.entry;
  const nearEntry = Math.hypot(px - entry.x, pz - entry.z) < 7 || Math.hypot(px - (vx - C.hw), pz - vz) < 5.5;
  if (!C.inside && nearEntry) btns.unshift(clubIsOpen() ? ['🪩 Vào Vũ Trường', () => enterClub()] : ['🕘 Vũ Trường đóng cửa', () => toast('🪩 Vũ Trường đang đóng cửa. Mở 21:00–02:00 (giờ Việt Nam).')]);
  if (!C.inside && !C.near) return;
  const host = npcs.find(n => n.staff === 'host'); if (host && Math.hypot(host.x - px, host.z - pz) < 3) btns.unshift(['🛎️ Lễ tân VIP – Chị Hằng', openHost]);
  const bo = npcs.find(n => n.staff === 'bouncer'); if (bo && !G.venueOpen('club') && Math.hypot(bo.x - px, bo.z - pz) < 4) btns.unshift(['🕘 Hỏi giờ mở cửa', () => { G.bubble(bo, 'Tối nay 21h mở cửa nha, tới 2h sáng. Nhớ mang theo tinh thần quẩy! 😎', 4); }]);
  if (C.inside && myTable() && G.venueOpen('club')) btns.unshift(['🍾 Khui champagne', () => special('champagne')], ['🎇 Pháo que', () => special('sparkler')]);
  if (C.inside && hasMaster() && C.master.contains(px, pz)) btns.unshift(['👑 Mưa vàng', () => special('goldrain')], ['🥂 Nâng ly Master', () => special('champagne')], ['🤘 Rock tay', () => G.doEmote('rock')]);
  if (C.inside && hasMaster() && C.master.contains(px, pz) && C.bossSeat && !G.player.seat) btns.unshift(['👑 Ngồi ghế boss', () => G.sitAt(C.bossSeat)]);
  if (!btns.some(b => b[0] === '🤘 Rock tay') && C.inside && (myTable() || hasMaster()) && G.player.seat && G.player.seat.clubZone) btns.unshift(['🤘 Rock tay', () => G.doEmote('rock')]);
  if (C.inside && !vipTable() && !hasMaster() && Math.hypot(px - (vx + vipL.x), pz - (vz + vipL.z)) < 2.2) btns.unshift(['🔒 Khu VIP – đặt bàn', () => G.openShop('club')]);
  if (C.inside && !hasMaster() && Math.hypot(px - (vx + masL.x), pz - (vz + masL.z)) < 2.2) btns.unshift(['🔒 Khu Master – mua vé', () => G.openShop('club')]);
});

// when the doors open, a good part of the island heads to the club (night owls)
function pullCrowd() { const pool = npcs.filter(n => !n.staff && !n.dateWith && !(n.spot && n.spot.venue === 'club')); const want = Math.round(npcs.length * 0.4) - npcs.filter(n => n.spot && n.spot.venue === 'club').length; if (want <= 0) return;
  const W8 = [['clubDance', 5], ['clubCrowd', 2], ['clubBar', 2], ['clubStand', 2], ['clubVip', 1.2], ['clubMaster', 0.6]], tot = W8.reduce((a, b) => a + b[1], 0);
  const far = (n) => !C.inside && Math.hypot(n.x - player.x, n.z - player.z) > 18; // teleport only when nobody is watching
  pool.sort(() => Math.random() - 0.5).slice(0, want).forEach((n, i) => { let r = Math.random() * tot, k = W8[0][0]; for (const [a, w] of W8) { if ((r -= w) < 0) { k = a; break; } } if (far(n) || !G.isPlaying()) { if (!G.goActNow(n, k)) G.goAct(n, k); } else setTimeout(() => { if (C.open) G.goAct(n, k); }, i * 180); }); }
G.club.pullCrowd = pullCrowd;
// ---- per frame: open/close, inside detection, wall fade, eviction, audio distance ----
let wasOpen = null, fade = 1, tick = 0, lastNight = nightKey();
G.clubDist = () => !C.open ? 99 : C.inside ? 0 : Math.max(0, Math.hypot(player.x - C.x, player.z - C.z) - 6) * 1.8;
G.onFrame.push((dt) => {
  const px = player.x, pz = player.z; C.inside = C.contains(px, pz); C.near = Math.hypot(px - C.x, pz - C.z) < 26;
  updateClubMusic();
  const camIn = C.contains(G.camera.position.x, G.camera.position.z) || C.inside; const tgt = camIn ? 0.12 : 1; fade += (tgt - fade) * Math.min(1, dt * 6);
  C.wallM.opacity = fade; C.wallM.depthWrite = fade > 0.9; C.roof.visible = !camIn; C.facade.visible = !camIn;
  if ((tick -= dt) > 0) return; tick = 0.5;
  const open = clubIsOpen();
  if (open !== wasOpen) { C.setOpen(open);
    if (wasOpen && !open) { // closing time: everybody out
      npcs.forEach(n => { if (!n.staff && n.spot && n.spot.venue === 'club') G.goAct(n, G.venueOpen('bar') ? 'barStand' : 'shore'); });
      if (C.inside) { if (player.seat) G.standUp(); if (player.dance) G.stopDance(); const e = W.venues.club.entry; player.x = e.x - 1; player.z = e.z; player.y = 0; player.target = null; toast('🌙 Vũ Trường đã đóng cửa (02h). Hẹn gặp lại tối mai!'); }
    }
    if (open) pullCrowd();
    if (open && wasOpen === false) G.logChat('Vũ Trường', '🪩 Vũ Trường đã mở cửa! DJ Funny đang warm-up 🎶');
    wasOpen = open; }
  if (nightKey() !== lastNight) { lastNight = nightKey(); refresh(); }
  if (!open && C.doorBox) {
    const b = C.doorBox, px2 = player.x, pz2 = player.z, pad = 0.7;
    const against = px2 >= b.minX - pad && px2 <= b.maxX + pad && pz2 >= b.minZ - pad && pz2 <= b.maxZ + pad;
    if (against && (!C._shutAt || G.now() - C._shutAt > 8)) { C._shutAt = G.now(); toast('🪩 Vũ Trường đang đóng cửa. Mở 21:00–02:00 (giờ Việt Nam).'); }
  }
  // stand up from a club seat whose booking expired
  if (player.seat && player.seat.clubZone && !G.seatGate(player.seat)) G.standUp();
});
// Open the door now for the playtest URL. events.js may still be awaiting config.json.
const adminPreview = new URLSearchParams(location.search).has('admin');
if (clubAlways) C.setOpen(true);
if (clubAlways || adminPreview) {
  const go = document.createElement('button'); go.id = 'clubGo'; go.type = 'button'; go.className = 'pill btn'; go.textContent = '🪩 Vào Vũ Trường';
  go.hidden = !clubIsOpen();
  go.onclick = (e) => { e.stopPropagation(); enterClub({ warp: true }); };
  $('hud').appendChild(go);
  G.onFrame.push(() => { const show = clubIsOpen() && G.isPlaying(); if (go.hidden === show) go.hidden = !show; });
  if (clubAlways) G.onEnter.push(() => setTimeout(() => toast('🪩 Cửa Vũ Trường đang mở để xem thử. Bấm «Vào Vũ Trường».'), 900));
}
refresh();

// Temporary vũ trường bed. Direct SoundCloud MP3 is CORS-blocked on mobile Safari,
// so this uses the official widget iframe (w.soundcloud.com/player + api.js). Part 1 then Part 2, then loop.
// Beer bar keeps the built-in synth.
const SC_TRACKS = [
  'https://soundcloud.com/viet-linh-doan/mixtape-vinahouse-la-bat-diet-special-30h-dj-linhlee-ft-54-dj-28-mc-part-1-15h10',
  'https://soundcloud.com/viet-linh-doan/mixtape-vinahouse-la-bat-diet-special-dj-linhlee-ft-54-dj-28-mc-part-2-15h09',
];
const scBox = document.createElement('div'); scBox.id = 'clubScBox'; scBox.setAttribute('aria-hidden', 'true');
const scFrame = document.createElement('iframe');
scFrame.id = 'clubSc'; scFrame.title = 'Nhạc Vũ Trường'; scFrame.allow = 'autoplay; encrypted-media';
scFrame.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(SC_TRACKS[0]) + '&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false&buying=false&sharing=false&download=false&show_artwork=false';
scBox.appendChild(scFrame); document.body.appendChild(scBox);
const scStyle = document.createElement('style'); scStyle.textContent = '#clubScBox{position:fixed;left:0;bottom:0;width:300px;height:166px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1}#clubSc{width:300px;height:166px;border:0}';
document.head.appendChild(scStyle);
let scWidget = null, scReady = false, scPlaying = false, scVol = -1, scGesture = 0, scIndex = 0, scLoading = false;
function loadScApi() { return new Promise((res) => { if (window.SC && window.SC.Widget) return res(); const s = document.createElement('script'); s.src = 'https://w.soundcloud.com/player/api.js'; s.onload = () => res(); s.onerror = () => res(); document.head.appendChild(s); }); }
function scLoad(index, auto) {
  if (!scWidget) return;
  scIndex = (index + SC_TRACKS.length) % SC_TRACKS.length;
  scLoading = true; scPlaying = false;
  scWidget.load(SC_TRACKS[scIndex], { auto_play: !!auto, hide_related: true, show_comments: false, show_user: false, show_reposts: false, visual: false, callback() {
    scLoading = false; scReady = true;
    try { scWidget.setVolume(scVol < 0 ? 0 : scVol); } catch (e) {}
    if (auto && clubMusicVol() > 0) { try { scWidget.play(); } catch (e) {} }
  } });
}
loadScApi().then(() => { if (!(window.SC && window.SC.Widget)) return; scWidget = window.SC.Widget(scFrame);
  scWidget.bind(window.SC.Widget.Events.READY, () => { scReady = true; try { scWidget.setVolume(0); } catch (e) {} });
  scWidget.bind(window.SC.Widget.Events.PLAY, () => { scPlaying = true; });
  scWidget.bind(window.SC.Widget.Events.PAUSE, () => { scPlaying = false; });
  scWidget.bind(window.SC.Widget.Events.FINISH, () => { scPlaying = false; if (!scLoading) scLoad(scIndex + 1, clubMusicVol() > 0); });
});
function clubMusicVol() {
  if (!G.isPlaying() || (G.muted && G.muted())) return 0;
  if (G.LIVE && G.LIVE.streamOn) return 0;
  if (!clubIsOpen()) return 0;
  if (C.inside) return 80;
  const d = Math.max(0, Math.hypot(player.x - C.x, player.z - C.z) - (C.hw || 8));
  if (d > 18) return 0;
  return Math.round(70 * (1 - d / 18));
}
function scPlay() { if (!scReady) return; try { scWidget.play(); } catch (e) {} }
function updateClubMusic() {
  if (!scReady) return;
  const vol = clubMusicVol();
  if (vol !== scVol) { scVol = vol; try { scWidget.setVolume(vol); } catch (e) {} }
  if (vol > 0) { if (!scPlaying && performance.now() - scGesture < 2500) scPlay(); }
  else if (scPlaying) { try { scWidget.pause(); } catch (e) {} }
}
G.clubTrack = { on: () => scReady, url: SC_TRACKS[0], urls: SC_TRACKS };
addEventListener('pointerdown', () => { scGesture = performance.now(); if (scReady && clubMusicVol() > 0) scPlay(); });
G.onEnter.push(() => { scGesture = performance.now(); scPlay(); });
