// Accounts (login / sign-up / sessions) + realtime multiplayer over WebSocket. Falls back to offline 'Khách' mode.
import * as THREE from 'three';
import { cleanText, checkNick } from './filter.js';
const G = window.__game; const { st, scene, toast, setXu, save, W } = G;
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const Q = new URLSearchParams(location.search);
G.filter = (t) => cleanText(t);
const TK = 'daongoc_token';
const net = G.net = { online: false, on: false, base: null, token: null, ws: null, me: null, remotes: new Map(), matches: [], blocks: new Set(), muted: new Set(JSON.parse(localStorage.getItem('daongoc_mute') || '[]')), dms: new Map(), unread: 0, send() {} };

// ---------- find server ----------
async function findServer() {
  let url = Q.get('server'); if (!url) { try { const c = await fetch('config.json', { cache: 'no-store' }).then(r => r.json()); url = c.serverUrl; } catch (e) {} }
  if (!url || Q.has('offline')) return null; if (url === 'auto') url = location.origin; url = url.replace(/\/$/, '').replace(/^ws/, 'http');
  try { const r = await fetch(url + '/api/health', { cache: 'no-store', signal: AbortSignal.timeout(4000) }); if (r.ok && (await r.json()).ok) return url; } catch (e) {} return null;
}
const api = async (p, body) => { const r = await fetch(net.base + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(net.token ? { authorization: 'Bearer ' + net.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({ error: 'Lỗi máy chủ' })); if (!r.ok) { const e = new Error(j.error || 'Lỗi'); e.field = j.field; e.status = r.status; throw e; } return j; };

// ---------- auth screen ----------
const RULES = `<ol style="text-align:left;line-height:1.5"><li>Đủ <b>18 tuổi</b> trở lên để tạo tài khoản (có khu bar & hẹn hò).</li><li>Tôn trọng mọi người: không chửi bới, quấy rối, phân biệt, nội dung người lớn.</li><li>Không chia sẻ số điện thoại, địa chỉ, thông tin cá nhân; không lừa đảo, mua bán ngoài game.</li><li>Xu và vật phẩm là <b>ảo</b>: không nạp tiền thật, không đổi ra tiền, không cờ bạc.</li><li>Vi phạm có thể bị chặn chat hoặc khóa tài khoản. Dùng ⛔ Chặn / 🚩 Báo cáo khi gặp người xấu.</li></ol>`;
const auth = el('div', { id: 'auth', className: 'overlay' }, `<div class="card">
  <h1 class="neon">🏝️ ĐẢO NGỌC</h1><p class="sub" id="auSub">Đang kết nối máy chủ…</p>
  <div id="auBody" class="hidden">
   <div class="tabs" id="auTabs"><button data-t="login" class="sel">Đăng nhập</button><button data-t="reg">Đăng ký</button></div>
   <form id="auForm" autocomplete="on">
    <label>Biệt danh</label><input id="auNick" name="username" maxlength="20" autocomplete="username" placeholder="VD: Ngọc Hân, Tuấn_Bar" required><div class="fieldErr" id="eNick"></div>
    <label>Mật khẩu</label><input id="auPw" type="password" name="password" maxlength="128" autocomplete="current-password" required><div class="fieldErr" id="ePw"></div>
    <div class="regOnly hidden"><label>Nhập lại mật khẩu</label><input id="auPw2" type="password" maxlength="128" autocomplete="new-password">
     <label>Email <small>(không bắt buộc – để khôi phục mật khẩu sau này)</small></label><input id="auEmail" type="email" maxlength="120" autocomplete="email"><div class="fieldErr" id="eEmail"></div>
     <label class="chk"><input type="checkbox" id="auAdult"> Tôi xác nhận đã đủ <b>18 tuổi</b></label>
     <label class="chk"><input type="checkbox" id="auRules"> Tôi đồng ý <a href="#" id="auRulesLink">Nội quy Đảo Ngọc</a></label></div>
    <label class="chk"><input type="checkbox" id="auRemember" checked> Ghi nhớ đăng nhập (30 ngày)</label>
    <div class="fieldErr" id="eAll"></div>
    <button class="primary" id="auGo" type="submit">ĐĂNG NHẬP</button>
   </form>
   <p class="tiny"><a href="#" id="auForgot">Quên mật khẩu?</a></p>
  </div>
  <button class="pill btn" id="auGuest" style="margin-top:8px">🎒 Chơi offline (Khách) – không lưu lên máy chủ</button>
  <p class="tiny">Mật khẩu được mã hoá (scrypt) trên máy chủ. Không dùng lại mật khẩu ngân hàng/email.</p></div>`);
document.body.append(auth); $('start').classList.add('hidden');
let mode = 'login', failN = 0, lockUntil = 0;
$('auTabs').onclick = (e) => { const t = e.target.dataset.t; if (!t) return; mode = t; [...$('auTabs').children].forEach(b => b.classList.toggle('sel', b.dataset.t === t));
  document.querySelectorAll('.regOnly').forEach(x => x.classList.toggle('hidden', t !== 'reg')); $('auGo').textContent = t === 'reg' ? 'TẠO TÀI KHOẢN' : 'ĐĂNG NHẬP'; $('auPw').autocomplete = t === 'reg' ? 'new-password' : 'current-password'; clearErr(); };
const clearErr = () => ['eNick', 'ePw', 'eEmail', 'eAll'].forEach(i => $(i).textContent = '');
$('auNick').oninput = () => { if (mode === 'reg') $('eNick').textContent = $('auNick').value.trim().length >= 3 ? (checkNick($('auNick').value) || '') : ''; };
$('auRulesLink').onclick = (e) => { e.preventDefault(); alertBox('📜 Nội quy Đảo Ngọc', RULES); };
$('auForgot').onclick = async (e) => { e.preventDefault(); let msg = 'Tính năng khôi phục mật khẩu đang được phát triển.'; try { msg = (await api('/api/forgot', { nick: $('auNick').value })).message; } catch (x) {} alertBox('🔑 Quên mật khẩu', `<p>${esc(msg)}</p><p class="muted">Tạm thời: liên hệ ban quản trị đảo để được hỗ trợ đặt lại mật khẩu.</p>`); };
function alertBox(title, html) { const o = el('div', { className: 'overlay', style: 'z-index:90' }, `<div class="card"><h2>${title}</h2>${html}<button class="primary">OK</button></div>`); o.querySelector('button').onclick = () => o.remove(); document.body.append(o); }
$('auForm').onsubmit = async (e) => { e.preventDefault(); clearErr();
  if (Date.now() < lockUntil) return $('eAll').textContent = `Vui lòng chờ ${Math.ceil((lockUntil - Date.now()) / 1000)} giây rồi thử lại`;
  const nick = $('auNick').value.trim(), pw = $('auPw').value, remember = $('auRemember').checked;
  if (mode === 'reg') { const bad = checkNick(nick); if (bad) return $('eNick').textContent = bad; if (pw.length < 8 || !/\d/.test(pw) || !/\p{L}/u.test(pw)) return $('ePw').textContent = 'Mật khẩu cần ≥ 8 ký tự, có cả chữ và số';
    if (pw !== $('auPw2').value) return $('ePw').textContent = 'Hai mật khẩu không khớp'; if (!$('auAdult').checked) return $('eAll').textContent = 'Bạn cần xác nhận đủ 18 tuổi để tạo tài khoản'; if (!$('auRules').checked) return $('eAll').textContent = 'Bạn cần đồng ý Nội quy'; }
  $('auGo').disabled = true;
  try { const r = await api(mode === 'reg' ? '/api/register' : '/api/login', mode === 'reg' ? { nick, password: pw, email: $('auEmail').value.trim(), adult: $('auAdult').checked, rules: $('auRules').checked, remember, data: { gender: st.gender, color: st.color, look: st.look } } : { nick, password: pw, remember });
    failN = 0; onAuthed(r, remember); if (mode === 'reg') toast(`🎉 Chào mừng ${r.user.nick} tới Đảo Ngọc!`); }
  catch (err) { failN++; if (failN >= 3) lockUntil = Date.now() + Math.min(60, 5 * 2 ** (failN - 3)) * 1000; // client-side backoff (server also locks after 5 fails)
    const f = { nick: 'eNick', password: 'ePw', email: 'eEmail' }[err.field] || 'eAll'; $(f).textContent = err.message; }
  finally { $('auGo').disabled = false; } };
$('auGuest').onclick = () => goGuest();
function goGuest() { G.guest = true; G.account = null; net.online = false; auth.classList.add('hidden'); $('start').classList.remove('hidden');
  if (!st.name || st.name === 'Khách') st.name = ''; $('nameInput').readOnly = false; $('nameInput').placeholder = 'Tên khách (offline)…';
  $('acctLine').innerHTML = '👤 <b>Khách</b> · chế độ offline – chỉ có NPC, tiến trình lưu trên máy này' + (net.base ? ' · <a href="#" id="toLogin">Đăng nhập</a>' : '');
  const tl = $('toLogin'); if (tl) tl.onclick = (e) => { e.preventDefault(); G.guest = false; $('start').classList.add('hidden'); auth.classList.remove('hidden'); }; }
function onAuthed(r, remember) {
  net.token = r.token; (remember ? localStorage : sessionStorage).setItem(TK, r.token); (remember ? sessionStorage : localStorage).removeItem(TK);
  applyAccount(r.user, r.data); }
function applyAccount(user, data, extra = {}) {
  G.account = user; G.guest = false; G.noLocalSave = true; net.me = user;
  const keep = ['server']; const d = { ...data }; keep.forEach(k => delete d[k]); Object.assign(st, d); st.name = user.nick; if (!st.owned) st.owned = { dance1: true, quaytay: true }; G.style && G.style.refresh();
  if (extra.blocks) net.blocks = new Set(extra.blocks); if (extra.matches) net.matches = extra.matches;
  G.prog && G.prog.reload(); setXu(0); auth.classList.add('hidden'); $('start').classList.remove('hidden');
  $('nameInput').value = user.nick; $('nameInput').readOnly = true; $('acctLine').innerHTML = `✅ Đăng nhập: <b>${esc(user.nick)}</b> · <a href="#" id="logoutA">Đăng xuất</a>`; $('logoutA').onclick = (e) => { e.preventDefault(); logout(); };
  if (extra.weeklyReward) setTimeout(() => toast(`🏆 Thưởng tuần ${extra.weeklyReward.week}: hạng ${extra.weeklyReward.rank} → +${extra.weeklyReward.xu} Xu`), 1500);
  G.isPlaying() && G.updateTag(); }
async function logout() { try { await api('/api/logout', {}); } catch (e) {} localStorage.removeItem(TK); sessionStorage.removeItem(TK); location.href = location.pathname + location.search; }
net.logout = logout;

(async () => {
  net.base = await findServer();
  if (!net.base) { $('auSub').textContent = 'Không có máy chủ online – chơi offline'; return goGuest(); }
  $('auSub').textContent = 'Đăng nhập để gặp người chơi thật, chat, ghép đôi và lên bảng xếp hạng'; $('auBody').classList.remove('hidden');
  const tok = localStorage.getItem(TK) || sessionStorage.getItem(TK);
  if (tok) { net.token = tok; try { const r = await api('/api/me'); applyAccount(r.user, r.data, r); } catch (e) { net.token = null; localStorage.removeItem(TK); sessionStorage.removeItem(TK); } }
})();

// ---------- save sync ----------
let saveT = null; const PICK = ['xu', 'owned', 'equip', 'lastCheckin', 'liveRewards', 'evDone', 'lastShare', 'color', 'gender', 'prog', 'dating'];
G.onSave = () => { if (!G.account) return; clearTimeout(saveT); saveT = setTimeout(pushSave, 2500); };
net.flushSave = () => { clearTimeout(saveT); pushSave(); };
function pushSave() { const data = {}; PICK.forEach(k => data[k] = st[k]); if (net.on) net.send({ t: 'save', data }); else if (net.token) api('/api/save', { data }).catch(() => {}); }
addEventListener('pagehide', () => { if (G.account && net.token) { const data = {}; PICK.forEach(k => data[k] = st[k]); fetch(net.base + '/api/save', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + net.token }, body: JSON.stringify({ data }) }).catch(() => {}); } });
net.leaderboard = (cat, per) => api(`/api/leaderboard?cat=${cat}&per=${per}`);

// ---------- realtime ----------
let backoff = 1000, lastSend = 0, lastKey = '';
net.reconnect = () => { const o = net.ws; net.ws = null; if (o) o.close(); net.on = false; net.send = () => {}; clearRemotes(); connect(); };
function connect() {
  if (!G.account || !net.base) return; const ws = new WebSocket(net.base.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(net.token)); net.ws = ws;
  ws.onopen = () => { backoff = 1000; net.on = true; net.online = true; net.send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m)); hello(); };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
  ws.onclose = (e) => { if (ws !== net.ws) return; net.on = false; net.send = () => {}; clearRemotes(); if (e.code === 4001 || e.code === 4002) { toast(e.code === 4002 ? 'Tài khoản đã đăng nhập ở nơi khác' : 'Phiên hết hạn, hãy đăng nhập lại'); return; }
    G.logChat('Hệ thống', '📴 Mất kết nối máy chủ – đang thử lại…'); setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 20000); };
}
const myLook = () => G.playerLook();
const badgeIcon = () => (G.clubBadge && G.clubBadge()) || (st.equip.badge ? (Object.values(G.SHOP).flat().find(i => i.id === st.equip.badge) || {}).icon : null);
function hello() { const p = G.player; net.send({ t: 'hello', room: st.server, look: myLook(), title: st.prog && st.prog.title, badge: badgeIcon(), level: G.prog ? G.prog.levelOf(st.prog.xp).L : 1, x: p.x, y: p.y || 0, z: p.z }); }
net.sendLook = () => net.send({ t: 'look', look: myLook(), title: st.prog && st.prog.title, badge: badgeIcon(), level: G.prog ? G.prog.levelOf(st.prog.xp).L : 1 });
const _upd = G.updateTag; G.updateTag = () => { _upd(); if (net.on) net.sendLook(); };
G.onEnter.push(() => { if (G.account) connect(); });
G.onFrame.push((dt, t) => {
  const p = G.player; if (net.on && t - lastSend > 0.1) { const k = `${p.x.toFixed(2)},${p.z.toFixed(2)},${p.yaw.toFixed(2)},${p.av.anim}`; if (k !== lastKey) { lastKey = k; lastSend = t; net.send({ t: 'st', x: p.x, y: p.y || 0, z: p.z, yaw: p.yaw, anim: p.av.anim }); } }
  for (const r of net.remotes.values()) { const a = Math.min(1, dt * 10); r.x += (r.tx - r.x) * a; r.y += (r.ty - r.y) * a; r.z += (r.tz - r.z) * a; let dy = r.tyaw - r.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.yaw += dy * a;
    r.av.root.position.set(r.x, r.y, r.z); r.av.root.rotation.y = r.yaw; const d = Math.hypot(r.x - p.x, r.z - p.z); r.av.root.visible = d < 90; if (r.av.root.visible) G_anim(r.av, dt, t);
    if (r.bubble) { r.bubbleT -= dt; if (r.bubbleT <= 0) { G.disposeSprite(r.bubble); r.bubble = null; } } }
});
let G_anim = () => {}; import('./avatar.js').then(m => { G_anim = m.animateAvatar; });
function addRemote(p) { if (net.remotes.has(p.id)) removeRemote(p.id); const av = G.createAvatar(p.look); scene.add(av.root);
  const r = { ...p, av, tx: p.x, ty: p.y, tz: p.z, tyaw: p.yaw || 0, bubble: null, bubbleT: 0 }; av.anim = p.anim || 'idle'; av.hits.forEach(h => h.userData.remote = r); tagRemote(r); net.remotes.set(p.id, r); r.av.root.position.set(p.x, p.y, p.z); }
function tagRemote(r) { if (r.tag) G.disposeSprite(r.tag); if (r.ttag) { G.disposeSprite(r.ttag); r.ttag = null; }
  r.tag = G.textSprite(`${r.badge ? r.badge + ' ' : '🌐 '}Lv.${r.level || 1} ${r.name}`, { color: '#9ff3ff', size: 28, h: r.av.tier === 'l' ? 0.34 : 0.28, legend: r.av.tier === 'l' }); r.tag.position.y = 2.25; r.av.root.add(r.tag);
  if (r.title) { r.ttag = G.textSprite(r.title, { color: '#ffd1f0', size: 22, h: 0.2, bg: 'rgba(60,10,60,0.55)' }); r.ttag.position.y = 2.02; r.av.root.add(r.ttag); } }
function removeRemote(id) { const r = net.remotes.get(id); if (!r) return; scene.remove(r.av.root); net.remotes.delete(id); }
function clearRemotes() { for (const id of [...net.remotes.keys()]) removeRemote(id); }
const hidden = (uid) => net.blocks.has(uid) || net.muted.has(uid);
function rBubble(r, text, life = 4.5) { if (r.bubble) G.disposeSprite(r.bubble); r.bubble = G.textSprite(text, { color: '#222', bg: 'rgba(255,255,255,0.92)', size: 28, h: 0.3 }); r.bubble.position.y = 2.65; r.av.root.add(r.bubble); r.bubbleT = life; }
const byUid = (uid) => [...net.remotes.values()].find(r => r.uid === uid);
function onMsg(m) {
  switch (m.t) {
    case 'welcome': net.myId = m.id; clearRemotes(); m.players.forEach(addRemote); net.matches = m.matches || net.matches; G.logChat('Hệ thống', `🌐 Đã vào máy chủ online · ${m.players.length} người chơi khác trong đảo này`); if (G.onNet) G.onNet(m); break;
    case 'instSwap': clearRemotes(); m.players.forEach(addRemote); if (G.onNet) G.onNet(m); break;
    case 'join': addRemote(m.p); if (!hidden(m.p.uid) && !m.quiet) G.logChat('Hệ thống', `👋 ${m.p.name} vừa lên đảo`); break;
    case 'leave': removeRemote(m.id); break;
    case 's': for (const [id, x, y, z, yaw, anim] of m.s) { if (id === net.myId) continue; const r = net.remotes.get(id); if (!r) continue; r.tx = x; r.ty = y; r.tz = z; r.tyaw = yaw; if (anim && r.av.anim !== anim) { r.av.anim = anim; r.av.animT = 0; } } break;
    case 'look': { const r = net.remotes.get(m.id); if (!r) break; const pos = [r.x, r.y, r.z]; Object.assign(r, { look: m.look, title: m.title, badge: m.badge, level: m.level }); scene.remove(r.av.root); r.av = G.createAvatar(m.look); r.av.hits.forEach(h => h.userData.remote = r); scene.add(r.av.root); r.av.root.position.set(...pos); tagRemote(r); break; }
    case 'chat': { if (m.id === net.myId) { G.bubble(G.player, m.text, 4); G.logChat((m.scope === 'near' ? '📍 ' : '🌐 ') + m.name, m.text); break; } if (hidden(m.uid)) break; const r = net.remotes.get(m.id); if (r) rBubble(r, m.text); G.logChat((m.scope === 'near' ? '📍 ' : '🌐 ') + m.name, m.text); break; }
    case 'emote': case 'react': { const r = net.remotes.get(m.id); if (!r || hidden(r.uid)) break; if (m.t === 'react' && G.react) G.react(m.e, false, m.name); if (m.e === 'levelup') rBubble(r, '⬆️ Lên cấp!', 2.5); else if (m.t === 'emote') { const tx = { wave: '👋 Xin chào!', cheers: '🥂 Dzô!', clap: '👏👏👏', hug: '🤗', hand: '🤝', kiss: '😘' }[m.e]; if (tx) rBubble(r, tx, 2.2); } if (G.onRemoteEmote) G.onRemoteEmote(r, m.e); break; }
    case 'gift': if (G.giftFx) G.giftFx(m.name, m.kind); break;
    case 'dm': onDM(m); break; case 'dmHist': net.dms.set(m.with, m.rows.map(x => ({ mine: x.src === net.me.id, text: x.text, ts: x.ts }))); if (dmOpen === m.with) openDM(m.with, dmName); break;
    case 'sys': toast(m.msg); break; case 'saved': if (Number.isFinite(m.xu) && m.xu !== st.xu) { st.xu = m.xu; $('xuVal').textContent = st.xu; } break;
    case 'blocked': net.blocks.add(m.to); break; case 'unblocked': net.blocks.delete(m.to); break;
    case 'friended': toast(m.mutual ? '🤝 Hai bạn đã là bạn bè!' : '🤝 Đã gửi lời mời kết bạn'); break;
    case 'friendReq': if (!hidden(m.from)) { toast(m.mutual ? `🤝 ${m.name} và bạn đã là bạn bè!` : `🤝 ${m.name} muốn kết bạn – chạm vào họ để kết bạn lại`); } break;
    default: if (G.onNet) G.onNet(m);
  }
}
// chat: online -> server (global or nearby), else local NPC behaviour
let scope = 'global';
const scopeBtn = el('button', { type: 'button', id: 'scopeBtn', title: 'Phạm vi chat' }, '🌐'); $('chatForm').insertBefore(scopeBtn, $('chatForm').firstChild);
scopeBtn.onclick = () => { scope = scope === 'global' ? 'near' : 'global'; scopeBtn.textContent = scope === 'global' ? '🌐' : '📍'; toast(scope === 'global' ? '🌐 Chat cả đảo' : '📍 Chat với người ở gần (18m)'); };
const prevChat = G.onChat; G.onChat = (txt) => { if (prevChat && prevChat(txt)) return true; if (!net.on) return false; net.send({ t: 'chat', text: txt, scope }); return true; };
G.onEmote.push((e) => { if (net.on) net.send({ t: 'emote', e }); });
G.onlineText = () => net.on ? `👥 ${net.remotes.size + 1} người · 🤖 ${G.npcs.length}` : `👥 ${G.npcs.length + 1}${G.guest ? ' · Khách' : ''}`;

// ---------- tap remote player -> card ----------
const card = el('div', { id: 'pcard', className: 'npcCard hidden' }); document.body.append(card); let cardR = null;
G.tapExtra = (ray) => { if (!net.remotes.size) return false; const hits = []; for (const r of net.remotes.values()) if (r.av.root.visible) hits.push(...r.av.hits); const h = ray.intersectObjects(hits, false)[0]; if (!h) return false; showPCard(h.object.userData.remote); return true; };
function showPCard(r) { cardR = r; const matched = net.matches.some(x => x.id === r.uid); const muted = net.muted.has(r.uid), blocked = net.blocks.has(r.uid);
  card.innerHTML = `<div style="font-size:18px;font-weight:700">🌐 ${esc(r.name)} <small>Lv.${r.level || 1}</small></div><div style="color:#ffb3f0;font-size:13px;margin:2px 0 6px">${esc(r.title || 'Người chơi')}${matched ? ' · 💘 Đã ghép đôi' : ''}</div>
   <div class="btnGrid"><button data-c="greet" class="pill btn">👋 Chào</button><button data-c="dm" class="pill btn">💬 Nhắn riêng</button><button data-c="friend" class="pill btn">🤝 Kết bạn</button>
   ${matched ? '<button data-c="date" class="pill btn">💑 Rủ hẹn</button><button data-c="couple" class="pill btn">💞 Cử chỉ đôi</button>' : '<button data-c="like" class="pill btn">💘 Thích</button><button data-c="date" class="pill btn">💑 Rủ hẹn (bạn bè)</button>'}
   <button data-c="mute" class="pill btn">${muted ? '🔊 Bỏ tắt tiếng' : '🔇 Tắt tiếng'}</button><button data-c="block" class="pill btn">${blocked ? '✅ Bỏ chặn' : '⛔ Chặn'}</button><button data-c="report" class="pill btn">🚩 Báo cáo</button><button data-c="x" class="pill btn">✕</button></div>`;
  card.classList.remove('hidden'); }
card.onclick = (e) => { const c = e.target.dataset.c; if (!c) return; const r = cardR; card.classList.add('hidden'); if (!r || c === 'x') return;
  if (c === 'greet') { G.doEmote('wave'); net.send({ t: 'chat', text: `👋 Chào ${r.name}!`, scope: 'near' }); }
  if (c === 'dm') openDM(r.uid, r.name);
  if (c === 'friend') net.send({ t: 'friend', to: r.uid });
  if (c === 'like') { net.send({ t: 'like', to: r.uid, kind: 'like' }); toast(`💘 Đã thích ${r.name}`); }
  if (c === 'date' && G.dating) G.dating.invite(r.uid, r.name); if (c === 'couple' && G.dating) G.dating.coupleMenu(r);
  if (c === 'mute') { net.muted.has(r.uid) ? net.muted.delete(r.uid) : net.muted.add(r.uid); localStorage.setItem('daongoc_mute', JSON.stringify([...net.muted])); toast(net.muted.has(r.uid) ? `🔇 Đã tắt tiếng ${r.name}` : `🔊 Đã bật tiếng ${r.name}`); }
  if (c === 'block') { if (net.blocks.has(r.uid)) net.send({ t: 'unblock', to: r.uid }); else if (confirm(`Chặn ${r.name}? Hai bạn sẽ không thấy chat/tin nhắn của nhau.`)) { net.send({ t: 'block', to: r.uid }); net.blocks.add(r.uid); toast(`⛔ Đã chặn ${r.name}`); } }
  if (c === 'report') openReport(r.uid, r.name); };
net.openReport = (uid, name) => openReport(uid, name);
function openReport(uid, name) { G.openPanel(`<h2>🚩 Báo cáo ${esc(name)}</h2><div class="grid" style="grid-template-columns:1fr 1fr">${['Chửi bới / xúc phạm', 'Quấy rối', 'Nội dung người lớn', 'Lừa đảo / mua bán', 'Chưa đủ 18 tuổi', 'Khác'].map(x => `<button class="pill btn" data-r="${x}">${x}</button>`).join('')}</div><p class="muted">Báo cáo kèm 10 dòng chat gần nhất gửi tới ban quản trị.</p>`);
  $('panelBody').onclick = (e) => { const reason = e.target.dataset.r; if (!reason) return; const ctx = [...$('chatLog').children].map(d => d.textContent).slice(-10).join('\n'); net.send({ t: 'report', to: uid, reason, context: ctx }); G.closePanel(); }; }
net.report = openReport;

// ---------- DMs ----------
let dmOpen = null, dmName = '';
function onDM(m) { const other = m.from === net.me.id ? m.to : m.from; const name = m.from === net.me.id ? m.toName : m.fromName; if (m.from !== net.me.id && hidden(m.from)) return;
  const arr = net.dms.get(other) || []; arr.push({ mine: m.from === net.me.id, text: m.text, ts: m.ts }); net.dms.set(other, arr); net.dmNames = net.dmNames || {}; net.dmNames[other] = name;
  if (dmOpen === other) openDM(other, name); else if (m.from !== net.me.id) { net.unread++; updDmBtn(); toast(`💬 ${name}: ${m.text.slice(0, 40)}`); } }
const dmBtn = el('button', { id: 'dmBtn', className: 'pill btn' }, '💬'); $('topbar').insertBefore(dmBtn, $('shopBtn'));
const updDmBtn = () => { dmBtn.textContent = net.unread ? `💬 ${net.unread}` : '💬'; }; dmBtn.onclick = () => openInbox();
function openInbox() { if (!G.account) return G.openPanel('<h2>💬 Tin nhắn</h2><p>Đăng nhập tài khoản online để nhắn tin riêng với người chơi khác. Chế độ <b>Khách</b> chỉ có NPC.</p>');
  net.unread = 0; updDmBtn(); const names = { ...(net.dmNames || {}) }; net.matches.forEach(x => names[x.id] = x.nick);
  const rows = Object.entries(names).map(([id, n]) => `<button class="pill btn" data-dm="${id}" data-n="${esc(n)}">${net.matches.some(x => x.id === +id) ? '💘' : '💬'} ${esc(n)}</button>`).join(' ') || '<p class="muted">Chưa có cuộc trò chuyện. Chạm vào người chơi khác → 💬 Nhắn riêng, hoặc ghép đôi trong 💘.</p>';
  G.openPanel(`<h2>💬 Tin nhắn riêng</h2><div style="display:flex;flex-wrap:wrap;gap:6px">${rows}</div>`); $('panelBody').onclick = (e) => { const b = e.target.closest('[data-dm]'); if (b) openDM(+b.dataset.dm, b.dataset.n); }; }
function openDM(uid, name) { dmOpen = uid; dmName = name; if (!net.dms.has(uid)) net.send({ t: 'dmHist', with: uid }); const arr = net.dms.get(uid) || [];
  G.openPanel(`<h2>💬 ${esc(name)}</h2><div id="dmList" style="max-height:45vh;overflow:auto;display:flex;flex-direction:column;gap:4px">${arr.map(x => `<div class="dmMsg ${x.mine ? 'mine' : ''}">${esc(x.text)}</div>`).join('') || '<p class="muted">Hãy gửi lời chào đầu tiên 👋</p>'}</div>
   <form id="dmForm" style="display:flex;gap:6px;margin-top:8px"><input id="dmIn" maxlength="300" style="flex:1" placeholder="Nhắn riêng… (không chia sẻ SĐT/địa chỉ)"><button class="pill btn">Gửi</button></form><p class="tiny">Số điện thoại & từ ngữ xấu được tự động ẩn. <a href="#" id="dmRep">🚩 Báo cáo</a></p>`);
  const L = $('dmList'); L.scrollTop = L.scrollHeight; $('dmForm').onsubmit = (e) => { e.preventDefault(); const v = $('dmIn').value.trim(); if (!v) return; net.send({ t: 'dm', to: uid, text: v }); $('dmIn').value = ''; };
  $('dmRep').onclick = (e) => { e.preventDefault(); openReport(uid, name); }; $('panelBody').onclick = null; setTimeout(() => $('dmIn') && $('dmIn').focus(), 50); }
const _close = G.closePanel; $('panelClose').addEventListener('click', () => { dmOpen = null; });
net.openDM = openDM; net.openInbox = openInbox;
