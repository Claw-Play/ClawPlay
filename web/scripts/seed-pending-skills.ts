/**
 * Seed 20 pending skills for pagination testing.
 * Run: node -r tsx scripts/seed-pending-skills.ts
 */
import { db } from "../lib/db";
import { skills } from "../lib/db/schema";
import { eq } from "drizzle-orm";

function uid() {
  return crypto.randomUUID();
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

async function main() {
  // First clear existing pending skills
  await db.delete(skills).where(eq(skills.moderationStatus, "pending"));

  for (let i = 0; i < pendingSkills.length; i++) {
    const skill = pendingSkills[i];
    const id = uid();
    const slug = `${skill.name.toLowerCase().replace(/\s+/g, "-")}-${id.slice(0, 8)}`;
    // Stagger createdAt: most recent first, oldest last (newest at top)
    const createdAtOffset = i * 1800; // 30 min apart
    const createdAt = now - createdAtOffset;

    // @ts-expect-error drizzle typing complex with Proxy db
    await db.insert(skills).values([{
      id,
      slug,
      name: skill.name,
      summary: skill.summary,
      authorName: skill.authorName,
      authorEmail: skill.authorEmail,
      repoUrl: "https://github.com/example/" + slug,
      iconEmoji: "🤖",
      moderationStatus: "pending",
      moderationReason: "",
      moderationFlags: "[]",
      latestVersionId: null,
      statsStars: 0,
      statsRatingsCount: 0,
      statsViews: 0,
      statsDownloads: 0,
      statsInstalls: 0,
      createdAt,
      updatedAt: createdAt,
    }]);
    process.stdout.write(".");
  }
  console.log(`\nDone! Inserted ${pendingSkills.length} pending skills.`);
}

main().catch(console.error);
