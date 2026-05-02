import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// ── Lazy DB init: created on first access, not on import ────────────────────────
// This ensures DATABASE_URL can be set before the DB is actually opened.
// In test environments, vi.resetModules() + re-import gives a fresh instance.
type DBSchema = typeof schema;
let _db: BetterSQLite3Database<DBSchema> | undefined;
let _sqlite: Database.Database | undefined;
/** Exported so other modules (e.g., test setup) can read the path without triggering init */
export let DB_PATH: string;

function getDbPath(): string {
  const DB_DIR = path.join(process.cwd(), "..", "data");
  return process.env.DATABASE_URL ?? path.join(DB_DIR, "clawplay.db");
}

function ensureDb(): void {
  if (_db) return;
  DB_PATH = getDbPath();
  const DB_DIR = path.dirname(DB_PATH);
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  _sqlite = new Database(DB_PATH);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _db = drizzle(_sqlite, { schema });
}

// Lazily initialized db — first .query/.insert/... call triggers init
export const db = new Proxy({} as BetterSQLite3Database<DBSchema>, {
  get(_target, prop: string | symbol) {
    ensureDb();
    // Expose raw sqlite for arbitrary SQL (analytics aggregations)
    if (prop === "raw") {
      return (sqlStr: string, params?: unknown[]) =>
        params?.length
          ? (_sqlite as Database.Database).prepare(sqlStr).bind(...params).all()
          : (_sqlite as Database.Database).prepare(sqlStr).all();
    }
    const val = (_db as unknown as Record<string, unknown>)[prop as string];
    if (typeof val === "function") {
      return val.bind(_db);
    }
    return val;
  },
});

/**
 * Execute a raw SQL string with optional parameters.
 * Prefer using the drizzle query builder, but this is needed for
 * complex aggregations (date formatting, JSON extraction, etc.)
 * For non-SELECT statements, use exec() instead.
 */
export function raw(sqlStr: string, params?: unknown[]): unknown[] {
  ensureDb();
  const stmt = (_sqlite as Database.Database).prepare(sqlStr);
  return params?.length ? stmt.bind(...params).all() : stmt.all();
}

/**
 * Execute a raw SQL statement that doesn't return rows (INSERT, UPDATE, DELETE, ALTER, etc.).
 * Returns the sqlite run result.
 */
export function exec(sqlStr: string, params?: unknown[]): Database.RunResult {
  ensureDb();
  const stmt = (_sqlite as Database.Database).prepare(sqlStr);
  return params?.length ? stmt.bind(...params).run() : stmt.run();
}

// Run migrations lazily on first ensureDb() call
function runMigrations(sqlite: Database.Database): void {
  const migrationSQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin', 'reviewer')),
  quota_free INTEGER NOT NULL DEFAULT 100000,
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
  author_id INTEGER REFERENCES users(id),
  repo_url TEXT NOT NULL DEFAULT '',
  icon_emoji TEXT NOT NULL DEFAULT '🦐',
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK(moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT NOT NULL DEFAULT '',
  moderation_flags TEXT NOT NULL DEFAULT '[]',
  latest_version_id TEXT,
  stats_stars INTEGER NOT NULL DEFAULT 0,
  stats_ratings_count INTEGER NOT NULL DEFAULT 0,
  stats_views INTEGER NOT NULL DEFAULT 0,
  stats_downloads INTEGER NOT NULL DEFAULT 0,
  stats_installs INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS skills_by_slug ON skills(slug);
CREATE INDEX IF NOT EXISTS skills_by_status_deleted ON skills(moderation_status, deleted_at);
CREATE INDEX IF NOT EXISTS skills_pending_by_created ON skills(moderation_status, deleted_at, created_at);

CREATE TABLE IF NOT EXISTS skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  version TEXT NOT NULL,
  changelog TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  parsed_metadata TEXT NOT NULL DEFAULT '{}',
  workflow_md TEXT NOT NULL DEFAULT '',
  author_id INTEGER REFERENCES users(id),
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK(moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_flags TEXT NOT NULL DEFAULT '[]',
  deprecated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS skill_versions_by_skill_version ON skill_versions(skill_id, version);
CREATE INDEX IF NOT EXISTS skill_versions_by_skill ON skill_versions(skill_id);

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

  sqlite.exec(migrationSQL);

  // Add columns/tables if not exist — each statement runs independently so one
  // failure (e.g. duplicate column) doesn't block subsequent statements.
  const safeMigrations = [
    // skill_ratings table
    `CREATE TABLE IF NOT EXISTS skill_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS skill_ratings_user_skill ON skill_ratings(user_id, skill_id)`,
    `CREATE INDEX IF NOT EXISTS skill_ratings_by_skill ON skill_ratings(skill_id)`,

    // event_logs table — analytics event stream
    `CREATE TABLE IF NOT EXISTS event_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  target_type TEXT,
  target_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
)`,
    `CREATE INDEX IF NOT EXISTS idx_event_logs_event ON event_logs(event)`,
    `CREATE INDEX IF NOT EXISTS idx_event_logs_target ON event_logs(target_type, target_id)`,
    `CREATE INDEX IF NOT EXISTS idx_event_logs_user ON event_logs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at)`,

    // user_stats table — aggregated user metrics
    `CREATE TABLE IF NOT EXISTS user_stats (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  login_count INTEGER NOT NULL DEFAULT 0,
  last_login_at INTEGER,
  last_active_at INTEGER,
  total_quota_used INTEGER NOT NULL DEFAULT 0,
  skills_submitted INTEGER NOT NULL DEFAULT 0,
  skills_downloaded INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
)`,

    // avatar columns (added after initial schema)
    `ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '#586330'`,
    `ALTER TABLE users ADD COLUMN avatar_initials TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN avatar_url TEXT`,

    // provider_keys — new schema with provider + ability + endpoint + apiFormat + modelName
    // (Phase 2 redesign: keys are managed via admin UI, not env vars)
    `CREATE TABLE IF NOT EXISTS provider_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  ability TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL DEFAULT '',
  api_format TEXT NOT NULL DEFAULT '',
  model_name TEXT NOT NULL DEFAULT '',
  quota INTEGER NOT NULL,
  window_used INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  total_calls INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
)`,
    `CREATE INDEX IF NOT EXISTS provider_keys_by_ability ON provider_keys(ability)`,
    `CREATE INDEX IF NOT EXISTS provider_keys_by_provider ON provider_keys(provider)`,
    `CREATE INDEX IF NOT EXISTS provider_keys_enabled ON provider_keys(enabled)`,

    // provider_keys: add total_calls column (for existing tables that predate this field)
    `ALTER TABLE provider_keys ADD COLUMN total_calls INTEGER NOT NULL DEFAULT 0`,

    // Sync total_calls = window_used for pre-existing rows that had usage before the column existed
    // (window_used was incremented before total_calls was added to the schema)
    `UPDATE provider_keys SET total_calls = window_used WHERE total_calls = 0 AND window_used > 0`,

    // skill version management (new columns already in migrationSQL CREATE TABLE)
    `ALTER TABLE skills ADD COLUMN author_id INTEGER REFERENCES users(id)`,
    `ALTER TABLE skill_versions ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK(moderation_status IN ('pending', 'approved', 'rejected'))`,
    `ALTER TABLE skill_versions ADD COLUMN moderation_flags TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE skill_versions ADD COLUMN deprecated_at INTEGER`,
    `CREATE INDEX IF NOT EXISTS skill_versions_by_skill ON skill_versions(skill_id)`,

    // provider_models table — per-provider per-ability model name overrides
    `CREATE TABLE IF NOT EXISTS provider_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  ability TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS provider_models_unique ON provider_models(provider, ability)`,
  ];

  for (const sql of safeMigrations) {
    try {
      sqlite.exec(sql);
    } catch {
      // Column/table already exists — safe to ignore
    }
  }
}

// Override ensureDb to run migrations on first init
const _ensureDb2 = ensureDb;
let _migrationsRun = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(ensureDb as any) = function (): void {
  _ensureDb2();
  if (_sqlite && !_migrationsRun) {
    _migrationsRun = true;
    runMigrations(_sqlite);
  }
};
