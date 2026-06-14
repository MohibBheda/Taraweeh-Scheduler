const { Database: WasmDatabase } = require('node-sqlite3-wasm');
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../../../data/resale.db');

let _db;

/**
 * Returns a database handle that mirrors the better-sqlite3 API:
 *   db.exec(sql)
 *   db.prepare(sql).run(params)   — statement is auto-finalized after each call
 *   db.prepare(sql).get(params)
 *   db.prepare(sql).all(params)
 *
 * node-sqlite3-wasm requires manual finalization; this wrapper handles it.
 */
function getDb() {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const raw = new WasmDatabase(DB_PATH);
    raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    _db = wrap(raw);
  }
  return _db;
}

/**
 * node-sqlite3-wasm requires named-param keys to carry their SQLite prefix
 * (@name, :name, $name). better-sqlite3 strips the prefix. This normalizer
 * adds '@' to bare keys so callers can write {name: val} throughout.
 */
function normalizeParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return params;
  const keys = Object.keys(params);
  if (!keys.length) return params;
  // Already prefixed — leave alone
  if ('@:$'.includes(keys[0][0])) return params;
  return Object.fromEntries(keys.map(k => [`@${k}`, params[k]]));
}

function wrap(raw) {
  const p = normalizeParams;
  return {
    exec:    (sql)           => raw.exec(sql),
    run:     (sql, params)   => raw.run(sql, p(params)),
    get:     (sql, params)   => raw.get(sql, p(params)),
    all:     (sql, params)   => raw.all(sql, p(params)),
    prepare: (sql) => ({
      run: (params) => { const s = raw.prepare(sql); try { return s.run(p(params));  } finally { s.finalize(); } },
      get: (params) => { const s = raw.prepare(sql); try { return s.get(p(params));  } finally { s.finalize(); } },
      all: (params) => { const s = raw.prepare(sql); try { return s.all(p(params));  } finally { s.finalize(); } }
    })
  };
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      title                  TEXT    NOT NULL,
      source_url             TEXT,
      purchase_price         REAL    NOT NULL,
      estimated_resale_price REAL,
      fees_estimate          REAL,
      shipping_estimate      REAL,
      net_profit             REAL,
      roi_percentage         REAL,
      risk_score             REAL,
      status                 TEXT    NOT NULL DEFAULT 'candidate'
                               CHECK(status IN ('candidate','bought','listed','sold','rejected')),
      category               TEXT,
      weight_class           TEXT    DEFAULT 'medium'
                               CHECK(weight_class IN ('light','medium','heavy','freight')),
      condition              TEXT    DEFAULT 'used',
      notes                  TEXT,
      data_source            TEXT    DEFAULT 'manual',
      confidence_score       REAL,
      created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS market_data (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      item_query       TEXT    NOT NULL,
      avg_sold_price   REAL    NOT NULL,
      sold_range_low   REAL    NOT NULL,
      sold_range_high  REAL    NOT NULL,
      sample_size      INTEGER NOT NULL DEFAULT 0,
      data_source      TEXT    NOT NULL DEFAULT 'manual',
      confidence       TEXT    NOT NULL DEFAULT 'low'
                         CHECK(confidence IN ('low','medium','high')),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(item_query)
    )
  `);

  runMigrations(db);

  console.log(`[db] Initialized: ${DB_PATH}`);
}

function runMigrations(db) {
  const cols = [
    'ALTER TABLE items ADD COLUMN liquidity_score REAL',
    'ALTER TABLE items ADD COLUMN competition_score REAL',
    'ALTER TABLE items ADD COLUMN deal_score REAL',
    'ALTER TABLE items ADD COLUMN ebay_sold_avg REAL',
    'ALTER TABLE items ADD COLUMN ebay_active_count INTEGER DEFAULT 0',
    'ALTER TABLE items ADD COLUMN ebay_sold_count INTEGER DEFAULT 0',
  ];
  for (const sql of cols) { try { db.exec(sql); } catch {} }
}

module.exports = { getDb, initDatabase };
