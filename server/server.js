// Đảo Ngọc – realtime + account server. One port serves the static game, the JSON API (/api/*) and WebSocket (/ws).
// Run: cd server && npm install && node server.js   (PORT=8080, DB=./data/daongoc.db)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';
import { cleanText, checkNick, nickKey, normNick } from './filter.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const PORT = +process.env.PORT || 8080;
const DBFILE = process.env.DB || path.join(__dir, 'data', 'daongoc.db');
fs.mkdirSync(path.dirname(DBFILE), { recursive: true });
const log = (...a) => console.log(new Date(Date.now() + 7 * 3600e3).toISOString().replace('T', ' ').slice(0, 19), '(GMT+7)', ...a);

// ---------------- storage (node:sqlite, built into Node ≥22.5) ----------------
const db = new DatabaseSync(DBFILE);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, nick TEXT NOT NULL, nick_key TEXT NOT NULL UNIQUE, pass TEXT NOT NULL, email TEXT, adult INTEGER NOT NULL, rules INTEGER NOT NULL,
  created INTEGER NOT NULL, last_seen INTEGER, data TEXT NOT NULL DEFAULT '{}', xp INTEGER DEFAULT 0, dance INTEGER DEFAULT 0, events INTEGER DEFAULT 0, dates INTEGER DEFAULT 0, banned INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, ua TEXT);
CREATE TABLE IF NOT EXISTS weekly(week TEXT NOT NULL, user_id INTEGER NOT NULL, xp INTEGER DEFAULT 0, dance INTEGER DEFAULT 0, events INTEGER DEFAULT 0, dates INTEGER DEFAULT 0, PRIMARY KEY(week, user_id));
CREATE TABLE IF NOT EXISTS week_rewards(week TEXT NOT NULL, user_id INTEGER NOT NULL, rank INTEGER, xu INTEGER, PRIMARY KEY(week, user_id));
CREATE TABLE IF NOT EXISTS likes(src INTEGER NOT NULL, dst INTEGER NOT NULL, kind TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY(src, dst));
CREATE TABLE IF NOT EXISTS matches(a INTEGER NOT NULL, b INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY(a, b));
CREATE TABLE IF NOT EXISTS friends(a INTEGER NOT NULL, b INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY(a, b));
CREATE TABLE IF NOT EXISTS blocks(src INTEGER NOT NULL, dst INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY(src, dst));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, src INTEGER, dst INTEGER, reason TEXT, context TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS dms(id INTEGER PRIMARY KEY, src INTEGER NOT NULL, dst INTEGER NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS dms_pair ON dms(src, dst, ts);
CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS resets_user ON password_resets(user_id);`);
const q = (sql) => db.prepare(sql);
const Q = {
  userByKey: q('SELECT * FROM users WHERE nick_key=?'), userById: q('SELECT * FROM users WHERE id=?'),
  userByEmail: q('SELECT * FROM users WHERE email IS NOT NULL AND lower(email)=? ORDER BY last_seen DESC'),
  setPass: q('UPDATE users SET pass=? WHERE id=?'),
  insReset: q('INSERT INTO password_resets(token_hash,user_id,expires,used) VALUES(?,?,?,0)'),
  delUserResets: q('DELETE FROM password_resets WHERE user_id=?'),
  resetByHash: q('SELECT * FROM password_resets WHERE token_hash=?'),
  markReset: q('UPDATE password_resets SET used=1 WHERE token_hash=? AND used=0'),
  delUserSess: q('DELETE FROM sessions WHERE user_id=?'),
  gcReset: q('DELETE FROM password_resets WHERE used=1 OR expires<?'),
  insUser: q('INSERT INTO users(nick,nick_key,pass,email,adult,rules,created,last_seen,data) VALUES(?,?,?,?,?,?,?,?,?)'),
  setData: q('UPDATE users SET data=?, xp=?, dance=?, events=?, dates=?, last_seen=? WHERE id=?'),
  insSess: q('INSERT INTO sessions(token,user_id,created,expires,ua) VALUES(?,?,?,?,?)'), sess: q('SELECT * FROM sessions WHERE token=? AND expires>?'),
  delSess: q('DELETE FROM sessions WHERE token=?'), gcSess: q('DELETE FROM sessions WHERE expires<?'),
  upWeek: q('INSERT INTO weekly(week,user_id,xp,dance,events,dates) VALUES(?,?,?,?,?,?) ON CONFLICT(week,user_id) DO UPDATE SET xp=MAX(xp,excluded.xp), dance=MAX(dance,excluded.dance), events=MAX(events,excluded.events), dates=MAX(dates,excluded.dates)'),
  addWeekDate: q('INSERT INTO weekly(week,user_id,dates) VALUES(?,?,1) ON CONFLICT(week,user_id) DO UPDATE SET dates=dates+1'),
  like: q('INSERT OR REPLACE INTO likes(src,dst,kind,ts) VALUES(?,?,?,?)'), likeOf: q("SELECT * FROM likes WHERE src=? AND dst=? AND kind!='pass'"),
  likesToday: q("SELECT COUNT(*) c FROM likes WHERE src=? AND ts>? AND kind!='pass'"), liked: q('SELECT dst FROM likes WHERE src=?'),
  match: q('INSERT OR IGNORE INTO matches(a,b,ts) VALUES(?,?,?)'), matches: q('SELECT CASE WHEN a=? THEN b ELSE a END o FROM matches WHERE a=? OR b=?'),
  isMatch: q('SELECT 1 FROM matches WHERE (a=? AND b=?) OR (a=? AND b=?)'),
  friend: q('INSERT OR IGNORE INTO friends(a,b,ts) VALUES(?,?,?)'), friends: q('SELECT b FROM friends WHERE a=?'),
  block: q('INSERT OR IGNORE INTO blocks(src,dst,ts) VALUES(?,?,?)'), unblock: q('DELETE FROM blocks WHERE src=? AND dst=?'), blocks: q('SELECT dst FROM blocks WHERE src=?'),
  isBlocked: q('SELECT 1 FROM blocks WHERE (src=? AND dst=?) OR (src=? AND dst=?)'),
  report: q('INSERT INTO reports(src,dst,reason,context,ts) VALUES(?,?,?,?,?)'),
  dm: q('INSERT INTO dms(src,dst,text,ts) VALUES(?,?,?,?)'), dmHist: q('SELECT src,dst,text,ts FROM dms WHERE (src=? AND dst=?) OR (src=? AND dst=?) ORDER BY ts DESC LIMIT 40'),
  wkReward: q('SELECT * FROM week_rewards WHERE week=? AND user_id=?'), insWkReward: q('INSERT OR IGNORE INTO week_rewards(week,user_id,rank,xu) VALUES(?,?,?,?)'),
  deck: q("SELECT id,nick,data,last_seen FROM users WHERE id!=? AND banned=0 AND json_extract(data,'$.dating.on')=1 ORDER BY COALESCE(json_extract(data,'$.dating.hlUntil'),0)>? DESC, last_seen DESC LIMIT 80"),
};

// ---------------- helpers ----------------
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
async function hashPw(pw) { const salt = crypto.randomBytes(16); const k = await scrypt(pw, salt); return `scrypt$16384$${salt.toString('base64')}$${k.toString('base64')}`; }
async function verifyPw(pw, stored) { const [, , s, h] = stored.split('$'); const k = await scrypt(pw, Buffer.from(s, 'base64')); const H = Buffer.from(h, 'base64'); return H.length === k.length && crypto.timingSafeEqual(H, k); }
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const bkk = (ms = Date.now()) => new Date(ms + 7 * 3600e3);
const weekId = (ms = Date.now()) => { const d = bkk(ms); const dow = (d.getUTCDay() + 6) % 7; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10); };
const dayStart = () => { const d = bkk(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 7 * 3600e3; };
const J = (s, d = {}) => { try { return JSON.parse(s); } catch { return d; } };
const DEFAULT_DATA = () => ({ xu: 120, owned: { dance1: true, quaytay: true }, equip: { hat: null, glasses: false, hawaii: false, swim: false }, gender: 'm', color: '#ff5a5f', prog: null, dating: null });
const pubUser = (u) => ({ id: u.id, nick: u.nick, email: u.email ? u.email.replace(/(.).*(@.*)/, '$1***$2') : null, created: u.created });

// rate limiting (in memory): key -> [timestamps]
const RL = new Map();
function limited(key, max, winMs) { const now = Date.now(); const a = (RL.get(key) || []).filter(t => now - t < winMs); if (a.length >= max) { RL.set(key, a); return true; } a.push(now); RL.set(key, a); return false; }
const fails = new Map(); // login failures: key -> {n, until}
setInterval(() => { const now = Date.now(); for (const [k, a] of RL) if (!a.some(t => now - t < 3600e3)) RL.delete(k); for (const [k, f] of fails) if (f.until < now && now - f.last > 3600e3) fails.delete(k); Q.gcSess.run(now); Q.gcReset.run(now); }, 600e3).unref();

// ---------------- economy sanity (client-authoritative with caps) ----------------
const SERVER_GRANT = new Map(); // userId -> xu granted by server since last save
const GRANT_HOLD = new Map(); // userId -> { before, after, until } so a save already in flight cannot wipe a playtest grant
const PLAYTEST_XU = 5000;
function grantPlaytestXu(u) {
  if (limited('adminxu:' + u.id, 12, 3600e3)) return { error: 'Đã cấp Xu thử nhiều lần trong giờ này. Thử lại sau.' };
  const fresh = Q.userById.get(u.id) || u;
  const d = J(fresh.data, DEFAULT_DATA());
  const before = Math.floor(+d.xu || 0);
  d.xu = before + PLAYTEST_XU;
  saveUser(fresh, d);
  for (const cl of clients.values()) if (cl.user.id === u.id) { cl.user.data = fresh.data; cl.user.last_seen = fresh.last_seen; }
  if (u !== fresh) { u.data = fresh.data; u.last_seen = fresh.last_seen; }
  SERVER_GRANT.set(u.id, (SERVER_GRANT.get(u.id) || 0) + PLAYTEST_XU);
  GRANT_HOLD.set(u.id, { before, after: d.xu, until: Date.now() + 20000 });
  log('playtest xu', fresh.nick, before, '->', d.xu);
  return { xu: d.xu, add: PLAYTEST_XU };
}
function sanitizeData(u, incoming) {
  const old = J(u.data, DEFAULT_DATA()); const d = { ...old };
  const mins = Math.max(0, (Date.now() - (u.last_seen || u.created)) / 60000);
  const allow = 300 + Math.min(mins, 24 * 60) * 40 + (SERVER_GRANT.get(u.id) || 0); SERVER_GRANT.delete(u.id);
  if (Number.isFinite(incoming.xu)) {
    let next = Math.max(0, Math.min(Math.floor(incoming.xu), (old.xu || 0) + allow));
    const hold = GRANT_HOLD.get(u.id);
    if (hold && Date.now() > hold.until) GRANT_HOLD.delete(u.id);
    else if (hold && Math.floor(incoming.xu) <= hold.before + 300) next = hold.after + Math.max(0, Math.min(300, Math.floor(incoming.xu) - hold.before));
    d.xu = next;
  }
  if (incoming.owned !== undefined) { const ow = {}; if (incoming.owned && typeof incoming.owned === 'object') for (const [k, v] of Object.entries(incoming.owned).slice(0, 2000)) if (/^[a-z0-9_]{1,40}$/i.test(k) && v) ow[k] = true; d.owned = ow; }
  for (const k of ['equip', 'lastCheckin', 'liveRewards', 'evDone', 'lastShare', 'color', 'gender', 'server']) if (incoming[k] !== undefined) d[k] = incoming[k];
  if (incoming.prog && typeof incoming.prog === 'object') { const p = incoming.prog, op = old.prog || { xp: 0 }; const xpAllow = 600 + Math.min(mins, 24 * 60) * 150;
    p.xp = Math.max(0, Math.min(+p.xp || 0, (op.xp || 0) + xpAllow)); d.prog = p; }
  if (incoming.dating) d.dating = sanitizeDating(incoming.dating, old.dating);
  if (incoming.look && typeof incoming.look === 'object') d.look = sanitizeLook(incoming.look);
  const s = JSON.stringify(d); if (s.length > 64000) throw new Error('Dữ liệu quá lớn'); return d;
}
function sanitizeDating(x, old = {}) { if (!x) return old; const I = ['bien', 'cafe', 'nhay', 'anuong', 'nhac', 'chupanh', 'dulich', 'thethao'];
  const adult = !!(x.adult || x.on); return { on: adult && String(x.bio || '').trim() ? 1 : 0, adult, gender: ['m', 'f', 'o'].includes(x.gender) ? x.gender : 'o', looking: ['m', 'f', 'all'].includes(x.looking) ? x.looking : 'all', bio: cleanText(String(x.bio || '').slice(0, 140)),
    interests: (Array.isArray(x.interests) ? x.interests : []).filter(i => I.includes(i)).slice(0, 6), age: Math.max(18, Math.min(80, +x.age || 18)), hlUntil: old && old.hlUntil || 0, extraLikes: old && old.extraLikes || null }; }
function saveUser(u, d) { const p = d.prog || {}; const s = p.stats || {}; const w = p.week || {};
  Q.setData.run(JSON.stringify(d), p.xp || 0, Math.floor((s.dance || 0) / 60), s.events || 0, s.dates || 0, Date.now(), u.id); u.data = JSON.stringify(d); u.last_seen = Date.now();
  if (w.id === weekId()) Q.upWeek.run(w.id, u.id, w.xp || 0, Math.floor((w.dance || 0) / 60), w.events || 0, w.dates || 0); }
// weekly reward for last week's level board (XP in week)
const WEEK_REWARD = (r) => r === 1 ? 300 : r === 2 ? 200 : r === 3 ? 150 : r <= 10 ? 50 : 0;
function weeklyReward(u) { const last = weekId(Date.now() - 7 * 864e5); if (Q.wkReward.get(last, u.id)) return null; const me = q('SELECT xp FROM weekly WHERE week=? AND user_id=?').get(last, u.id);
  if (!me || !me.xp) return null; const rank = q('SELECT COUNT(*) c FROM weekly WHERE week=? AND xp>?').get(last, me.xp).c + 1; const xu = WEEK_REWARD(rank); Q.insWkReward.run(last, u.id, rank, xu); if (!xu) return null;
  const d = J(u.data, DEFAULT_DATA()); d.xu = (d.xu || 0) + xu; if (rank === 1 && d.prog) { d.prog.titles = d.prog.titles || {}; d.prog.titles.top1 = 1; } d.prog = d.prog || null; if (d.prog) { d.prog.wkRewards = d.prog.wkRewards || {}; d.prog.wkRewards[last] = rank; }
  Q.setData.run(JSON.stringify(d), u.xp, u.dance, u.events, u.dates, Date.now(), u.id); u.data = JSON.stringify(d); return { week: last, rank, xu }; }
function leaderboard(cat, per, meId) {
  const col = { level: 'xp', dance: 'dance', events: 'events', couples: 'dates' }[cat] || 'xp'; let rows;
  if (per === 'week') rows = q(`SELECT u.id, u.nick, u.xp uxp, u.data, w.${col} score FROM weekly w JOIN users u ON u.id=w.user_id WHERE w.week=? AND u.banned=0 AND w.${col}>0 ORDER BY w.${col} DESC LIMIT 50`).all(weekId());
  else rows = q(`SELECT id, nick, xp uxp, data, ${col} score FROM users WHERE banned=0 AND ${col}>0 ORDER BY ${col} DESC LIMIT 50`).all();
  return rows.map((r, i) => { const d = J(r.data); const t = d.prog && d.prog.title; return { rank: i + 1, id: r.id, name: r.nick, score: r.score, level: levelOf(r.uxp || 0), title: TITLE_TXT[t] || '', me: r.id === meId }; }); }
function levelOf(xp) { let L = 1, need = 120; while (xp >= need) { xp -= need; L++; need = 80 + 40 * L; } return L; }
const TITLE_TXT = { tanbinh: '🌱 Tân binh Đảo Ngọc', vuasan: '🕺 Vua sàn nhảy', dancbien: '🏖️ Dân chơi bãi biển', cafe: '☕ Tín đồ cà phê', fandj: '🎧 Fan cứng DJ', capdoi: '💞 Cặp đôi của tuần', nhiepanh: '📸 Nhiếp ảnh gia', sukien: '📅 Thổ địa sự kiện', top1: '🏆 Quán quân tuần' };

function auth(token) { if (!token) return null; const s = Q.sess.get(sha(token), Date.now()); if (!s) return null; const u = Q.userById.get(s.user_id); return u && !u.banned ? u : null; }
const ipOf = (req) => (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const RESET_MS = 45 * 60 * 1000;
const FORGOT_MSG = 'Nếu email này đã được dùng để đăng ký, chúng tôi đã gửi liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư và thư rác. Liên kết có hiệu lực 45 phút và chỉ dùng một lần.';
function pwError(pw, nick) {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 128) return 'Mật khẩu cần 8–128 ký tự';
  if (!/[a-zA-Z\p{L}]/u.test(pw) || !/\d/.test(pw)) return 'Mật khẩu cần có cả chữ và số';
  if (nick && pw.toLowerCase().includes(String(nickKey(nick)).replace(/ /g, ''))) return 'Mật khẩu không được chứa biệt danh';
  return null;
}
function publicOrigin(req) {
  const env = (process.env.PUBLIC_URL || process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  if (env) return env;
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}
async function sendResetMail(to, link) {
  const from = process.env.MAIL_FROM || 'Đảo Ngọc <onboarding@resend.dev>';
  const subject = 'Đặt lại mật khẩu Đảo Ngọc';
  const text = `Bạn đã yêu cầu đặt lại mật khẩu Đảo Ngọc.\n\nMở liên kết này trong vòng 45 phút (chỉ dùng một lần):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`;
  const html = `<p>Bạn đã yêu cầu đặt lại mật khẩu <b>Đảo Ngọc</b>.</p><p><a href="${link}">Đặt lại mật khẩu</a></p><p>Liên kết có hiệu lực 45 phút và chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`;
  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, text, html }) });
    if (!r.ok) { const t = await r.text(); log('resend fail', r.status, t.slice(0, 240)); throw new Error('resend'); }
    return 'resend';
  }
  if (process.env.SMTP_URL) {
    const nm = await import('nodemailer');
    const create = nm.createTransport || nm.default.createTransport;
    const tx = create(process.env.SMTP_URL);
    await tx.sendMail({ from, to, subject, text, html });
    return 'smtp';
  }
  log('MAIL NOT CONFIGURED — reset link for', to, link);
  return 'log';
}
async function issueReset(user, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  Q.delUserResets.run(user.id);
  Q.insReset.run(sha(token), user.id, Date.now() + RESET_MS);
  const link = `${publicOrigin(req)}/?reset=${encodeURIComponent(token)}`;
  const via = await sendResetMail(user.email, link);
  log('reset issued', user.id, via);
}

// ---------------- HTTP: API + static ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8', '.webp': 'image/webp' };
const send = (res, code, obj, hdr = {}) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...hdr }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((res, rej) => { let b = ''; req.on('data', c => { b += c; if (b.length > 100000) { rej(new Error('too big')); req.destroy(); } }); req.on('end', () => { try { res(b ? JSON.parse(b) : {}); } catch (e) { rej(e); } }); });
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;

async function api(req, res, p) {
  const ip = ipOf(req);
  if (p === '/api/health') return send(res, 200, { ok: true, online: clients.size, time: Date.now(), week: weekId() });
  if (req.method === 'POST' && p === '/api/register') {
    if (limited('reg:' + ip, 5, 3600e3)) return send(res, 429, { error: 'Bạn tạo tài khoản quá nhiều lần, thử lại sau 1 giờ' });
    const b = await body(req); const nick = normNick(b.nick); const bad = checkNick(nick); if (bad) return send(res, 400, { error: bad, field: 'nick' });
    const pwBad = pwError(b.password, nick); if (pwBad) return send(res, 400, { error: pwBad, field: 'password' });
    const email = (b.email || '').trim().toLowerCase(); if (email && !EMAIL_RE.test(email)) return send(res, 400, { error: 'Email không hợp lệ', field: 'email' });
    if (b.adult !== true) return send(res, 400, { error: 'Bạn phải xác nhận đủ 18 tuổi', field: 'adult' });
    if (b.rules !== true) return send(res, 400, { error: 'Bạn cần đồng ý Nội quy đảo', field: 'rules' });
    if (Q.userByKey.get(nickKey(nick))) return send(res, 409, { error: 'Biệt danh đã có người dùng', field: 'nick' });
    const d = DEFAULT_DATA(); if (b.data) Object.assign(d, sanitizeData({ data: JSON.stringify(d), created: Date.now(), last_seen: Date.now(), id: 0 }, { gender: b.data.gender, color: b.data.color }));
    let id; try { id = Q.insUser.run(nick, nickKey(nick), await hashPw(b.password), email || null, 1, 1, Date.now(), Date.now(), JSON.stringify(d)).lastInsertRowid; }
    catch (e) { return send(res, 409, { error: 'Biệt danh đã có người dùng', field: 'nick' }); }
    log('register', id, nick, ip); return send(res, 200, session(Q.userById.get(id), !!b.remember, req));
  }
  if (req.method === 'POST' && p === '/api/login') {
    const b = await body(req); const key = nickKey(b.nick); const fk = key + '|' + ip; const f = fails.get(fk);
    if (f && f.until > Date.now()) return send(res, 429, { error: `Sai quá nhiều lần. Thử lại sau ${Math.ceil((f.until - Date.now()) / 60000)} phút` });
    if (limited('login:' + ip, 30, 600e3)) return send(res, 429, { error: 'Quá nhiều lần đăng nhập từ mạng này, thử lại sau ít phút' });
    const u = Q.userByKey.get(key); const ok = u && typeof b.password === 'string' && await verifyPw(b.password, u.pass);
    if (!ok) { const n = (f && f.until < Date.now() && f.n >= 5 ? 0 : f ? f.n : 0) + 1; fails.set(fk, { n, last: Date.now(), until: n >= 5 ? Date.now() + 10 * 60e3 : 0 }); return send(res, 401, { error: `Sai biệt danh hoặc mật khẩu${n >= 3 ? ` (còn ${Math.max(0, 5 - n)} lần trước khi bị khóa 10 phút)` : ''}` }); }
    if (u.banned) return send(res, 403, { error: 'Tài khoản đã bị khóa do vi phạm nội quy' });
    fails.delete(fk); log('login', u.id, u.nick, ip); return send(res, 200, session(u, !!b.remember, req));
  }
  if (req.method === 'POST' && p === '/api/forgot') {
    if (limited('forgot:' + ip, 5, 3600e3)) return send(res, 429, { error: 'Bạn yêu cầu quá nhiều lần. Thử lại sau ít phút.' });
    const b = await body(req);
    const email = String(b.email || '').trim().toLowerCase();
    const nick = String(b.nick || '').trim();
    if (!EMAIL_RE.test(email)) return send(res, 400, { error: 'Email không hợp lệ', field: 'email' });
    if (limited('forgot-mail:' + sha(email), 3, 3600e3)) return send(res, 429, { error: 'Bạn yêu cầu quá nhiều lần. Thử lại sau ít phút.' });
    try {
      let user = null;
      if (nick) { const byNick = Q.userByKey.get(nickKey(nick)); if (byNick && byNick.email && byNick.email.toLowerCase() === email && !byNick.banned) user = byNick; }
      else { const rows = Q.userByEmail.all(email).filter(u => !u.banned); if (rows.length === 1) user = rows[0]; }
      if (user && user.email) await issueReset(user, req);
      else log('reset skipped', nick ? 'nick/email mismatch or missing' : 'no single account');
    } catch (e) { log('reset mail error', e.message); }
    return send(res, 200, { ok: true, message: FORGOT_MSG });
  }
  if (req.method === 'POST' && p === '/api/reset') {
    if (limited('reset:' + ip, 10, 3600e3)) return send(res, 429, { error: 'Bạn thử quá nhiều lần. Thử lại sau ít phút.' });
    const b = await body(req);
    const token = String(b.token || '');
    const row = token.length >= 20 && token.length < 200 ? Q.resetByHash.get(sha(token)) : null;
    const user = row ? Q.userById.get(row.user_id) : null;
    if (!row || row.used || row.expires < Date.now() || !user || user.banned) return send(res, 400, { error: 'Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.' });
    const pwBad = pwError(b.password, user.nick); if (pwBad) return send(res, 400, { error: pwBad, field: 'password' });
    if (!Q.markReset.run(sha(token)).changes) return send(res, 400, { error: 'Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.' });
    Q.setPass.run(await hashPw(b.password), user.id);
    Q.delUserSess.run(user.id);
    for (const c of clients.values()) if (c.user.id === user.id) { try { c.ws.close(4001, 'reset'); } catch {} }
    log('password reset', user.id);
    return send(res, 200, { ok: true, message: 'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.' });
  }
  const u = auth(bearer(req)); if (!u) return send(res, 401, { error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại' });
  if (req.method === 'POST' && p === '/api/logout') { Q.delSess.run(sha(bearer(req))); for (const c of clients.values()) if (c.user.id === u.id) c.ws.close(4001, 'logout'); return send(res, 200, { ok: true }); }
  if (p === '/api/me') { const rw = weeklyReward(u); return send(res, 200, { user: pubUser(u), data: J(u.data, DEFAULT_DATA()), blocks: Q.blocks.all(u.id).map(r => r.dst), matches: matchList(u.id), friends: Q.friends.all(u.id).map(r => r.b), weeklyReward: rw, week: weekId() }); }
  if (req.method === 'POST' && p === '/api/save') { const b = await body(req); const d = sanitizeData(u, b.data || {}); saveUser(u, d); return send(res, 200, { ok: true, xu: d.xu }); }
  if (req.method === 'POST' && p === '/api/admin-xu') { const r = grantPlaytestXu(u); return send(res, r.error ? 429 : 200, r); }
  if (p === '/api/leaderboard') { const sp = new URL(req.url, 'http://x').searchParams; return send(res, 200, { rows: leaderboard(sp.get('cat'), sp.get('per'), u.id), week: weekId() }); }
  return send(res, 404, { error: 'not found' });
}
function session(u, remember, req) { const token = crypto.randomBytes(32).toString('base64url'); const ttl = remember ? 30 * 864e5 : 864e5;
  Q.insSess.run(sha(token), u.id, Date.now(), Date.now() + ttl, String(req.headers['user-agent'] || '').slice(0, 120)); return { token, expires: Date.now() + ttl, user: pubUser(u), data: J(u.data, DEFAULT_DATA()) }; }
const matchList = (id) => Q.matches.all(id, id, id).map(r => { const o = Q.userById.get(r.o); return o ? { id: o.id, nick: o.nick, online: [...clients.values()].some(c => c.user.id === o.id) } : null; }).filter(Boolean);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); let p = decodeURIComponent(url.pathname);
  if (p.startsWith('/api/')) { try { return await api(req, res, p); } catch (e) { log('api error', p, e.message); return send(res, 400, { error: 'Yêu cầu không hợp lệ' }); } }
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(ROOT + path.sep) || /[\\/](\.|server[\\/]|node_modules|ref[\\/])/.test(f.slice(ROOT.length))) { res.writeHead(404); return res.end('Not found'); }
  fs.stat(f, (e, s) => { if (e || !s.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': p.endsWith('.html') || p.endsWith('config.json') ? 'no-cache' : 'public, max-age=300', 'x-content-type-options': 'nosniff' }); fs.createReadStream(f).pipe(res); });
});

// ---------------- WebSocket realtime ----------------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 });
const clients = new Map(); // cid -> client
let nextCid = 1;
const ROOMS = ['day', 'sunset', 'night'];
const sendTo = (c, m) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); };
const byUser = (uid) => [...clients.values()].find(c => c.user.id === uid);
const blockedPair = (a, b) => !!Q.isBlocked.get(a, b, b, a);
const roomOf = (r) => [...clients.values()].filter(c => c.room === r && c.ready);
function bcast(room, m, except, filterFn) { const s = JSON.stringify(m); for (const c of clients.values()) if (c.ready && c.room === room && c !== except && (!filterFn || filterFn(c)) && c.ws.readyState === 1) c.ws.send(s); }
// private date instances: players with the same c.inst see each other; '' = public island
const bcastI = (c, m, except, filterFn) => bcast(c.room, m, except, (o) => o.inst === c.inst && (!filterFn || filterFn(o)));
const PRIVATE = new Set(['cove', 'pierend', 'gazebo', 'lagoonbench', 'garden', 'rooftop', 'boat', 'bonfire2', 'cabana2']);
const insts = new Map(); // inst id -> { spot, members:Set<userId>, start }
let nextInst = 1; const pendingInst = new Map(); // userId -> inst id (partner still switching island)
const canDate = (a, b) => !!Q.isMatch.get(a, b, b, a) || Q.friends.all(a).some(r => r.b === b) || Q.friends.all(b).some(r => r.b === a);
function privBusy() { const b = {}; for (const i of insts.values()) b[i.spot] = (b[i.spot] || 0) + 1; return b; }
function sendBusy() { const msg = { t: 'privBusy', busy: privBusy() }; for (const c of clients.values()) if (c.ready) sendTo(c, msg); }
function setInst(c, inst) { if (c.inst === inst) return; const old = c.inst; if (c.ready) bcastI(c, { t: 'leave', id: c.id }, c);
  if (old && insts.has(old)) { const I = insts.get(old); I.members.delete(c.user.id); if (!I.members.size) insts.delete(old); }
  c.inst = inst; const I = inst && insts.get(inst);
  sendTo(c, { t: 'instSwap', inst, spot: I ? I.spot : null, players: roomOf(c.room).filter(o => o !== c && o.inst === inst).map(pubPlayer) });
  if (c.ready) bcastI(c, { t: 'join', p: pubPlayer(c), quiet: true }, c); sendBusy(); }
const pubPlayer = (c) => ({ id: c.id, uid: c.user.id, name: c.user.nick, look: c.look, level: c.level, title: c.title, badge: c.badge, x: c.x, y: c.y, z: c.z, yaw: c.yaw, anim: c.anim });
const LOOK_ENUM = { hairStyle: ['short', 'buzz', 'undercut', 'twoblock', 'spiky', 'fauxhawk', 'sidepart', 'pompadour', 'quiff', 'mullet', 'curly', 'afro', 'manbun', 'longm', 'dreads', 'bald', 'long', 'wavy', 'curlylong', 'curtain', 'pony', 'highpony', 'bun', 'bunlow', 'spacebuns', 'halfup', 'bob', 'lob', 'pixie', 'braid', 'twinbraids', 'twintails', 'sidebraid'], hairFx: ['highlight', 'ombre'],
  top: ['tee', 'polo', 'shirt', 'hawaii', 'tank', 'hoodie', 'blazer', 'tuxedo', 'aodai', 'pajama', 'graphic', 'jacketopen', 'none', 'blouse', 'crop', 'dress', 'party', 'gown', 'onepiece', 'bikini', 'royal', 'royalgown', 'sequingown', 'redtux', 'cyber', 'angelrobe', 'devilsuit', 'captain', 'silkresort', 'aodaigold', 'kpop', 'knight', 'mermaid', 'seagod', 'discosuit', 'montsuki', 'aodainam', 'aotuthan', 'kimono', 'furisode', 'yukata', 'hanbok', 'hanbokm', 'qipao', 'qipaogold', 'tangsuit', 'chutthai', 'saree', 'kurta', 'flamenco', 'fiesta', 'carnival', 'poncho', 'charro', 'hulatop'],
  bottom: ['trousers', 'jeans', 'cargo', 'shorts', 'boardshorts', 'joggers', 'wide', 'pjpants', 'skirt', 'longskirt', 'sarong', 'none', 'hakama', 'kilt', 'grassskirt'],
  shoes: ['sneakers', 'hightop', 'chunky', 'oxford', 'loafers', 'platform', 'chelsea', 'boots', 'sandals', 'slides', 'flipflops', 'banhmi', 'guoc', 'clogs', 'flats', 'stiletto', 'block', 'platformheels', 'strappy', 'wedges', 'heels', 'none', 'geta', 'ledsneakers', 'royalboots'],
  hat: ['straw', 'sunhat', 'fedora', 'beanie', 'cap', 'flower', 'nonla', 'santa', 'witch', 'horns', 'beret', 'catears', 'headphones', 'khanvan', 'tiara', 'kingcrown', 'khandong', 'nonquai', 'halo', 'captainhat', 'sombrero', 'peruhat', 'feathers', 'kanzashi'],
  necklace: ['gold', 'pearl', 'cuban', 'lei', 'bling'], beard: ['stubble', 'full'], build: ['slim', 'broad', 'curvy'], glassesStyle: ['shield', 'heart', 'led', 'round', 'visor'],
  bag: ['tote', 'cross', 'backpack', 'clutch', 'luxe'], wings: ['angel', 'devil', 'fairy', 'neon', 'cupid', 'gold'], aura: ['gold', 'pink', 'neon', 'snow', 'heart', 'tet', 'flame', 'bubble', 'disco', 'stardust'] };
const sanitizeLook = (l = {}) => { if (!l || typeof l !== 'object') l = {}; const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d); const en = (k) => (LOOK_ENUM[k].includes(l[k]) ? l[k] : null);
  const o = { gender: l.gender === 'f' ? 'f' : 'm', skin: hex(l.skin, '#e0ac69'), hair: hex(l.hair, '#1b1210'), eye: hex(l.eye, '#3b2416'), hairStyle: en('hairStyle') || (l.gender === 'f' ? 'long' : 'short'), hair2: hex(l.hair2, null), hairFx: en('hairFx'),
    top: en('top'), topC: hex(l.topC, hex(l.shirt, '#ff5a5f')), bottom: en('bottom'), bottomC: hex(l.bottomC, hex(l.pants, '#263238')), shoes: en('shoes'), shoesC: hex(l.shoesC, '#f2f2f2'),
    hat: en('hat'), hatC: hex(l.hatC, null), glasses: !!l.glasses, glassesC: hex(l.glassesC, '#0c0c0c'), glassesStyle: en('glassesStyle'), necklace: en('necklace'), beard: en('beard'), build: en('build'),
    watch: !!l.watch, watchC: hex(l.watchC, null), crown: !!l.crown, ring: !!l.ring, bracelet: !!l.bracelet, hipChain: !!l.hipChain, lips: hex(l.lips, undefined), bag: en('bag'), bagC: hex(l.bagC, null), wings: en('wings'), aura: en('aura'), h: Number.isFinite(+l.h) ? Math.max(0.9, Math.min(1.1, +l.h)) : null, swim: !!l.swim, hawaii: !!l.hawaii, shortSleeve: true };
  for (const k of Object.keys(o)) if (o[k] === null || o[k] === undefined) delete o[k]; return o; };
const ANIM_RE = /^[a-z0-9]{1,16}$/i;
const dates = new Map(); // pairKey -> {a,b,place,x,z,t,start}
const pairKey = (a, b) => a < b ? a + ':' + b : b + ':' + a;

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x'); const u = auth(url.searchParams.get('token'));
  if (!u) { ws.send(JSON.stringify({ t: 'error', code: 'auth', msg: 'Cần đăng nhập để chơi online' })); return ws.close(4001, 'auth'); }
  if (limited('ws:' + ipOf(req), 20, 60e3)) return ws.close(4029, 'rate');
  for (const c of clients.values()) if (c.user.id === u.id) { sendTo(c, { t: 'sys', msg: 'Tài khoản vừa đăng nhập ở nơi khác' }); c.ws.close(4002, 'dup'); }
  const c = { id: nextCid++, ws, user: u, room: 'day', inst: '', ready: false, x: 0, y: 0, z: 0, yaw: 0, anim: 'idle', look: sanitizeLook(), level: levelOf(u.xp), title: '', badge: null, blocks: new Set(Q.blocks.all(u.id).map(r => r.dst)), lastSt: 0, dirty: false, alive: true };
  clients.set(c.id, c); ws.on('pong', () => { c.alive = true; });
  ws.on('message', (raw) => { let m; try { m = JSON.parse(raw); } catch { return; } if (!m || typeof m.t !== 'string') return; try { handle(c, m); } catch (e) { log('ws err', m.t, e.message); } });
  ws.on('close', () => { clients.delete(c.id); if (c.inst && insts.has(c.inst)) { const I = insts.get(c.inst); I.members.delete(u.id); if (!I.members.size) insts.delete(c.inst); else for (const o of clients.values()) if (o.inst === c.inst) setInst(o, ''); sendBusy(); } if (c.ready) { bcast(c.room, { t: 'leave', id: c.id }); log('leave', c.user.nick, c.room); } });
});
function handle(c, m) {
  const u = c.user;
  switch (m.t) {
    case 'hello': { c.room = ROOMS.includes(m.room) ? m.room : 'day'; c.look = sanitizeLook(m.look); c.title = TITLE_TXT[m.title] || ''; c.badge = typeof m.badge === 'string' ? m.badge.slice(0, 4) : null; c.level = levelOf(J(Q.userById.get(u.id).data).prog?.xp || u.xp || 0);
      Object.assign(c, num3(m)); c.ready = true;
      const pi = pendingInst.get(u.id); if (pi && insts.has(pi)) { pendingInst.delete(u.id); c.inst = pi; insts.get(pi).members.add(u.id); } else if (c.inst) setInst(c, ''); const others = roomOf(c.room).filter(o => o !== c && o.inst === c.inst).map(pubPlayer); sendTo(c, { t: 'welcome', id: c.id, uid: u.id, room: c.room, players: others, online: clients.size, matches: matchList(u.id), busy: privBusy(), inst: c.inst || '', spot: c.inst && insts.has(c.inst) ? insts.get(c.inst).spot : null }); if (c.inst) sendBusy();
      bcastI(c, { t: 'join', p: pubPlayer(c) }, c); log('join', u.nick, c.room, 'online', clients.size); break; }
    case 'st': if (!c.ready) return; Object.assign(c, num3(m)); if (typeof m.anim === 'string' && ANIM_RE.test(m.anim)) c.anim = m.anim; if (Number.isFinite(m.yaw)) c.yaw = +m.yaw; c.dirty = true; break;
    case 'look': c.look = sanitizeLook(m.look); c.title = TITLE_TXT[m.title] || ''; c.badge = typeof m.badge === 'string' ? m.badge.slice(0, 4) : null; if (Number.isFinite(m.level)) c.level = Math.max(1, Math.min(999, m.level | 0)); bcastI(c, { t: 'look', id: c.id, look: c.look, title: c.title, badge: c.badge, level: c.level }, c); break;
    case 'chat': { if (limited('chat:' + u.id, 6, 8000)) return sendTo(c, { t: 'sys', msg: 'Bạn chat nhanh quá, chậm lại chút nhé 🙏' });
      const text = cleanText(String(m.text || '').slice(0, 120)).trim(); if (!text) return; const scope = m.scope === 'near' ? 'near' : 'global';
      const out = { t: 'chat', id: c.id, uid: u.id, name: u.nick, text, scope };
      bcastI(c, out, null, (o) => !o.blocks.has(u.id) && !c.blocks.has(o.user.id) && (scope === 'global' || o === c || Math.hypot(o.x - c.x, o.z - c.z) < 18)); break; }
    case 'dm': { if (limited('dm:' + u.id, 10, 10000)) return sendTo(c, { t: 'sys', msg: 'Bạn nhắn nhanh quá 🙏' }); const to = Q.userById.get(+m.to); if (!to || to.id === u.id) return;
      if (blockedPair(u.id, to.id)) return sendTo(c, { t: 'sys', msg: 'Không thể nhắn tin cho người này' }); const text = cleanText(String(m.text || '').slice(0, 300)).trim(); if (!text) return;
      Q.dm.run(u.id, to.id, text, Date.now()); const out = { t: 'dm', from: u.id, fromName: u.nick, to: to.id, toName: to.nick, text, ts: Date.now() }; sendTo(c, out); const oc = byUser(to.id); if (oc) sendTo(oc, out); break; }
    case 'dmHist': { const o = +m.with; const rows = Q.dmHist.all(u.id, o, o, u.id).reverse(); sendTo(c, { t: 'dmHist', with: o, rows }); break; }
    case 'emote': case 'react': { if (limited('fx:' + u.id, 12, 5000)) return; const e = String(m.e || m.k || m.kind || '').slice(0, 16); if (!ANIM_RE.test(e)) return; bcastI(c, { t: m.t, id: c.id, e, name: u.nick }, c, (o) => !o.blocks.has(u.id)); break; }
    case 'gift': { const g = String(m.g || m.kind || '').slice(0, 8); bcastI(c, { t: 'gift', id: c.id, name: u.nick, kind: g }, c); break; } // virtual-only DJ gifts (Xu deducted client side)
    case 'save': { const d = sanitizeData(u, m.data || {}); saveUser(u, d); sendTo(c, { t: 'saved', xu: d.xu }); break; }
    case 'adminXu': { const r = grantPlaytestXu(u); sendTo(c, { t: 'adminXu', ...r }); break; }
    case 'profiles': { const me = J(Q.userById.get(u.id).data).dating || {}; const seen = new Set(Q.liked.all(u.id).map(r => r.dst)); const hl = Date.now();
      const list = Q.deck.all(u.id, hl).filter(r => !seen.has(r.id) && !blockedPair(u.id, r.id)).map(r => { const d = J(r.data).dating || {}; return { uid: r.id, nick: r.nick, gender: d.gender, looking: d.looking, bio: d.bio, interests: d.interests, age: d.age, hl: (d.hlUntil || 0) > hl, online: !!byUser(r.id), level: levelOf(J(r.data).prog?.xp || 0) }; })
        .filter(p => (me.looking === 'all' || !me.looking || p.gender === me.looking) && (p.looking === 'all' || !p.looking || p.looking === me.gender)).slice(0, 30);
      sendTo(c, { t: 'profiles', list }); break; }
    case 'like': { const to = Q.userById.get(+m.to); if (!to || to.id === u.id || blockedPair(u.id, to.id)) return; const kind = ['like', 'super', 'pass'].includes(m.kind) ? m.kind : 'like';
      const d = J(Q.userById.get(u.id).data); const today = bkk().toISOString().slice(0, 10); const extra = d.dating && d.dating.extraLikes && d.dating.extraLikes.day === today ? d.dating.extraLikes.n : 0;
      if (kind !== 'pass' && Q.likesToday.get(u.id, dayStart()).c >= 20 + extra) return sendTo(c, { t: 'likeLimit', msg: 'Hết lượt thích hôm nay (20). Mua thêm lượt bằng Xu hoặc quay lại ngày mai 💘' });
      Q.like.run(u.id, to.id, kind, Date.now()); const oc = byUser(to.id);
      if (kind === 'super' && oc) sendTo(oc, { t: 'superLike', from: u.id, name: u.nick });
      if (kind !== 'pass' && Q.likeOf.get(to.id, u.id)) { Q.match.run(Math.min(u.id, to.id), Math.max(u.id, to.id), Date.now()); sendTo(c, { t: 'match', with: { id: to.id, nick: to.nick } }); if (oc) sendTo(oc, { t: 'match', with: { id: u.id, nick: u.nick } }); log('match', u.nick, to.nick); }
      else sendTo(c, { t: 'liked', to: to.id, kind }); break; }
    case 'buy': { // mock monetization with Xu (virtual): extra likes, super like, highlight
      const P = { likes10: 30, super: 40, highlight: 50 }; const price = P[m.item]; if (!price) return; const uu = Q.userById.get(u.id); const d = J(uu.data, DEFAULT_DATA());
      if ((d.xu || 0) < price) return sendTo(c, { t: 'bought', ok: false, msg: 'Không đủ Xu', xu: d.xu }); d.xu -= price; d.dating = d.dating || { on: 0 }; const today = bkk().toISOString().slice(0, 10);
      if (m.item === 'likes10') d.dating.extraLikes = { day: today, n: (d.dating.extraLikes && d.dating.extraLikes.day === today ? d.dating.extraLikes.n : 0) + 10 };
      if (m.item === 'highlight') d.dating.hlUntil = Date.now() + 24 * 3600e3; if (m.item === 'super') d.dating.supers = (d.dating.supers || 0) + 1;
      Q.setData.run(JSON.stringify(d), uu.xp, uu.dance, uu.events, uu.dates, Date.now(), u.id); sendTo(c, { t: 'bought', ok: true, item: m.item, xu: d.xu }); break; }
    case 'friend': { const to = +m.to; if (!Q.userById.get(to) || to === u.id || blockedPair(u.id, to)) return; Q.friend.run(u.id, to, Date.now()); const mutual = Q.friends.all(to).some(r => r.b === u.id); sendTo(c, { t: 'friended', to, mutual }); const oc = byUser(to); if (oc) sendTo(oc, { t: 'friendReq', from: u.id, name: u.nick, mutual }); break; }
    case 'block': { const to = +m.to; if (!to || to === u.id) return; Q.block.run(u.id, to, Date.now()); c.blocks.add(to); sendTo(c, { t: 'blocked', to }); if (c.inst) { const inst = c.inst; for (const o of [...clients.values()]) if (o.inst === inst) { setInst(o, ''); if (o !== c) sendTo(o, { t: 'sys', msg: 'Buổi hẹn riêng tư đã kết thúc' }); } } break; }
    case 'unblock': { const to = +m.to; Q.unblock.run(u.id, to); c.blocks.delete(to); sendTo(c, { t: 'unblocked', to }); break; }
    case 'report': { const to = +m.to; if (!to || limited('rep:' + u.id, 10, 3600e3)) return; Q.report.run(u.id, to, String(m.reason || '').slice(0, 60), String(m.context || '').slice(0, 500), Date.now()); log('REPORT', u.nick, '->', to, m.reason); sendTo(c, { t: 'sys', msg: 'Đã gửi báo cáo tới ban quản trị. Cảm ơn bạn! 🙏' }); break; }
    case 'dateInvite': { const to = +m.to; const oc = byUser(to); if (!canDate(u.id, to)) return sendTo(c, { t: 'sys', msg: 'Chỉ rủ hẹn được người đã ghép đôi hoặc bạn bè 💘' });
      if (!oc) return sendTo(c, { t: 'sys', msg: 'Người ấy đang offline' }); if (blockedPair(u.id, to)) return; const place = String(m.place || '').slice(0, 16);
      sendTo(oc, { t: 'dateInvite', from: u.id, name: u.nick, place, x: +m.x || 0, z: +m.z || 0, room: c.room }); sendTo(c, { t: 'sys', msg: `Đã gửi lời rủ hẹn tới ${oc.user.nick} 💌` }); break; }
    case 'dateReply': { const from = +m.from; const oc = byUser(from); if (!oc || !canDate(u.id, from) || blockedPair(u.id, from)) return;
      if (!m.accept) return sendTo(oc, { t: 'sys', msg: `${u.nick} chưa rảnh lúc này 🙏` }); const x = +m.x || 0, z = +m.z || 0, place = String(m.place || '').slice(0, 16);
      dates.set(pairKey(u.id, from), { a: u.id, b: from, place, x, z, t: 0, start: Date.now() });
      if (PRIVATE.has(place)) { const id = 'p' + nextInst++; insts.set(id, { spot: place, members: new Set([u.id, from]), start: Date.now() }); if (oc.room === c.room) setInst(c, id); else { pendingInst.set(u.id, id); setTimeout(() => { if (pendingInst.get(u.id) === id) { pendingInst.delete(u.id); for (const o of [...clients.values()]) if (o.inst === id) { setInst(o, ''); sendTo(o, { t: 'sys', msg: 'Người ấy chưa vào được khu hẹn – thử lại nhé' }); } } }, 60000); } setInst(oc, id); log('private date', place, u.nick, oc.user.nick); }
      for (const cc of [c, oc]) sendTo(cc, { t: 'dateGo', inviter: from, place, x, z, with: cc === c ? { id: from, nick: oc.user.nick } : { id: u.id, nick: u.nick }, room: oc.room }); break; }
    case 'couple': case 'coupleOk': { const to = +m.to; const oc = byUser(to); const e = String(m.e || ''); if (!oc || !['hug', 'holdhand', 'pairdance', 'stargaze', 'toast2'].includes(e) || blockedPair(u.id, to)) return;
      const ok = Q.isMatch.get(u.id, to, to, u.id) || (Q.friends.all(to).some(r => r.b === u.id) && Q.friends.all(u.id).some(r => r.b === to));
      if (!ok) return sendTo(c, { t: 'sys', msg: 'Cử chỉ đôi chỉ dành cho người đã ghép đôi hoặc bạn bè 💞' });
      if (oc.room !== c.room || Math.hypot(oc.x - c.x, oc.z - c.z) > 6) return sendTo(c, { t: 'sys', msg: 'Hãy đứng gần nhau hơn (≤ 6m) nhé' });
      if (m.t === 'couple') { if (limited('cp:' + u.id, 6, 60000)) return; sendTo(oc, { t: 'couple', from: u.id, name: u.nick, e }); sendTo(c, { t: 'sys', msg: `Đã mời ${oc.user.nick} 💞` }); }
      else { const a = { id: oc.id, x: oc.x, z: oc.z }, b = { id: c.id, x: c.x, z: c.z }; for (const cc of [c, oc]) sendTo(cc, { t: 'coupleGo', e, lead: a, follow: b }); }
      break; }
    case 'privLeave': { if (!c.inst) return; const inst = c.inst; setInst(c, ''); for (const o of [...clients.values()]) if (o.inst === inst) { setInst(o, ''); sendTo(o, { t: 'privEnded', by: u.nick }); } break; }
    case 'ping': sendTo(c, { t: 'pong', ts: m.ts }); break;
  }
}
const num3 = (m) => { const o = {}; for (const k of ['x', 'y', 'z']) if (Number.isFinite(m[k]) && Math.abs(m[k]) < 1000) o[k] = +m[k]; return o; };

// 10 Hz state broadcast per room (only changed players), heartbeat, date verification
setInterval(() => { for (const r of ROOMS) { const list = roomOf(r); const ch = list.filter(c => c.dirty); if (!ch.length) continue;
  const s = ch.map(c => [c.id, +c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2), +c.yaw.toFixed(2), c.anim]); ch.forEach(c => c.dirty = false);
  const byI = new Map(); ch.forEach((c, i) => { if (!byI.has(c.inst)) byI.set(c.inst, []); byI.get(c.inst).push(s[i]); });
  for (const [inst, arr] of byI) { const msg = JSON.stringify({ t: 's', s: arr }); for (const c of list) if (c.inst === inst && c.ws.readyState === 1 && c.ws.bufferedAmount < 256e3) c.ws.send(msg); } } }, 100);
setInterval(() => { for (const c of clients.values()) { if (!c.alive) { c.ws.terminate(); continue; } c.alive = false; try { c.ws.ping(); } catch {} } }, 30000);
setInterval(() => { for (const [id, I] of insts) if (Date.now() - I.start > 2 * 3600e3) for (const o of [...clients.values()]) if (o.inst === id) setInst(o, ''); }, 60e3);
setInterval(() => { // a date counts when both players stay within 12 m of the date spot for 60 s
  for (const [k, d] of dates) { const A = byUser(d.a), B = byUser(d.b); if (!A || !B || Date.now() - d.start > 30 * 60e3) { dates.delete(k); continue; }
    const near = (c) => Math.hypot(c.x - d.x, c.z - d.z) < 12; if (near(A) && near(B) && A.room === B.room) d.t++; if (d.t >= 60) { dates.delete(k); const wk = weekId();
      for (const [me, other] of [[A, B], [B, A]]) { Q.addWeekDate.run(wk, me.user.id); SERVER_GRANT.set(me.user.id, (SERVER_GRANT.get(me.user.id) || 0) + 20); sendTo(me, { t: 'dateDone', with: { id: other.user.id, nick: other.user.nick }, place: d.place, xu: 20 }); } log('date done', A.user.nick, B.user.nick, d.place); } } }, 1000);

server.listen(PORT, '0.0.0.0', () => log(`Đảo Ngọc server: http://0.0.0.0:${PORT}  (ws: /ws, api: /api/*, db: ${DBFILE})`));
