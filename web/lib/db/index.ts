import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Database file path — stored in project root, git-ignored
const DB_DIR = path.join(process.cwd(), "..", "data");
const DB_PATH = process.env.DATABASE_URL ?? path.join(DB_DIR, "clawplay.db");

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Run migrations (create tables if not exist)
const migrationSQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  quota_free INTEGER NOT NULL DEFAULT 1000,
  quota_used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL CHECK(provider IN ('email', 'phone', 'wechat', 'github', 'google')),
  provider_account_id TEXT NOT NULL,
  credential TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_account ON user_identities(provider, provider_account_id);
CREATE INDEX IF NOT EXISTS user_identities_by_user ON user_identities(user_id);

CREATE TABLE IF NOT EXISTS sms_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  author_email TEXT NOT NULL DEFAULT '',
  repo_url TEXT NOT NULL DEFAULT '',
  icon_emoji TEXT NOT NULL DEFAULT '🦐',
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK(moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT NOT NULL DEFAULT '',
  moderation_flags TEXT NOT NULL DEFAULT '[]',
  latest_version_id TEXT,
  stats_stars INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS skills_by_slug ON skills(slug);
CREATE INDEX IF NOT EXISTS skills_by_status_deleted ON skills(moderation_status, deleted_at);

CREATE TABLE IF NOT EXISTS skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  version TEXT NOT NULL,
  changelog TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  parsed_metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS skill_versions_by_skill_version ON skill_versions(skill_id, version);

CREATE TABLE IF NOT EXISTS user_tokens (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS user_tokens_by_user ON user_tokens(user_id);
`;

// Run migrations on import
sqlite.exec(migrationSQL);

// Add columns/tables if not exist (safe to re-run)
const safeMigrations = `
-- skills table: add new columns (no-op if already exist)
ALTER TABLE skills ADD COLUMN stats_ratings_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;

-- skill_ratings table
CREATE TABLE IF NOT EXISTS skill_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS skill_ratings_user_skill ON skill_ratings(user_id, skill_id);
CREATE INDEX IF NOT EXISTS skill_ratings_by_skill ON skill_ratings(skill_id);
`;
try {
  sqlite.exec(safeMigrations);
} catch {
  // Columns may already exist — ignore
}

export { DB_PATH };
