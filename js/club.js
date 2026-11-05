// VŨ TRƯỜNG (nightclub): open 21:00–02:00 Asia/Saigon, VIP tables + Khu Master booked with virtual Xu (mock),
// host seats you, bouncer at the door, wall fade when inside, badges & special emotes.
const G = window.__game; const { W, st, toast, setXu, save, npcs, player } = G; const C = W.club; const $ = (id) => document.getElementById(id);
const VIP_PRICE = 120, MASTER_PRICE = 250;
// club "night" = Saigon date of (now − 6h) so 00:00–02:00 belongs to the previous evening
const nightKey = () => new Date(Date.now() + 7 * 3600e3 - 6 * 3600e3).toISOString().slice(0, 10);
st.club = st.club || {};
const vipTable = () => st.club.vip && st.club.vip.night === nightKey() ? st.club.vip.table : 0;
const hasMaster = () => !!(st.club.master && st.club.master.night === nightKey());
G.clubBadge = () => hasMaster() ? '👑' : vipTable() ? '🍾' : null;
G.club = { vipTable, hasMaster, nightKey };

// NPC paths through the gates (NPCs don't collide but should look natural)
const vx = C.x, vz = C.z;
for (const T of C.tables) for (const s of T.seats) { s.table = T.n; s.via = [{ x: vx - 1.5, z: vz - 3.6 }, { x: vx - 1.5, z: vz - 5.2 }]; }
for (const s of C.master.seats) s.via = [{ x: vx - 1.8, z: vz + 6.6 }, { x: vx - 2.5, z: vz + 6.6 }, { x: vx - 3.7, z: vz + 6.6 }, { x: vx - 4.7, z: vz + 6.6 }];

function evictSeats(seats) { for (const s of seats) { const n = s.occupant; if (n && n !== player && npcs.includes(n)) G.goAct(n, 'clubStand'); } }
function applyReservations() { const tn = vipTable(); for (const T of C.tables) { T.seats.forEach(s => s.reserved = T.n === tn); T.label && (T.label.material.opacity = T.n === tn ? 1 : 0.85); } if (tn) evictSeats(C.tables.find(T => T.n === tn).seats); }
function applyGates() { const v = !!vipTable() || hasMaster(), m = hasMaster(); C.vipGate.on = !v; C.vipGateMesh.visible = !v; C.masterGate.on = !m; C.masterGateMesh.visible = !m; }
function refresh() { applyReservations(); applyGates(); G.updateTag && G.updateTag(); save(); }

// ---- shop tab (mock booking, virtual Xu only) ----
G.SHOP.club = [
  ...C.tables.map(T => ({ id: 'clubvip' + T.n, icon: '🍾', name: `Bàn VIP ${T.n} – tối nay`, price: VIP_PRICE, consumable: true,
    get desc() { return vipTable() === T.n ? '✅ Bạn đã đặt bàn này tối nay. Gặp Chị Hằng ở cổng VIP để được dẫn vào.' : 'Sofa riêng, champagne & pháo que, khu dây nhung. Hiệu lực tới 02:00.'; },
    onBuy() { if (vipTable() === T.n) { setXu(VIP_PRICE); return toast('Bạn đã đặt bàn này rồi'); } if (vipTable()) setXu(Math.round(VIP_PRICE / 2)); st.club.vip = { night: nightKey(), table: T.n }; refresh(); toast(`🍾 Đã đặt Bàn VIP ${T.n} cho tối nay! Gặp lễ tân để được dẫn vào bàn.`); G.logChat('Vũ Trường', `Đặt bàn VIP ${T.n} (Xu ảo) – đêm ${nightKey()}`); } })),
  { id: 'clubmaster', icon: '👑', name: 'Vé Khu Master – tối nay', price: MASTER_PRICE, consumable: true,
    get desc() { return hasMaster() ? '✅ Đã có vé tối nay – lên ban công vàng ngắm DJ!' : 'Ban công vàng tầng lửng, view đẹp nhất về DJ booth. Gồm quyền vào khu VIP. Hiệu lực tới 02:00.'; },
    onBuy() { if (hasMaster()) { setXu(MASTER_PRICE); return toast('Bạn đã có vé Master tối nay'); } st.club.master = { night: nightKey() }; refresh(); toast('👑 Đã mua vé Khu Master tối nay!'); G.logChat('Vũ Trường', `Vé Khu Master (Xu ảo) – đêm ${nightKey()}`); } },
];

// ---- seat gating ----
G.seatGate = (s) => {
  if (s.clubZone === 'vip') { if (!G.venueOpen('club')) { toast('Vũ Trường đang đóng cửa – mở 21h'); return false; } if (hasMaster() && !vipTable()) { toast('Vé Master không gồm ghế bàn VIP – mời lên ban công 👑'); return false; } if (vipTable() !== s.table) { toast(vipTable() ? `Bàn của bạn là Bàn VIP ${vipTable()}` : `🔒 Bàn VIP ${s.table} – đặt bàn trong Cửa hàng`); if (!vipTable()) G.openShop('club'); return false; } }
  if (s.clubZone === 'master' && !hasMaster()) { toast('🔒 Khu Master – cần vé Master tối nay'); G.openShop('club'); return false; }
  return true;
};

// ---- host dialog: seats you ----
function seatMe(seats) { const s = seats.find(x => !x.occupant) || seats[0]; if (s.occupant && s.occupant !== player) G.goAct(s.occupant, 'clubStand'); if (player.seat) G.standUp(); if (player.dance) G.stopDance(); player.x = s.x + Math.sin(s.rot) * 0.7; player.z = s.z + Math.cos(s.rot) * 0.7; player.y = s.y || 0; G.sitAt(s); }
function openHost() {
  const tn = vipTable(), m = hasMaster(), open = G.venueOpen('club');
  G.openPanel(`<h2>🛎️ Chị Hằng – Lễ tân VIP</h2><p>${open ? 'Chào mừng tới Vũ Trường! Em xem đặt chỗ của mình nha…' : 'Vũ Trường mở cửa từ 21h tới 02h. Bạn vẫn có thể đặt trước cho tối nay.'}</p>
  <p>${tn ? `🍾 <b>Bàn VIP ${tn}</b> – đêm ${nightKey()}` : '— Chưa đặt bàn VIP'}<br>${m ? `👑 <b>Vé Khu Master</b> – đêm ${nightKey()}` : '— Chưa có vé Master'}</p>
  <div class="row">${tn && open ? '<button data-h="vip">🍾 Dẫn tôi vào bàn</button>' : ''}${m && open ? '<button data-h="master">👑 Lên Khu Master</button>' : ''}<button data-h="shop">🛍️ Đặt chỗ (Xu ảo)</button></div>
  <p class="note">Đặt chỗ mô phỏng bằng Xu ảo, hết hạn lúc 02:00. Không thanh toán thật.</p>`);
  $('panelBody').onclick = (e) => { const h = e.target.dataset.h; if (!h) return; if (h === 'shop') return G.openShop('club'); G.closePanel();
    if (h === 'vip') { seatMe(C.tables.find(T => T.n === tn).seats); toast(`Mời bạn vào Bàn VIP ${tn} 🍾`); }
    if (h === 'master') { seatMe(C.master.seats); toast('Mời bạn lên Khu Master 👑 – view đẹp nhất về DJ!'); } };
}

// ---- special emotes ----
function myTable() { const s = player.seat; if (s && s.clubZone === 'vip') return C.tables.find(T => T.n === s.table); if (vipTable()) { const T = C.tables.find(T => T.n === vipTable()); if (Math.hypot(T.x - player.x, T.z - player.z) < 3) return T; } return null; }
function champagne(who, mine) { const y = (who.y || 0) + 1.8; G.floatEmoji && G.floatEmoji('🍾', who.x, y, who.z, 2); G.floatEmoji && G.floatEmoji('🥂', who.x, y + 0.3, who.z, 5); G.floatEmoji && G.floatEmoji('✨', who.x, y + 0.5, who.z, 6); if (mine) { G.bubble(player, '🍾 Khui champagne! Dzô!!', 2.5); npcs.filter(n => Math.hypot(n.x - player.x, n.z - player.z) < 5 && !n.staff).slice(0, 4).forEach(n => { n.tempAnim = 'cheers'; n.tempT = 1.8; n.av.anim = 'cheers'; n.av.animT = 0; G.bubble(n, G.pick(['Dzô! 🥂', 'Chúc mừng!! 🍾', 'Sang quá 😍']), 2.4); }); } }
function sparkler(who, mine) { const T = C.tables.reduce((a, b) => Math.hypot(b.x - who.x, b.z - who.z) < Math.hypot(a.x - who.x, a.z - who.z) ? b : a); if (Math.hypot(T.x - who.x, T.z - who.z) < 4) T.sparkOn = G.now() + 10; G.floatEmoji && G.floatEmoji('🎇', who.x, (who.y || 0) + 2, who.z, 6); if (mine) G.bubble(player, '🎇 Pháo que lên!', 2.4); }
function goldRain(who, mine) { G.floatEmoji && G.floatEmoji('👑', who.x, (who.y || 0) + 2, who.z, 3); G.floatEmoji && G.floatEmoji('💛', who.x, (who.y || 0) + 2, who.z, 8); if (mine) G.bubble(player, '👑 Master in the house!', 2.4); }
function special(e) { G.doEmote('cheers'); const f = { champagne, sparkler, goldrain: goldRain }[e]; f(player, true); G.net && G.net.on && G.net.send({ t: 'emote', e }); G.prog && G.prog.addXP && G.prog.addXP(3, e); }
const _rem = G.onRemoteEmote; G.onRemoteEmote = (r, e) => { _rem && _rem(r, e); const f = { champagne, sparkler, goldrain: goldRain }[e]; if (f) f(r, false); };

// ---- context buttons ----
(G.ctxExtra = G.ctxExtra || []).push((btns, px, pz) => {
  if (!C.inside && !C.near) return;
  const host = npcs.find(n => n.staff === 'host'); if (host && Math.hypot(host.x - px, host.z - pz) < 3) btns.unshift(['🛎️ Lễ tân VIP – Chị Hằng', openHost]);
  const bo = npcs.find(n => n.staff === 'bouncer'); if (bo && !G.venueOpen('club') && Math.hypot(bo.x - px, bo.z - pz) < 4) btns.unshift(['🕘 Hỏi giờ mở cửa', () => { G.bubble(bo, 'Tối nay 21h mở cửa nha, tới 2h sáng. Nhớ mang theo tinh thần quẩy! 😎', 4); }]);
  if (C.inside && myTable() && G.venueOpen('club')) btns.unshift(['🍾 Khui champagne', () => special('champagne')], ['🎇 Pháo que', () => special('sparkler')]);
  if (C.inside && hasMaster() && C.master.contains(px, pz)) btns.unshift(['👑 Mưa vàng', () => special('goldrain')], ['🥂 Nâng ly Master', () => special('champagne')], ['🤘 Rock tay', () => G.doEmote('rock')]);
  if (C.inside && hasMaster() && C.master.contains(px, pz) && C.bossSeat && !G.player.seat) btns.unshift(['👑 Ngồi ghế boss', () => G.sitAt(C.bossSeat)]);
  if (!btns.some(b => b[0] === '🤘 Rock tay') && C.inside && (myTable() || hasMaster()) && G.player.seat && G.player.seat.clubZone) btns.unshift(['🤘 Rock tay', () => G.doEmote('rock')]);
  if (C.inside && !vipTable() && !hasMaster() && Math.hypot(px - (vx - 1.5), pz - (vz - 4.5)) < 2.2) btns.unshift(['🔒 Khu VIP – đặt bàn', () => G.openShop('club')]);
  if (C.inside && !hasMaster() && Math.hypot(px - (vx - 3.2), pz - (vz + 6.6)) < 2) btns.unshift(['🔒 Khu Master – mua vé', () => G.openShop('club')]);
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
  const camIn = C.contains(G.camera.position.x, G.camera.position.z) || C.inside; const tgt = camIn ? 0.12 : 1; fade += (tgt - fade) * Math.min(1, dt * 6);
  C.wallM.opacity = fade; C.wallM.depthWrite = fade > 0.9; C.roof.visible = !camIn; C.facade.visible = !camIn;
  if ((tick -= dt) > 0) return; tick = 0.5;
  const open = G.venueOpen ? G.venueOpen('club') : false;
  if (open !== wasOpen) { C.setOpen(open);
    if (wasOpen && !open) { // closing time: everybody out
      npcs.forEach(n => { if (!n.staff && n.spot && n.spot.venue === 'club') G.goAct(n, G.venueOpen('bar') ? 'barStand' : 'shore'); });
      if (C.inside) { if (player.seat) G.standUp(); if (player.dance) G.stopDance(); const e = W.venues.club.entry; player.x = e.x - 1; player.z = e.z; player.y = 0; player.target = null; toast('🌙 Vũ Trường đã đóng cửa (02h). Hẹn gặp lại tối mai!'); }
    }
    if (open) pullCrowd();
    if (open && wasOpen === false) G.logChat('Vũ Trường', '🪩 Vũ Trường đã mở cửa! DJ Mây đang warm-up 🎶');
    wasOpen = open; }
  if (nightKey() !== lastNight) { lastNight = nightKey(); refresh(); }
  // stand up from a club seat whose booking expired
  if (player.seat && player.seat.clubZone && !G.seatGate(player.seat)) G.standUp();
});
refresh();
