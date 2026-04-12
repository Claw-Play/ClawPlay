/**
 * Seed script: injects realistic analytics test data into the DB.
 * Run with: npx tsx scripts/seed-analytics.ts
 *
 * SAFETY: only deletes seed data by known slug/name/email.
 * Real production users, their events, and their stats are never touched.
 */
import Database from "better-sqlite3";
import path from "path";
import { randomBytes } from "crypto";

const DB_PATH = process.env.DATABASE_URL ?? path.join(process.cwd(), "..", "data", "clawplay.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");

// ── Helpers ──────────────────────────────────────────────────────────────────

const ABILITIES = ["llm.generate", "image.generate", "vision.analyze", "tts.synthesize"];
const PROVIDERS = ["ark", "gemini"];
const SKILL_SLUGS = ["avatar-gen", "translate-zh", "code-review", "image-upscale", "voice-clone", "diy-crafts"];
const EVENT_WEIGHTS: [string, number][] = [
  ["skill.view", 0.3],
  ["skill.download", 0.08],
  ["quota.use", 0.4],
  ["quota.check", 0.1],
  ["user.login", 0.06],
  ["skill.review", 0.04],
  ["quota.error", 0.02],
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(pairs: [string, number][]): string {
  const r = Math.random();
  let cum = 0;
  for (const [event, weight] of pairs) {
    cum += weight;
    if (r < cum) return event;
  }
  return pairs[0][0];
}

function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

function tsForDay(dayOffset: number, hour: number, min = 0): number {
  return daysAgo(dayOffset) + hour * 3600 * 1000 + min * 60 * 1000;
}

// ── Seed data ────────────────────────────────────────────────────────────────

const USERS = [
  { name: "Admin Alice", email: "alice@example.com", role: "admin" },
  { name: "Admin Bob", email: "bob@example.com", role: "admin" },
  { name: "Reviewer Carol", email: "carol@example.com", role: "admin" },
  { name: "David Chen", email: "david@example.com", role: "user" },
  { name: "Emma Wang", email: "emma@example.com", role: "user" },
  { name: "Frank Liu", email: "frank@example.com", role: "user" },
  { name: "Grace Zhou", email: "grace@example.com", role: "user" },
  { name: "Henry Sun", email: "henry@example.com", role: "user" },
];

// ── Prepared statements ──────────────────────────────────────────────────────

const insertUser = db.prepare(`
  INSERT INTO users (name, role, quota_free, created_at)
  VALUES (?, ?, ?, ?)
`);
const insertUserIdentity = db.prepare(`
  INSERT INTO user_identities (user_id, provider, provider_account_id, credential)
  VALUES (?, 'email', ?, NULL)
`);
const insertSkill = db.prepare(`
  INSERT INTO skills (id, slug, name, summary, author_name, author_email, repo_url, icon_emoji, moderation_status, moderation_reason, moderation_flags, latest_version_id, stats_stars, stats_ratings_count, is_featured, created_at)
  VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, '', '[]', ?, 0, 0, ?, ?)
`);
const insertSkillVersion = db.prepare(`
  INSERT INTO skill_versions (id, skill_id, version, changelog, content, parsed_metadata, created_at)
  VALUES (?, ?, '1.0.0', '', '# SKILL', '{}', ?)
`);
const insertEventLog = db.prepare(`
  INSERT INTO event_logs (event, user_id, target_type, target_id, metadata, ip_address, user_agent, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertUserStats = db.prepare(`
  INSERT OR IGNORE INTO user_stats (user_id, login_count, last_login_at, last_active_at, skills_submitted, skills_downloaded, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ── Cleanup: only delete seed data ──────────────────────────────────────────

const deleteAnalytics = db.transaction(() => {
  // Only delete events/stats for seed users — real user data is preserved
  db.exec(`DELETE FROM event_logs WHERE user_id IN (SELECT id FROM users WHERE name IN ('Admin Alice','Admin Bob','Reviewer Carol','David Chen','Emma Wang','Frank Liu','Grace Zhou','Henry Sun'))`);
  db.exec(`DELETE FROM user_stats WHERE user_id IN (SELECT id FROM users WHERE name IN ('Admin Alice','Admin Bob','Reviewer Carol','David Chen','Emma Wang','Frank Liu','Grace Zhou','Henry Sun'))`);
  // Delete seed skill_versions and skills by slug
  db.exec(`DELETE FROM skill_versions WHERE skill_id IN (SELECT id FROM skills WHERE slug IN ('avatar-gen','translate-zh','code-review','image-upscale','voice-clone','diy-crafts'))`);
  db.exec(`DELETE FROM skills WHERE slug IN ('avatar-gen','translate-zh','code-review','image-upscale','voice-clone','diy-crafts')`);
  // Delete seed identities by email
  db.exec(`DELETE FROM user_identities WHERE provider_account_id IN ('alice@example.com','bob@example.com','carol@example.com','david@example.com','emma@example.com','frank@example.com','grace@example.com','henry@example.com')`);
  // Delete seed users by name
  db.exec(`DELETE FROM users WHERE name IN ('Admin Alice','Admin Bob','Reviewer Carol','David Chen','Emma Wang','Frank Liu','Grace Zhou','Henry Sun')`);
});

// ── Main ─────────────────────────────────────────────────────────────────────

console.log("🔄 Clearing existing seed data...");
deleteAnalytics();
db.pragma("foreign_keys = ON");

console.log("📦 Seeding users...");
const userIds: number[] = [];
for (const u of USERS) {
  const now = daysAgo(randInt(10, 60));
  const result = insertUser.run(u.name, u.role, 1000, Math.floor(now / 1000));
  const uid = result.lastInsertRowid as number;
  userIds.push(uid);
  insertUserIdentity.run(uid, u.email);
}

console.log("📦 Seeding skills...");
for (const slug of SKILL_SLUGS) {
  const id = randomBytes(8).toString("hex");
  const authorIdx = randInt(2, USERS.length - 1);
  const isFeatured = Math.random() > 0.7 ? 1 : 0;
  const createdAt = daysAgo(randInt(5, 45));
  insertSkill.run(
    id, slug,
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    `A useful skill for ${slug.replace(/-/g, " ")}`,
    USERS[authorIdx].name, USERS[authorIdx].email,
    Math.random() > 0.5 ? 1 : 0,
    Math.random() > 0.5 ? "approved" : "pending",
    id,
    isFeatured,
    Math.floor(createdAt / 1000)
  );
  insertSkillVersion.run(id, id, Math.floor(createdAt / 1000));
}

console.log("📦 Seeding event_logs (~500 entries over 30 days)...");

for (let day = 0; day < 30; day++) {
  const isWeekday = [1, 2, 3, 4, 5].includes(new Date(daysAgo(day)).getDay());
  const baseEventsPerDay = isWeekday ? randInt(15, 35) : randInt(5, 15);

  for (let i = 0; i < baseEventsPerDay; i++) {
    const hour = randInt(6, 23);
    const min = randInt(0, 59);
    const ts = tsForDay(day, hour, min);
    const userId = pick(userIds);
    const event = weightedPick(EVENT_WEIGHTS);
    const skill = pick(SKILL_SLUGS);
    const ability = pick(ABILITIES);
    const provider = pick(PROVIDERS);

    let targetType = "";
    let targetId = "";
    let metadata: Record<string, unknown> = {};

    switch (event) {
      case "skill.view":
        targetType = "skill"; targetId = skill;
        metadata = {};
        break;
      case "skill.download":
        targetType = "skill"; targetId = skill;
        metadata = { version: "1.0.0" };
        break;
      case "skill.review":
        targetType = "skill"; targetId = skill;
        metadata = { rating: randInt(3, 5) };
        break;
      case "quota.use":
        targetType = "ability"; targetId = ability;
        metadata = {
          ability,
          provider,
          inputTokens: randInt(100, 2000),
          outputTokens: randInt(50, 800),
          totalTokens: randInt(200, 3000),
        };
        break;
      case "quota.check":
        targetType = "quota"; targetId = String(userId);
        metadata = { current: randInt(100, 900), limit: 100000 };
        break;
      case "quota.error":
        targetType = "ability"; targetId = ability;
        metadata = { ability, provider, code: pick(["429", "500", "503"]) };
        break;
      case "user.login":
        targetType = "user"; targetId = String(userId);
        metadata = { method: "email" };
        break;
    }

    insertEventLog.run(
      event,
      userId,
      targetType || null,
      targetId || null,
      JSON.stringify(metadata),
      `192.168.${randInt(1, 255)}.${randInt(1, 255)}`,
      pick(["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "Mozilla/5.0 (Windows NT 10.0; Win64)", "Claude/1.0"]),
      ts
    );
  }
}

// Add admin action events
const adminId = userIds[0];
const reviewerId = userIds[2];
const adminActions: { event: string; skill: string; actor: number }[] = [
  { event: "skill.approve", skill: SKILL_SLUGS[0], actor: adminId },
  { event: "skill.reject", skill: SKILL_SLUGS[1], actor: adminId },
  { event: "skill.feature", skill: SKILL_SLUGS[0], actor: adminId },
  { event: "skill.approve", skill: SKILL_SLUGS[2], actor: adminId },
  { event: "skill.approve", skill: SKILL_SLUGS[3], actor: reviewerId },
];
for (const a of adminActions) {
  insertEventLog.run(
    a.event, a.actor, "skill", a.skill,
    JSON.stringify({ reason: "Auto-seeded" }),
    "127.0.0.1", "AdminSeed/1.0", daysAgo(randInt(1, 20))
  );
}

console.log("📊 Seeding user_stats...");
for (let i = 0; i < userIds.length; i++) {
  const uid = userIds[i];
  const isAdmin = i < 2;
  insertUserStats.run(
    uid,
    randInt(5, 50),
    tsForDay(randInt(0, 3), randInt(8, 20)),
    tsForDay(randInt(0, 5), randInt(6, 23)),
    isAdmin ? randInt(1, 3) : 0,
    randInt(0, 10),
    Date.now()
  );
}

// ── Verify ────────────────────────────────────────────────────────────────────

const totals = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM event_logs) as total_events,
    (SELECT COUNT(DISTINCT user_id) FROM event_logs WHERE user_id IS NOT NULL) as active_users,
    (SELECT COALESCE(SUM(CAST(json_extract(metadata, '$.totalTokens') AS INTEGER)), 0) FROM event_logs WHERE event='quota.use') as total_tokens,
    (SELECT COUNT(*) FROM skills WHERE moderation_status='approved') as total_skills
`).get() as Record<string, number>;

console.log("\n✅ Seed complete!");
console.log(`   Events:        ${totals.total_events}`);
console.log(`   Active users:  ${totals.active_users}`);
console.log(`   Total tokens:  ${totals.total_tokens}`);
console.log(`   Skills:        ${totals.total_skills}`);
console.log(`\n🔗 Open http://localhost:3000/admin to see the dashboard.`);

db.close();
