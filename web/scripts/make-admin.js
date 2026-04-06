#!/usr/bin/env node
/**
 * Make a user an admin by email.
 * Usage: node scripts/make-admin.js <email>
 *
 * Uses the same DATABASE_URL as the Next.js dev server,
 * so running this during E2E tests promotes the right user.
 */
const path = require("path");

// Load env from .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const fs = require("fs");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx);
        const val = trimmed.slice(eqIdx + 1);
        process.env[key] = val;
      }
    }
  }
}

// DATABASE_URL in .env.local is ../data/clawplay.db (relative to web/).
// When this script runs via execSync from playwright cwd=playwright.config.ts dir (=web/),
// the relative path resolves from web/ -> ClawPlay/data/clawplay.db.
const DB_PATH = process.env.DATABASE_URL ?? path.join(__dirname, "..", "..", "data", "clawplay.db");

const Database = require("better-sqlite3");
const db = new Database(DB_PATH);

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/make-admin.js <email>");
  process.exit(1);
}

// New schema: email is in user_identities (provider='email', provider_account_id=email)
// Find user_id from user_identities, then update users.role
const identity = db.prepare(
  "SELECT user_id FROM user_identities WHERE provider = 'email' AND LOWER(provider_account_id) = LOWER(?)"
).get(email);

if (!identity) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(identity.user_id);
console.log(`✅ User ${email} (id=${identity.user_id}) is now an admin`);
