import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databasePath = resolve(process.cwd(), process.env.DATABASE_PATH ?? "../../data/lia-workbench.db");
mkdirSync(dirname(databasePath), { recursive: true });
export const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS creators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  profile_url TEXT,
  platform TEXT NOT NULL DEFAULT '待确认',
  operator TEXT NOT NULL DEFAULT 'Lia',
  suspected_fake INTEGER NOT NULL DEFAULT 0,
  excluded_from_repurchase INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS collaborations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL REFERENCES creators(id),
  campaign TEXT NOT NULL,
  cooperation_date TEXT,
  cooperation_count INTEGER NOT NULL DEFAULT 1,
  internal_cost REAL,
  client_unit_price REAL,
  client_total_price REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  cooperation_status TEXT NOT NULL DEFAULT '待确认',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL REFERENCES creators(id),
  material_type TEXT NOT NULL CHECK(material_type IN ('script','video')),
  version TEXT,
  file_name TEXT,
  file_url TEXT,
  model_url TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  submitted_at TEXT,
  review_status TEXT NOT NULL DEFAULT '待审核',
  tracker_synced INTEGER NOT NULL DEFAULT 0,
  conflict_status TEXT NOT NULL DEFAULT '无冲突',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL REFERENCES creators(id),
  publish_date TEXT,
  platform TEXT,
  publish_url TEXT,
  normalized_publish_url TEXT UNIQUE,
  campaign TEXT,
  client_amount REAL,
  settlement_amount REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  views INTEGER,
  operator TEXT NOT NULL DEFAULT 'Lia',
  settlement_status TEXT NOT NULL DEFAULT '待确认',
  source TEXT NOT NULL DEFAULT 'manual'
);
CREATE TABLE IF NOT EXISTS source_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  document_name TEXT NOT NULL,
  sheet_name TEXT,
  original_row_number INTEGER,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_data TEXT NOT NULL,
  mapping_status TEXT NOT NULL DEFAULT '待映射',
  conflict_status TEXT NOT NULL DEFAULT '无冲突'
);
CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  conflict_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
