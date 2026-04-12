/**
 * Seed script: injects realistic analytics test data into the DB.
 * Run with: node scripts/seed-analytics.js
 *
 * Uses existing users from the DB, inserts test skills + ~500 event_logs.
 */
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = process.env.DATABASE_URL ?? path.join(__dirname, "..", "data", "clawplay.db");
console.log("Using DB:", DB_PATH);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// ── Helpers ───────────────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const EVENT_WEIGHTS = [
  ["skill.view", 0.3],
  ["skill.download", 0.08],
  ["quota.use", 0.4],
  ["quota.check", 0.1],
  ["user.login", 0.06],
  ["skill.review", 0.04],
  ["quota.error", 0.02],
];

function weightedPick() {
  const r = Math.random();
  let cum = 0;
  for (const [event, weight] of EVENT_WEIGHTS) {
    cum += weight;
    if (r < cum) return event;
  }
  return EVENT_WEIGHTS[0][0];
}

function daysAgo(n) {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

function tsForDay(day, hour, min = 0) {
  return daysAgo(day) + hour * 3600 * 1000 + min * 60 * 1000;
}

// ── Get existing users ──────────────────────────────────────────────────────

const existingUsers = db.prepare("SELECT id FROM users").all();
if (existingUsers.length === 0) {
  console.error("❌ No users found. Please register a user first.");
  process.exit(1);
}
const userIds = existingUsers.map((u) => u.id);
console.log(`📦 Found ${userIds.length} existing users (ids: ${userIds.slice(0, 5).join(", ")}...)`);

// ── Skills ──────────────────────────────────────────────────────────────────

const SKILL_SLUGS = ["avatar-gen", "translate-zh", "code-review", "image-upscale", "voice-clone", "diy-crafts"];
const SKILL_NAMES = ["Avatar Gen", "Translate ZH", "Code Review", "Image Upscale", "Voice Clone", "DIY Crafts"];

console.log("📦 Seeding skills...");
// Clean up old seed skills (FK: skill_versions.skill_id → skills.id, must delete versions first)
const oldSkillIds = db.prepare(`SELECT id FROM skills WHERE slug IN (${SKILL_SLUGS.map(() => "?").join(",")})`).all(...SKILL_SLUGS).map(r => r.id);
if (oldSkillIds.length > 0) {
  db.prepare(`DELETE FROM skill_versions WHERE skill_id IN (${oldSkillIds.map(() => "?").join(",")})`).run(...oldSkillIds);
  db.prepare(`DELETE FROM skills WHERE slug IN (${SKILL_SLUGS.map(() => "?").join(",")})`).run(...SKILL_SLUGS);
}

const insertSkill = db.prepare(`
  INSERT OR REPLACE INTO skills (id, slug, name, summary, author_name, author_email, repo_url, icon_emoji, moderation_status, moderation_reason, moderation_flags, latest_version_id, stats_stars, deleted_at, created_at, updated_at, stats_ratings_count, is_featured)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, unixepoch(), 0, ?)
`);
const insertVersion = db.prepare(`
  INSERT OR REPLACE INTO skill_versions (id, skill_id, version, changelog, content, parsed_metadata, created_at)
  VALUES (?, ?, '1.0.0', '', '# SKILL', '{}', ?)
`);
const insertAdminEvent = db.prepare(`
  INSERT INTO event_logs (event, user_id, target_type, target_id, metadata, ip_address, user_agent, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const adminId = userIds[0]; // First user (usually admin)
const createdAt = daysAgo(randInt(5, 45));

for (let i = 0; i < SKILL_SLUGS.length; i++) {
  const slug = SKILL_SLUGS[i];
  const id = crypto.randomBytes(8).toString("hex");
  const isFeatured = i < 2 ? 1 : 0;
  const status = i < 4 ? "approved" : "pending";
  insertSkill.run(id, slug, SKILL_NAMES[i], `A useful skill for ${SKILL_NAMES[i].toLowerCase()}`,
    `Author ${i}`, `author${i}@example.com`, '', Math.random() > 0.5 ? 1 : 0, status, '', '[]', id, 0,
    Math.floor(createdAt / 1000), isFeatured);
  insertVersion.run(id, id, Math.floor(createdAt / 1000));
}

// Admin action events
const adminActions = [
  { event: "skill.approve", skill: SKILL_SLUGS[0] },
  { event: "skill.approve", skill: SKILL_SLUGS[1] },
  { event: "skill.feature", skill: SKILL_SLUGS[0] },
  { event: "skill.approve", skill: SKILL_SLUGS[2] },
  { event: "skill.approve", skill: SKILL_SLUGS[3] },
];
for (const a of adminActions) {
  insertAdminEvent.run(a.event, adminId, "skill", a.skill,
    JSON.stringify({ reason: "Auto-seeded" }), "127.0.0.1", "Seed/1.0", daysAgo(randInt(1, 20)));
}

// ── event_logs ────────────────────────────────────────────────────────────────

const ABILITIES = ["llm.generate", "image.generate", "vision.analyze", "tts.synthesize"];
const PROVIDERS = ["ark", "gemini"];
const UAs = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Claude/4.6 (CLI)",
  "clawplay/1.0",
];

console.log("📦 Seeding event_logs (~500 entries over 30 days)...");
const insertEvent = db.prepare(`
  INSERT INTO event_logs (event, user_id, target_type, target_id, metadata, ip_address, user_agent, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

for (let day = 0; day < 30; day++) {
  const isWeekday = [1, 2, 3, 4, 5].includes(new Date(daysAgo(day)).getDay());
  const baseEventsPerDay = isWeekday ? randInt(15, 35) : randInt(5, 15);

  for (let i = 0; i < baseEventsPerDay; i++) {
    const hour = randInt(6, 23);
    const min = randInt(0, 59);
    const ts = tsForDay(day, hour, min);
    const userId = pick(userIds);
    const event = weightedPick();
    const skill = pick(SKILL_SLUGS);
    const ability = pick(ABILITIES);
    const provider = pick(PROVIDERS);

    let targetType = "";
    let targetId = "";
    let metadata = {};

    switch (event) {
      case "skill.view":
        targetType = "skill"; targetId = skill; break;
      case "skill.download":
        targetType = "skill"; targetId = skill;
        metadata = { version: "1.0.0" }; break;
      case "skill.review":
        targetType = "skill"; targetId = skill;
        metadata = { rating: randInt(3, 5) }; break;
      case "quota.use":
        targetType = "quota"; targetId = String(userId);
        const cost = randInt(5, 20);
        const tokens = ability === "llm.generate"
          ? { inputTokens: randInt(100, 2000), outputTokens: randInt(50, 800) }
          : {};
        metadata = { ability, cost, provider, ...tokens }; break;
      case "quota.check":
        targetType = "quota"; targetId = String(userId);
        metadata = { ability }; break;
      case "quota.error":
        targetType = "quota"; targetId = String(userId);
        metadata = { ability, provider, code: pick(["429", "500", "503"]) }; break;
      case "user.login":
        targetType = "user"; targetId = String(userId);
        metadata = { method: "email" }; break;
    }

    insertEvent.run(
      event, userId,
      targetType || null, targetId || null,
      JSON.stringify(metadata),
      `192.168.${randInt(1, 255)}.${randInt(1, 255)}`,
      pick(UAs), ts
    );
  }
}

// ── user_stats ───────────────────────────────────────────────────────────────

console.log("📊 Seeding user_stats...");
const insertStats = db.prepare(`INSERT OR IGNORE INTO user_stats (user_id, login_count, last_login_at, last_active_at, total_quota_used, skills_submitted, skills_downloaded, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
for (const uid of userIds) {
  insertStats.run(
    uid, randInt(5, 50),
    tsForDay(randInt(0, 3), randInt(8, 20)),
    tsForDay(randInt(0, 5), randInt(6, 23)),
    randInt(100, 2000),
    Math.random() > 0.8 ? randInt(1, 3) : 0,
    randInt(0, 10), Date.now()
  );
}

// ── Verify ──────────────────────────────────────────────────────────────────

const totals = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM event_logs) as total_events,
    (SELECT COUNT(DISTINCT user_id) FROM event_logs WHERE user_id IS NOT NULL) as active_users,
    (SELECT COALESCE(SUM(CAST(json_extract(metadata, '$.cost') AS INTEGER)), 0) FROM event_logs WHERE event='quota.use') as total_quota,
    (SELECT COUNT(*) FROM skills WHERE moderation_status='approved') as total_skills
`).get();

console.log("\n✅ Seed complete!");
console.log(`   Events:       ${totals.total_events}`);
console.log(`   Active users: ${totals.active_users}`);
console.log(`   Total quota:  ${totals.total_quota}`);
console.log(`   Skills:       ${totals.total_skills}`);
console.log(`\n🔑 Admin: user id=${adminId} (first user in DB)`);
console.log(`🔗 Open http://localhost:3000/admin to see the dashboard.`);

db.close();
