#!/usr/bin/env node
/**
 * Clean up test data from the shared dev database.
 * Deletes all skills and users created during E2E test runs.
 * This prevents stale data from accumulating across test runs.
 */
const path = require("path");
const Database = require("better-sqlite3");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const fs = require("fs");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
      }
    }
  }
}

// Resolve relative DATABASE_URL relative to web/ directory (cwd when playwright runs)
const DB_PATH = process.env.DATABASE_URL
  ?? path.join(__dirname, "..", "..", "data", "clawplay.db");

const db = new Database(DB_PATH);

// Clear test skills and users (those with example.com emails from E2E runs)
const result = db.transaction(() => {
  // Delete test users (and cascade delete their tokens)
  const usersDeleted = db.prepare(
    "DELETE FROM users WHERE email LIKE '%@example.com'"
  ).run();

  // Delete test skills (and cascade delete their versions)
  const skillsDeleted = db.prepare(
    "DELETE FROM skills WHERE authorEmail LIKE '%@example.com'"
  ).run();

  return { users: usersDeleted.changes, skills: skillsDeleted.changes };
})();

console.log(`✅ Cleaned up ${result.users} users and ${result.skills} skills`);
