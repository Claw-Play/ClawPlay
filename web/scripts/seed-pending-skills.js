#!/usr/bin/env node
/**
 * Seed 20 pending skills for pagination testing.
 * Usage: node scripts/seed-pending-skills.js
 */
const path = require("path");
const fs = require("fs");

// Load env from .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) process.env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  });
}

const DB_PATH = process.env.DATABASE_URL ?? path.join(__dirname, "..", "..", "data", "clawplay.db");
const Database = require("better-sqlite3");
const db = new Database(DB_PATH);

function uid() {
  return require("crypto").randomUUID();
}

const now = Math.floor(Date.now() / 1000);

const pendingSkills = [
  { name: "Avatar Generator", summary: "Generate personalized avatars with AI", authorName: "alice_dev", authorEmail: "alice@example.com" },
  { name: "Code Review Helper", summary: "Automated code review and suggestions", authorName: "bob_sec", authorEmail: "bob@example.com" },
  { name: "Bug Hunter Pro", summary: "Find and fix bugs automatically", authorName: "carol_qa", authorEmail: "carol@example.com" },
  { name: "Content Moderator", summary: "Filter inappropriate content", authorName: "dave_ops", authorEmail: "dave@example.com" },
  { name: "Image Enhancer", summary: "Upscale and enhance images with AI", authorName: "eve_design", authorEmail: "eve@example.com" },
  { name: "SEO Optimizer", summary: "Boost search rankings automatically", authorName: "frank_seo", authorEmail: "frank@example.com" },
  { name: "Data Visualizer", summary: "Turn data into beautiful charts", authorName: "grace_data", authorEmail: "grace@example.com" },
  { name: "Text Summarizer", summary: "Summarize long articles in seconds", authorName: "henry_ai", authorEmail: "henry@example.com" },
  { name: "API Tester", summary: "Test and document REST APIs", authorName: "iris_dev", authorEmail: "iris@example.com" },
  { name: "Log Analyzer", summary: "Parse and analyze server logs", authorName: "jack_ops", authorEmail: "jack@example.com" },
  { name: "Translation Helper", summary: "Translate text between 50+ languages", authorName: "kate_i18n", authorEmail: "kate@example.com" },
  { name: "SQL Query Builder", summary: "Build complex SQL queries visually", authorName: "leo_db", authorEmail: "leo@example.com" },
  { name: "Markdown Editor", summary: "Rich markdown editor with preview", authorName: "mia_editor", authorEmail: "mia@example.com" },
  { name: "JSON Formatter", summary: "Pretty print and validate JSON", authorName: "noah_dev", authorEmail: "noah@example.com" },
  { name: "Regex Tester", summary: "Test and debug regular expressions", authorName: "olivia_dev", authorEmail: "olivia@example.com" },
  { name: "Color Palette Gen", summary: "Generate harmonious color schemes", authorName: "paul_design", authorEmail: "paul@example.com" },
  { name: "UUID Generator", summary: "Generate UUIDs v1, v4, and v7", authorName: "quinn_dev", authorEmail: "quinn@example.com" },
  { name: "Base64 Encoder", summary: "Encode and decode Base64 strings", authorName: "rose_dev", authorEmail: "rose@example.com" },
  { name: "Hash Calculator", summary: "Calculate MD5, SHA-1, SHA-256 hashes", authorName: "sam_crypto", authorEmail: "sam@example.com" },
  { name: "QR Code Maker", summary: "Generate QR codes for any text", authorName: "tina_dev", authorEmail: "tina@example.com" },
];

// Only insert columns without defaults to keep it simple
const insert = db.prepare(`
  INSERT INTO skills (id, slug, name, summary, author_name, author_email, repo_url, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.prepare("PRAGMA foreign_keys = OFF").run();
db.transaction(() => {
  // Only delete our seeded test skills (by slug prefix), leave real user submissions alone
  const seededSlugs = pendingSkills.map(s => s.name.toLowerCase().replace(/\s+/g, "-") + "-%").join("' OR slug LIKE '");
  db.prepare(`DELETE FROM skill_versions WHERE skill_id IN (SELECT id FROM skills WHERE slug LIKE '${seededSlugs}')`).run();
  db.prepare(`DELETE FROM skills WHERE slug LIKE '${seededSlugs}'`).run();
  for (let i = 0; i < pendingSkills.length; i++) {
    const s = pendingSkills[i];
    const id = uid();
    const slug = `${s.name.toLowerCase().replace(/\s+/g, "-")}-${id.slice(0, 8)}`;
    const createdAt = now - i * 1800;
    insert.run(id, slug, s.name, s.summary, s.authorName, s.authorEmail,
      `https://github.com/example/${slug}`, createdAt, createdAt);
    process.stdout.write(".");
  }
})();

console.log(`\nDone! Inserted ${pendingSkills.length} pending skills.`);
