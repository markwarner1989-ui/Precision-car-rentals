import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'precision.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    example       TEXT,                -- "Tahoe or similar"
    description   TEXT,
    image_url     TEXT,
    daily_rate    REAL NOT NULL,       -- rental per day
    deposit       REAL NOT NULL,       -- FIXED deposit for this category
    sort_order    INTEGER DEFAULT 0,
    active        INTEGER DEFAULT 1
  );

  -- Blocks a whole category for a date range (admin marks it unavailable)
  CREATE TABLE IF NOT EXISTS category_blocks (
    id           TEXT PRIMARY KEY,
    category_id  TEXT NOT NULL,
    start_date   TEXT NOT NULL,        -- ISO yyyy-mm-dd
    end_date     TEXT NOT NULL,
    reason       TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id                 TEXT PRIMARY KEY,
    reference          TEXT UNIQUE NOT NULL,
    category_id        TEXT NOT NULL,
    category_name      TEXT NOT NULL,
    pickup_at          TEXT NOT NULL,
    return_at          TEXT NOT NULL,
    days               INTEGER NOT NULL,

    customer_name      TEXT NOT NULL,
    address            TEXT NOT NULL,
    cell_phone         TEXT NOT NULL,
    email              TEXT NOT NULL,

    coverage_type      TEXT NOT NULL,  -- 'liability' | 'full'
    insurance_daily    REAL NOT NULL,

    daily_rate         REAL NOT NULL,
    rental_subtotal    REAL NOT NULL,  -- daily_rate * days
    insurance_subtotal REAL NOT NULL,  -- insurance_daily * days
    deposit            REAL NOT NULL,  -- fixed, due now
    due_at_pickup      REAL NOT NULL,  -- rental_subtotal + insurance_subtotal

    license_file       TEXT,
    insurance_files    TEXT,           -- JSON array of filenames

    payment_status     TEXT DEFAULT 'unpaid',   -- unpaid|paid|failed
    payment_ref        TEXT,
    payment_mode       TEXT,
    status             TEXT DEFAULT 'pending',   -- pending|approved|declined
    assigned_vehicle   TEXT,
    admin_notes        TEXT,
    created_at         TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`);

export default db;
