// Levels, XP, titles, daily quests, weekly/all-time leaderboards (server via G.net, local fallback).
const G = window.__game; const { W, st, toast, setXu, save } = G;
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const bkk = (ms = Date.now()) => new Date(ms + 7 * 3600e3);
const today = () => bkk().toISOString().slice(0, 10);
export const weekId = (ms = Date.now()) => { const d = bkk(ms); const dow = (d.getUTCDay() + 6) % 7; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10); }; // Monday (GMT+7)

const P = st.prog = Object.assign({ xp: 0, stats: {}, week: { id: weekId() }, titles: { tanbinh: 1 }, title: 'tanbinh', quests: null, wkRewards: {} }, st.prog || {});
let S = P.stats = P.stats || {};
export const TITLES = {
  tanbinh: { name: 'Tân binh Đảo Ngọc', icon: '🌱', need: 'Mặc định' },
  vuasan: { name: 'Vua sàn nhảy', icon: '🕺', need: 'Nhảy tổng 20 phút', test: () => (S.dance || 0) >= 1200 },
  dancbien: { name: 'Dân chơi bãi biển', icon: '🏖️', need: 'Ở bãi biển 20 phút', test: () => (S.beach || 0) >= 1200 },
  cafe: { name: 'Tín đồ cà phê', icon: '☕', need: 'Ngồi quán cafe 10 phút hoặc gọi 5 ly', test: () => (S.cafe || 0) >= 600 || (S.cafeOrders || 0) >= 5 },
  fandj: { name: 'Fan cứng DJ', icon: '🎧', need: 'Tham gia 3 LIVE show', test: () => (S.lives || 0) >= 3 },
  capdoi: { name: 'Cặp đôi của tuần', icon: '💞', need: '3 buổi hẹn trong tuần (cả hai cùng tham gia)', test: () => (P.week.dates || 0) >= 3 },
  nhiepanh: { name: 'Nhiếp ảnh gia', icon: '📸', need: 'Chụp 10 ảnh hoặc chia sẻ 3 lần', test: () => (S.photos || 0) >= 10 || (S.shares || 0) >= 3 },
  sukien: { name: 'Thổ địa sự kiện', icon: '📅', need: 'Tham gia 5 sự kiện', test: () => (S.events || 0) >= 5 },
  top1: { name: 'Quán quân tuần', icon: '🏆', need: 'Top 1 bảng xếp hạng tuần' },
};
// level curve: L -> L+1 needs 80 + 40*L xp
export function levelOf(xp) { let L = 1, need = 120; while (xp >= need) { xp -= need; L++; need = 80 + 40 * L; } return { L, cur: xp, need }; }
const XP_SRC = { online: 1, dance: 1, chat: 3, event: 60, live: 80, date: 50, photo: 8, share: 30, quest: 40, order: 4 };
let lastLevel = levelOf(P.xp).L;
function addXP(n, why) { if (!n) return; P.xp += n; P.week.xp = (P.week.xp || 0) + n; const lv = levelOf(P.xp);
  if (lv.L > lastLevel) { lastLevel = lv.L; const r = 10 + lv.L * 5; setXu(r); toast(`⬆️ Lên cấp ${lv.L}! +${r} Xu`); G.logChat('Hệ thống', `${st.name || 'Bạn'} đã lên cấp ${lv.L} 🎉`); G.updateTag(); G.net && G.net.send({ t: 'emote', e: 'levelup' }); }
  updPill(); dirty = true; }
function stat(k, n = 1, weekly = false) { S[k] = (S[k] || 0) + n; if (weekly) P.week[k] = (P.week[k] || 0) + n; dirty = true; checkTitles(); quest(k, n); }
function checkTitles() { for (const [k, t] of Object.entries(TITLES)) if (!P.titles[k] && t.test && t.test()) { P.titles[k] = 1; toast(`🏅 Mở khóa danh hiệu: ${t.icon} ${t.name}`); G.logChat('Hệ thống', `Bạn nhận danh hiệu ${t.icon} ${t.name} – chọn hiển thị trong ⭐ Cấp độ`); save(); } }
G.prog = { add(kind, n = 1) { // public hooks for other modules
  if (kind === 'date') { stat('dates', n, true); addXP(XP_SRC.date * n); }
  else if (kind === 'event') { stat('events', 1, true); addXP(XP_SRC.event); }
  else if (kind === 'live') { stat('lives', 1, true); stat('events', 1, true); addXP(XP_SRC.live); }
  else if (kind === 'photo') { stat('photos'); addXP(XP_SRC.photo); }
  else if (kind === 'share') { stat('shares'); addXP(XP_SRC.share); }
  else if (kind === 'chat') { const d = today(); if (P.chatDay !== d) { P.chatDay = d; P.chatN = 0; } if (P.chatN++ < 25) addXP(XP_SRC.chat); stat('chats'); }
  else if (kind === 'emote') stat('emotes');
}, addXP, P, levelOf, TITLES, weekId };
G.onEventAttend = (id) => G.prog.add(id === 'djlive' ? 'live' : 'event');
G.onPhoto = () => G.prog.add('photo'); G.onShare = () => G.prog.add('share');
G.onOrder = (v) => { addXP(XP_SRC.order); if (v.name && /cafe|cà phê/i.test(v.name)) stat('cafeOrders'); };
G.onEmote.push(() => G.prog.add('emote'));
const prevChat = G.onChat; G.onChat = (txt) => { G.prog.add('chat'); return prevChat ? prevChat(txt) : false; };

// ---- name tag: level + title (+ seasonal badge) ----
G.tagText = () => { const b = (G.clubBadge && G.clubBadge()) || st.equip.badge && (Object.values(G.SHOP).flat().find(i => i.id === st.equip.badge) || {}).icon; return `${b ? b + ' ' : '⭐ '}Lv.${levelOf(P.xp).L} ${st.name || 'Bạn'}${G.guest ? ' (Khách)' : ''}`; };
G.titleText = (key) => { const t = TITLES[key || P.title]; return t ? `${t.icon} ${t.name}` : ''; };
G.onTag = (pl) => { if (pl.titleTag) { G.disposeSprite(pl.titleTag); pl.titleTag = null; } const t = G.titleText(); if (!t) return; pl.titleTag = G.textSprite(t, { color: '#ffd1f0', size: 24, h: 0.22, bg: 'rgba(60,10,60,0.55)' }); pl.titleTag.position.y = 2.0; pl.av.root.add(pl.titleTag); };

// ---- daily quests (GMT+7 day) ----
const QPOOL = [
  { id: 'dance', text: 'Nhảy 3 phút ở Bar Beer', goal: 180, k: 'dance' }, { id: 'chat', text: 'Gửi 5 tin nhắn', goal: 5, k: 'chats' },
  { id: 'beach', text: 'Dạo bãi biển 3 phút', goal: 180, k: 'beach' }, { id: 'cafe', text: 'Ngồi quán cafe 2 phút', goal: 120, k: 'cafe' },
  { id: 'photo', text: 'Chụp 1 tấm ảnh (📸)', goal: 1, k: 'photos' }, { id: 'emote', text: 'Dùng biểu cảm 5 lần', goal: 5, k: 'emotes' },
  { id: 'order', text: 'Gọi 2 món/đồ uống', goal: 2, k: 'orders' }, { id: 'online', text: 'Online 10 phút', goal: 600, k: 'online' },
];
function rollQuests() { const d = today(); if (P.quests && P.quests.date === d) return; let seed = [...d].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7); const pool = [...QPOOL]; const list = [];
  while (list.length < 3) { seed = (seed * 1103515245 + 12345) >>> 0; const q = pool.splice(seed % pool.length, 1)[0]; list.push({ id: q.id, prog: 0, done: false, claimed: false }); } P.quests = { date: d, list }; }
function quest(k, n) { rollQuests(); for (const q of P.quests.list) { const def = QPOOL.find(x => x.id === q.id); if (def.k !== k || q.done) continue; q.prog = Math.min(def.goal, q.prog + n); if (q.prog >= def.goal) { q.done = true; toast(`✅ Hoàn thành nhiệm vụ: ${def.text} – mở ⭐ để nhận thưởng`); } } }
const prevOrder = G.onOrder; G.onOrder = (v, m) => { prevOrder(v, m); stat('orders'); };

// ---- per-second tracking ----
let acc = 0, dirty = false, onlineT = 0;
G.onFrame.push((dt) => { acc += dt; if (acc < 1) return; acc -= 1; if (!G.isPlaying()) return;
  if (P.week.id !== weekId()) weekRollover();
  rollQuests(); const p = G.player, z = W.zoneName(p.x, p.z);
  stat('online'); if (++onlineT % 10 === 0) addXP(XP_SRC.online);
  const dancing = p.form || (p.dance && !p.target) || (p.emote && /dance|quay|vina|disco|robot|spin|head|shuffle/.test(p.emote));
  if (dancing) { stat('dance', 1, true); if (onlineT % 2 === 0) addXP(XP_SRC.dance); }
  if (/Bãi biển|Biển|Bến tàu/.test(z)) stat('beach', 1, true);
  if (/Cafe|Cà phê/i.test(z) && p.seat) stat('cafe', 1, true);
});
function weekRollover() { // archive last week for local leaderboard reward check
  const last = P.week; P.lastWeek = last; P.week = { id: weekId() };
  if (!G.net || !G.net.online) { const rank = localRank('level', 'week', last); grantWeekly(last.id, rank, 'offline'); } }
const WEEK_REWARD = (r) => r === 1 ? 300 : r === 2 ? 200 : r === 3 ? 150 : r <= 10 ? 50 : 0;
function grantWeekly(wid, rank, src) { if (!rank || P.wkRewards[wid]) return; const xu = WEEK_REWARD(rank); if (!xu) return; P.wkRewards[wid] = rank; setXu(xu); if (rank === 1) P.titles.top1 = 1;
  toast(`🏆 Thưởng tuần ${wid}: hạng ${rank} → +${xu} Xu${rank === 1 ? ' + danh hiệu 🏆' : ''}`); save(); }
G.prog.grantWeekly = grantWeekly;

// ---- leaderboards ----
const CATS = { level: ['⭐ Cấp độ', 'XP'], dance: ['🕺 Nhảy', 'phút'], events: ['📅 Sự kiện', 'lần'], couples: ['💞 Cặp đôi', 'buổi hẹn'] };
function myScore(cat, per, wk = P.week) { if (cat === 'level') return per === 'week' ? wk.xp || 0 : P.xp; if (cat === 'dance') return Math.floor((per === 'week' ? wk.dance || 0 : S.dance || 0) / 60); if (cat === 'events') return per === 'week' ? wk.events || 0 : S.events || 0; return per === 'week' ? wk.dates || 0 : S.dates || 0; }
const DEMO = ['Mai Anh', 'Tuấn Kiệt', 'Ngọc Hân', 'Bảo Long', 'Thùy Linh', 'Quang Huy', 'Hải Yến', 'Đức Minh', 'Khánh Vy', 'Gia Bảo', 'Phương Thảo', 'Minh Khôi'];
function demoBoard(cat, per, wid = P.week.id) { let seed = [...(wid + cat + per)].reduce((a, c) => a * 33 + c.charCodeAt(0) >>> 0, 5); const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const base = { level: per === 'week' ? 900 : 6000, dance: per === 'week' ? 90 : 600, events: per === 'week' ? 4 : 30, couples: per === 'week' ? 5 : 30 }[cat];
  return DEMO.map(n => { const v = Math.round(base * Math.pow(r(), 1.6)); return { name: n, score: v, level: cat === 'level' ? levelOf(per === 'week' ? v * 6 : v).L : 0, title: '' }; }); }
function localBoard(cat, per, wk) { const me = { name: (st.name || 'Bạn') + (G.guest ? ' (Khách)' : ''), score: myScore(cat, per, wk), me: true, level: levelOf(P.xp).L, title: G.titleText() };
  return [...demoBoard(cat, per, wk ? wk.id : undefined), me].sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 })); }
function localRank(cat, per, wk) { return localBoard(cat, per, wk).find(e => e.me).rank; }
async function getBoard(cat, per) { if (G.net && G.net.online) { try { const r = await G.net.leaderboard(cat, per); if (r && r.rows) return { rows: r.rows, src: 'server', week: r.week }; } catch (e) {} } return { rows: localBoard(cat, per), src: 'local', week: P.week.id }; }
let lbCat = 'level', lbPer = 'week';
async function openLB() {
  G.openPanel('<h2>🏆 Bảng xếp hạng</h2><p class="muted">Đang tải…</p>'); const { rows, src, week } = await getBoard(lbCat, lbPer);
  const tabs = (o, cur, attr) => Object.entries(o).map(([k, v]) => `<button data-${attr}="${k}" class="${k === cur ? 'sel' : ''}">${Array.isArray(v) ? v[0] : v}</button>`).join('');
  const body = rows.slice(0, 20).map(e => `<tr class="${e.me ? 'me' : ''}"><td>${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</td><td>${esc(e.name)}${e.level ? ` <span class="muted">Lv.${e.level}</span>` : ''}${e.title ? `<br><small>${esc(e.title)}</small>` : ''}</td><td><b>${e.score}</b> ${CATS[lbCat][1]}</td></tr>`).join('');
  const meRow = rows.find(e => e.me); const nextMon = bkk(Date.parse(weekId() + 'T00:00:00Z') + 7 * 864e5 - 7 * 3600e3);
  G.openPanel(`<h2>🏆 Bảng xếp hạng</h2><div class="tabs">${tabs({ week: 'Tuần này', all: 'Mọi thời đại' }, lbPer, 'per')}</div><div class="tabs">${tabs(CATS, lbCat, 'cat')}</div>
    <table id="lbTable"><tr><th>#</th><th>Người chơi</th><th>Điểm</th></tr>${body}</table>
    ${meRow && meRow.rank > 20 ? `<p>Hạng của bạn: <b>${meRow.rank}</b> (${meRow.score} ${CATS[lbCat][1]})</p>` : ''}
    <h3>🎁 Thưởng tuần (bảng ⭐ Cấp độ – XP trong tuần)</h3><p class="muted">🥇 300 Xu + danh hiệu 🏆 Quán quân tuần · 🥈 200 Xu · 🥉 150 Xu · Top 10: 50 Xu. Chốt bảng 00:00 thứ 2 (GMT+7), tuần này bắt đầu ${week}. Thưởng là Xu ảo trong game.</p>
    <p class="tiny">${src === 'server' ? '🌐 Dữ liệu từ máy chủ' : '📴 Chế độ offline: bảng xếp hạng demo trên máy này (người chơi mẫu + bạn)'}</p>`);
  $('panelBody').onclick = (e) => { const t = e.target; if (t.dataset.cat) { lbCat = t.dataset.cat; openLB(); } if (t.dataset.per) { lbPer = t.dataset.per; openLB(); } };
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- level / titles / quests panel ----
function openProfile() { rollQuests(); const lv = levelOf(P.xp);
  const tl = Object.entries(TITLES).map(([k, t]) => { const own = P.titles[k]; return `<div class="item"><div class="ic">${t.icon}</div><div class="nm">${t.name}</div><div class="ds">${t.need}</div>${own ? `<button data-title="${k}" class="${P.title === k ? 'own' : ''}">${P.title === k ? '✓ Đang hiển thị' : 'Hiển thị'}</button>` : '<button class="dis">🔒 Chưa mở</button>'}</div>`; }).join('');
  const qs = P.quests.list.map(q => { const d = QPOOL.find(x => x.id === q.id); const pr = d.goal >= 60 ? `${Math.floor(q.prog / 60)}/${d.goal / 60} phút` : `${q.prog}/${d.goal}`;
    return `<div class="quest"><span>${q.done ? '✅' : '⬜'} ${d.text} <small class="muted">(${pr})</small></span>${q.claimed ? '<small>Đã nhận</small>' : q.done ? `<button class="pill btn" data-claim="${q.id}">Nhận 15 Xu + 40 XP</button>` : '<small class="muted">15 Xu + 40 XP</small>'}</div>`; }).join('');
  G.openPanel(`<h2>⭐ Cấp ${lv.L} – ${esc(st.name || 'Bạn')}</h2><div>${lv.cur}/${lv.need} XP tới cấp ${lv.L + 1}</div><div class="xpbar"><i style="width:${Math.round(lv.cur / lv.need * 100)}%"></i></div>
    <p class="muted">Nhận XP khi online, nhảy, chat, đi sự kiện/LIVE, hẹn hò, chụp & chia sẻ ảnh, làm nhiệm vụ. Lên cấp được thưởng Xu.</p>
    <h3>📋 Nhiệm vụ hôm nay</h3>${qs}<h3>🏅 Danh hiệu (chọn 1 để hiện dưới tên)</h3><div class="grid">${tl}</div>
    <p class="muted">Thống kê: nhảy ${Math.floor((S.dance || 0) / 60)} phút · bãi biển ${Math.floor((S.beach || 0) / 60)} phút · cafe ${Math.floor((S.cafe || 0) / 60)} phút · LIVE ${S.lives || 0} · sự kiện ${S.events || 0} · hẹn hò ${S.dates || 0} · ảnh ${S.photos || 0}</p>
    <button class="pill btn" id="toLB">🏆 Xem Bảng xếp hạng</button>`);
  $('panelBody').onclick = (e) => { const t = e.target; if (t.id === 'toLB') return openLB();
    if (t.dataset.title) { P.title = t.dataset.title; save(); G.updateTag(); G.net && G.net.sendLook && G.net.sendLook(); openProfile(); }
    if (t.dataset.claim) { const q = P.quests.list.find(x => x.id === t.dataset.claim); if (q && q.done && !q.claimed) { q.claimed = true; setXu(15); addXP(XP_SRC.quest); save(); toast('🎁 +15 Xu +40 XP'); openProfile(); } } };
}
const lvPill = el('button', { id: 'lvPill', className: 'pill btn' }); $('topbar').insertBefore(lvPill, $('xu'));
const lbBtn = el('button', { id: 'lbBtn', className: 'pill btn' }, '🏆 Xếp hạng'); $('topbar').insertBefore(lbBtn, $('shopBtn'));
lvPill.onclick = openProfile; lbBtn.onclick = openLB;
function updPill() { lvPill.textContent = `⭐ Lv.${levelOf(P.xp).L}`; }
updPill(); rollQuests(); checkTitles();
setInterval(() => { if (dirty) { dirty = false; save(); } }, 15000);
G.prog.levelOf = levelOf; G.prog.openLB = openLB; G.prog.openProfile = openProfile; G.prog.reload = () => { const np = st.prog || {}; if (np !== P) { for (const k of Object.keys(P)) delete P[k]; Object.assign(P, { xp: 0, stats: {}, week: { id: weekId() }, titles: { tanbinh: 1 }, title: 'tanbinh', quests: null, wkRewards: {} }, np); st.prog = P; } S = P.stats; lastLevel = levelOf(P.xp).L; updPill(); };
