// Round-trip accounts through the Postgres mirror (pg-mem stands in for Render Postgres).
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { newDb } from 'pg-mem';
import { createPersist } from './persist.mjs';

const src = fs.readFileSync(new URL('./server.js', import.meta.url), 'utf8');
const schema = src.match(/db\.exec\(`([\s\S]*?)`\);/)[1];
if (!schema || !schema.includes('CREATE TABLE IF NOT EXISTS users')) throw new Error('could not read sqlite schema');

function fresh() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  return db;
}

const mem = newDb();
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
const opts = { url: 'postgres://local/chi_chuong_test', pool, debounceMs: 60_000, constraints: false };
const log = () => {};

const a = fresh();
const p1 = createPersist(a, log, opts);
await p1.ready();
a.prepare('INSERT INTO users(nick,nick_key,pass,email,adult,rules,created,last_seen,data,xp) VALUES(?,?,?,?,?,?,?,?,?,?)')
  .run('SonCo5G', 'sonco5g', 'scrypt$x', 'son@example.com', 1, 1, 10, 11, '{"xu":880}', 40);
a.prepare('INSERT INTO sessions(token,user_id,created,expires,ua) VALUES(?,?,?,?,?)').run('tok', 1, 10, 99, 'test');
a.prepare('INSERT INTO weekly(week,user_id,xp,dance,events,dates) VALUES(?,?,?,?,?,?)').run('2026-11-02', 1, 40, 2, 1, 0);
a.prepare('INSERT INTO password_resets(token_hash,user_id,expires,used) VALUES(?,?,?,?)').run('abc', 1, 50, 0);
await p1.flushNow();

const b = fresh();
const p2 = createPersist(b, log, opts);
await p2.ready();
const u = b.prepare('SELECT * FROM users WHERE nick_key=?').get('sonco5g');
if (!u || u.nick !== 'SonCo5G' || Number(u.id) !== 1) throw new Error('user missing after hydrate: ' + JSON.stringify(u));
if (JSON.parse(u.data).xu !== 880 || u.email !== 'son@example.com' || u.xp !== 40) throw new Error('user columns changed: ' + JSON.stringify(u));
const s = b.prepare('SELECT * FROM sessions WHERE token=?').get('tok');
if (!s || Number(s.user_id) !== 1 || Number(s.expires) !== 99) throw new Error('session missing: ' + JSON.stringify(s));
const w = b.prepare('SELECT * FROM weekly WHERE week=? AND user_id=?').get('2026-11-02', 1);
if (!w || w.xp !== 40 || w.dance !== 2) throw new Error('weekly missing: ' + JSON.stringify(w));
const r = b.prepare('SELECT * FROM password_resets WHERE token_hash=?').get('abc');
if (!r || Number(r.used) !== 0) throw new Error('reset missing: ' + JSON.stringify(r));

b.prepare('DELETE FROM users').run();
b.prepare('DELETE FROM sessions').run();
await p2.flushNow();
const c = fresh();
await createPersist(c, log, opts).ready();
const n = c.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (n !== 0) throw new Error('delete did not reach postgres, count=' + n);
console.log('persist round-trip ok');
