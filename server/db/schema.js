/**
 * Foodeez — database schema.
 *
 * Node 24 ships `node:sqlite`, so there is no native module to compile and no
 * binary to match against the host. The exact same file runs on Windows dev,
 * on Vercel's serverless runtime, and on a VPS after handover.
 *
 * All money values are integers in whole rupees (PKR). No floats touch money.
 */

import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

export const ORDER_STATUSES = ['new', 'preparing', 'ready', 'out', 'delivered', 'cancelled']

export function openDB(file) {
  let db
  try {
    db = new DatabaseSync(file)
  } catch (err) {
    console.error('[db] Error opening database file:', file, err.message)
    // If the file is corrupt and not in-memory, backup and open clean database
    if (file !== ':memory:' && typeof file === 'string') {
      try {
        const backup = file + '.corrupt.' + Date.now()
        fs.renameSync(file, backup)
        console.warn(`[db] Backed up corrupted database to ${backup} and initialized a fresh database`)
        db = new DatabaseSync(file)
      } catch {
        db = new DatabaseSync(':memory:')
      }
    } else {
      db = new DatabaseSync(':memory:')
    }
  }

  const isMemoryOrTmp = file === ':memory:' || (typeof file === 'string' && (file.startsWith('/tmp') || file.includes('foodeez-tmp')))
  if (isMemoryOrTmp) {
    db.exec('PRAGMA journal_mode = MEMORY')
    db.exec('PRAGMA synchronous = OFF')
    db.exec('PRAGMA temp_store = MEMORY')
  } else {
    try {
      db.exec('PRAGMA journal_mode = WAL')
      db.exec('PRAGMA synchronous = NORMAL')
      db.exec('PRAGMA temp_store = MEMORY')
      db.exec('PRAGMA mmap_size = 268435456') // 256MB memory-mapped IO
    } catch {
      db.exec('PRAGMA journal_mode = DELETE')
    }
  }
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 10000')
  db.exec('PRAGMA cache_size = -64000') // 64MB memory cache for maximum query speed
  migrate(db)
  return db
}

function migrate(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    ur    TEXT NOT NULL DEFAULT '',
    sort  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id         TEXT PRIMARY KEY,
    cat        TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    descr      TEXT NOT NULL DEFAULT '',
    price      INTEGER NOT NULL CHECK (price >= 0),
    was        INTEGER,
    img        TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL DEFAULT '[]',
    serves     INTEGER,
    available  INTEGER NOT NULL DEFAULT 1,
    featured   INTEGER NOT NULL DEFAULT 0,
    spice      INTEGER NOT NULL DEFAULT 0,
    veg        INTEGER NOT NULL DEFAULT 0,
    prep_mins  INTEGER NOT NULL DEFAULT 15,
    sort       INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS option_groups (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id  TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    label    TEXT NOT NULL,
    required INTEGER NOT NULL DEFAULT 0,
    multi    INTEGER NOT NULL DEFAULT 0,
    sort     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS option_choices (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    label    TEXT NOT NULL,
    delta    INTEGER NOT NULL DEFAULT 0,
    sort     INTEGER NOT NULL DEFAULT 0
  );

  /*
   * One dish can carry several photos. menu_items.img stays as the cover
   * image so every existing read path keeps working, and this table holds the
   * rest of the gallery in display order (sort 0 is the cover).
   */
  CREATE TABLE IF NOT EXISTS menu_item_images (
    id         TEXT PRIMARY KEY,
    item_id    TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    path       TEXT NOT NULL,
    sort       INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS promos (
    id         TEXT PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,
    type       TEXT NOT NULL CHECK (type IN ('pct','flat')),
    value      INTEGER NOT NULL CHECK (value >= 0),
    min        INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1,
    uses       INTEGER NOT NULL DEFAULT 0,
    cap        INTEGER,
    starts_at  INTEGER,
    ends_at    INTEGER,
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS customers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL UNIQUE,
    email      TEXT,
    address    TEXT NOT NULL DEFAULT '',
    note       TEXT NOT NULL DEFAULT '',
    pass_hash  TEXT,
    points     INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    pass_hash  TEXT NOT NULL,
    role       TEXT NOT NULL CHECK (role IN ('owner','counter','kitchen','rider')),
    active     INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS riders (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    phone    TEXT NOT NULL DEFAULT '',
    bike     TEXT NOT NULL DEFAULT '',
    active   INTEGER NOT NULL DEFAULT 1,
    on_shift INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL,
    guests     INTEGER NOT NULL CHECK (guests > 0),
    at_day     TEXT NOT NULL,
    at_time    TEXT NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','confirmed','seated','cancelled','no_show')),
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           TEXT PRIMARY KEY,
    customer_id  TEXT REFERENCES customers(id) ON DELETE SET NULL,
    rider_id     TEXT REFERENCES riders(id)   ON DELETE SET NULL,
    type         TEXT NOT NULL CHECK (type IN ('delivery','pickup')),
    status       TEXT NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new','preparing','ready','out','delivered','cancelled')),
    subtotal     INTEGER NOT NULL CHECK (subtotal >= 0),
    delivery_fee INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    discount     INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
    total        INTEGER NOT NULL CHECK (total >= 0),
    promo_code   TEXT,
    pay_method   TEXT NOT NULL DEFAULT 'cod'
                 CHECK (pay_method IN ('cod','jazzcash','easypaisa','card')),
    pay_status   TEXT NOT NULL DEFAULT 'unpaid'
                 CHECK (pay_status IN ('unpaid','paid','refunded')),
    note         TEXT NOT NULL DEFAULT '',
    cancel_reason TEXT,
    rating       INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    channel      TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web','phone','walkin')),
    created_at   INTEGER NOT NULL DEFAULT 0
  );

  /* Snapshot of who ordered. An order must stay readable even if the
     customer row is later removed or their details change. */
  CREATE TABLE IF NOT EXISTS order_customers (
    order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    name     TEXT NOT NULL,
    phone    TEXT NOT NULL,
    address  TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id  TEXT,
    name     TEXT NOT NULL,
    img      TEXT NOT NULL DEFAULT '',
    price    INTEGER NOT NULL CHECK (price >= 0),
    qty      INTEGER NOT NULL CHECK (qty > 0),
    opts     TEXT NOT NULL DEFAULT '',
    note     TEXT NOT NULL DEFAULT ''
  );

  /* Append-only status log. Powers the customer tracking timeline. */
  CREATE TABLE IF NOT EXISTS order_events (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status   TEXT NOT NULL,
    at       INTEGER NOT NULL DEFAULT 0,
    actor    TEXT
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id          TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    order_id    TEXT,
    name        TEXT NOT NULL,
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body        TEXT NOT NULL DEFAULT '',
    approved    INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS counters (
    k TEXT PRIMARY KEY,
    v INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_items_cat     ON menu_items(cat, sort);
  CREATE INDEX IF NOT EXISTS idx_items_feat    ON menu_items(featured, available);
  CREATE INDEX IF NOT EXISTS idx_item_images   ON menu_item_images(item_id, sort);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_rider    ON orders(rider_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_orders_phone  ON order_customers(phone);
  CREATE INDEX IF NOT EXISTS idx_events_order  ON order_events(order_id, at);
  CREATE INDEX IF NOT EXISTS idx_opt_groups_item ON option_groups(item_id, sort);
  CREATE INDEX IF NOT EXISTS idx_opt_choices_group ON option_choices(group_id, sort);
  CREATE INDEX IF NOT EXISTS idx_res_when      ON reservations(at_day, at_time);
  CREATE INDEX IF NOT EXISTS idx_reviews_ok    ON reviews(approved, created_at DESC);
  `)

  backfillItemImages(db)
}

/**
 * Give every existing dish a gallery row for its cover image. Runs on every
 * boot but only touches items that have an image and no gallery rows at all,
 * so a photo the admin deleted never comes back.
 */
export function backfillItemImages(db) {
  const orphans = db.prepare(`
    SELECT id, img FROM menu_items
    WHERE img <> '' AND id NOT IN (SELECT item_id FROM menu_item_images)
  `).all()
  if (!orphans.length) return
  const ins = db.prepare('INSERT INTO menu_item_images(id,item_id,path,sort,created_at) VALUES(?,?,?,0,?)')
  for (const row of orphans) ins.run(randomUUID(), row.id, row.img, Date.now())
}

/* ---------- small helpers shared by routes and tests ---------- */

export const now = () => Date.now()

export function nextOrderId(db) {
  const row = db.prepare("SELECT v FROM counters WHERE k = 'order'").get()
  const next = (row?.v ?? 1040) + 1
  db.prepare("INSERT INTO counters(k,v) VALUES('order',?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(next)
  return `FZ-${next}`
}

export function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT v FROM settings WHERE k = ?').get(key)
  if (!row) return fallback
  try { return JSON.parse(row.v) } catch { return row.v }
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    .run(key, JSON.stringify(value))
}
