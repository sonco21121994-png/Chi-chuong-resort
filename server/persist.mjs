// Mirror the SQLite file into Postgres when DATABASE_URL is set.
// Render's free web disk is wiped on every deploy; Postgres keeps accounts.
// The game keeps using synchronous node:sqlite. This module copies Postgres → SQLite
// before the server accepts traffic, then copies SQLite → Postgres after writes.
import pg from 'pg';

const TABLES = ['users', 'sessions', 'weekly', 'week_rewards', 'likes', 'matches', 'friends', 'blocks', 'reports', 'dms', 'password_resets'];

function ident(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function scrub(err) {
  return String(err && err.message || err || 'postgres error').replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://…');
}

function sslFor(url) {
  if (/[?&]sslmode=disable(?:&|$)/i.test(url)) return false;
  if (/render\.com/i.test(url) || /[?&]sslmode=require(?:&|$)/i.test(url)) return { rejectUnauthorized: false };
  return undefined;
}

function coerce(cols, row) {
  const out = {};
  for (const c of cols) {
    let v = row[c.name];
    if (v === undefined) v = row[c.name.toLowerCase()];
    if (c.int && typeof v === 'string' && /^-?\d+$/.test(v)) v = Number(v);
    else if (typeof v === 'bigint') v = Number(v);
    out[c.name] = v === undefined ? null : v;
  }
  return out;
}

export function createPersist(sqlite, log = () => {}, opts = {}) {
  const prepare = sqlite.prepare.bind(sqlite);
  const exec = sqlite.exec.bind(sqlite);
  const url = String(opts.url ?? process.env.DATABASE_URL ?? '').trim();
  let pool = opts.pool || null;
  let readyOk = !url;
  let timer = null;
  let flushing = false;
  let again = false;

  // Integer columns come back from node-pg as strings for BIGINT. Parse them as numbers.
  if (!opts.pool) {
    pg.types.setTypeParser(20, (v) => (v == null ? null : Number(v)));
    pg.types.setTypeParser(21, (v) => (v == null ? null : Number(v)));
    pg.types.setTypeParser(23, (v) => (v == null ? null : Number(v)));
  }

  function noteWrite() {
    if (!readyOk || !pool) return;
    clearTimeout(timer);
    timer = setTimeout(() => { flushNow().catch((e) => log('postgres flush', scrub(e))); }, opts.debounceMs ?? 400);
    if (timer.unref) timer.unref();
  }

  sqlite.prepare = (sql) => {
    const stmt = prepare(sql);
    if (/^\s*(insert|update|delete|replace)/i.test(sql)) {
      const run = stmt.run.bind(stmt);
      stmt.run = (...args) => { const r = run(...args); noteWrite(); return r; };
    }
    return stmt;
  };

  async function withClient(fn) {
    const client = await pool.connect();
    try { return await fn(client); }
    finally { client.release(); }
  }

  async function ensureSchema() {
    for (const table of TABLES) {
      const info = prepare(`PRAGMA table_info(${table})`).all();
      const pks = info.filter((c) => c.pk).sort((a, b) => a.pk - b.pk);
      // opts.constraints === false is only for the in-memory driver used in tests.
      const pkSql = opts.constraints === false || !pks.length ? '' : `, PRIMARY KEY (${pks.map((c) => ident(c.name)).join(', ')})`;
      const defs = info.map((c) => `${ident(c.name)} ${/int/i.test(c.type || '') ? 'BIGINT' : 'TEXT'}`);
      await pool.query(`CREATE TABLE IF NOT EXISTS ${ident(table)} (${defs.join(', ')}${pkSql})`);
    }
  }

  async function dump(client) {
    await client.query('BEGIN');
    try {
      for (const table of TABLES) {
        const info = prepare(`PRAGMA table_info(${table})`).all();
        const cols = info.map((c) => c.name);
        const rows = prepare(`SELECT ${cols.map(ident).join(', ')} FROM ${ident(table)}`).all();
        await client.query(`DELETE FROM ${ident(table)}`);
        for (let i = 0; i < rows.length; i += 80) {
          const chunk = rows.slice(i, i + 80);
          const params = [];
          const groups = chunk.map((row) => {
            const marks = cols.map((name) => { params.push(row[name] ?? null); return `$${params.length}`; });
            return `(${marks.join(', ')})`;
          });
          await client.query(
            `INSERT INTO ${ident(table)} (${cols.map(ident).join(', ')}) VALUES ${groups.join(', ')}`,
            params,
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch { /* already aborted */ }
      throw e;
    }
  }

  async function load() {
    exec('BEGIN');
    try {
      for (const table of [...TABLES].reverse()) prepare(`DELETE FROM ${ident(table)}`).run();
      for (const table of TABLES) {
        const info = prepare(`PRAGMA table_info(${table})`).all();
        const { rows } = await pool.query(`SELECT * FROM ${ident(table)}`);
        if (!rows.length) continue;
        const cols = info.map((c) => c.name);
        const stmt = prepare(`INSERT INTO ${ident(table)} (${cols.map(ident).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
        for (const row of rows) {
          const c = coerce(info.map((col) => ({ name: col.name, int: /int/i.test(col.type || '') })), row);
          stmt.run(...cols.map((name) => c[name] ?? null));
        }
      }
      exec('COMMIT');
    } catch (e) {
      try { exec('ROLLBACK'); } catch { /* ignore */ }
      throw e;
    }
  }

  async function flushNow() {
    if (!pool || !readyOk) return;
    if (flushing) { again = true; return; }
    flushing = true;
    clearTimeout(timer);
    timer = null;
    try {
      await withClient(dump);
    } finally {
      flushing = false;
      if (again) { again = false; await flushNow(); }
    }
  }

  async function ready() {
    if (!url) { log('persist', 'sqlite-only'); return; }
    if (!pool) {
      pool = new pg.Pool({ connectionString: url, ssl: sslFor(url), max: 3, connectionTimeoutMillis: 8000 });
    }
    let last;
    for (let i = 1; i <= 8; i++) {
      try {
        await pool.query('SELECT 1');
        last = null;
        break;
      } catch (e) {
        last = e;
        log('postgres not ready', i, scrub(e));
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (last) throw new Error('Postgres không kết nối được: ' + scrub(last));
    await ensureSchema();
    const pgCount = await pool.query('SELECT COUNT(*) AS c FROM users');
    const remote = Number(pgCount.rows[0].c);
    const local = prepare('SELECT COUNT(*) AS c FROM users').get().c;
    if (remote > 0) {
      await load();
      log('persist', 'loaded', remote, 'users from postgres');
    } else if (local > 0) {
      readyOk = true;
      await flushNow();
      log('persist', 'copied', local, 'sqlite users into empty postgres');
    } else {
      log('persist', 'postgres empty');
    }
    readyOk = true;
  }

  return { ready, flushNow, noteWrite, get enabled() { return !!url; } };
}
