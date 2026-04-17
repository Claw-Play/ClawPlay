/**
 * Integration tests for GET /api/skills/[slug]/download.
 * Verifies zip includes references/workflow.md when skillVersion.workflowMd is set.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import JSZip from "jszip";
import { tempDbPath, cleanupDb, seedAdmin } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// ── Redis mock ────────────────────────────────────────────────────────────────
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    eval: vi.fn().mockResolvedValue(990),
  })),
}));

// ── Analytics mock ───────────────────────────────────────────────────────────
vi.mock("@/lib/analytics", () => ({
  analytics: {
    skill: { submit: vi.fn(), download: vi.fn() },
    user: { login: vi.fn() },
  },
  logEvent: vi.fn(),
  incrementSkillStat: vi.fn(),
}));

// ── Env vars ─────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = "test-jwt-secret-32-bytes-long!!!";
process.env.CLAWPLAY_SECRET_KEY = "a".repeat(64);
process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

let dbPath: string;
let db: any;
let GET: (req: any, ctx: any) => Promise<Response>;

const SKILL_MD = `# Test Skill\n\n## Phase init\n\nHello.`;
const WORKFLOW_MD = `\`\`\`mermaid
stateDiagram-v2
  [*] --> init
  init --> [*]
\`\`\``;

let skillSlug: string;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const downloadMod = await import("@/app/api/skills/[slug]/download/route");
  GET = (req, ctx) => downloadMod.GET(req, ctx as any);

  // Seed an admin so we can seed the skill
  await seedAdmin(db, { email: "admin@example.com" });

  // Insert a skill + approved version with workflowMd
  const { skills, skillVersions } = await import("@/lib/db/schema");
  const [skill] = await (db as any)
    .insert(skills)
    .values({
      id: "test-skill-id-" + Date.now(),
      slug: "test-workflow-skill",
      name: "Test Workflow Skill",
      moderationStatus: "approved",
    })
    .returning();
  skillSlug = skill.slug;

  const [version] = await (db as any)
    .insert(skillVersions)
    .values({
      id: "test-version-id-" + Date.now(),
      skillId: skill.id,
      version: "1.0.0",
      content: SKILL_MD,
      workflowMd: WORKFLOW_MD,
      authorId: 1,
    })
    .returning();

  await (db as any)
    .update(skills)
    .set({ latestVersionId: version.id })
    .where(eq(skills.id, skill.id));
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/skills/[slug]/download", () => {
  it("zip contains references/workflow.md when workflowMd is set", async () => {
    const req = makeRequest("GET", `/api/skills/${skillSlug}/download`);
    const res = await GET(req, { params: { slug: skillSlug } });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("zip");

    const buffer = Buffer.from(await res.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);

    const zipFiles = Object.keys(zip.files);
    expect(zipFiles).toContain("SKILL.md");
    expect(zipFiles).toContain("origin.json");
    expect(zipFiles).toContain("references/workflow.md");

    const workflowContent = await zip.file("references/workflow.md")?.async("string");
    expect(workflowContent).toBe(WORKFLOW_MD);
  });

  it("zip does NOT contain references/workflow.md when workflowMd is empty", async () => {
    // Insert a skill with empty workflowMd
    const { skills, skillVersions } = await import("@/lib/db/schema");

    const [skill] = await (db as any)
      .insert(skills)
      .values({
        id: "test-skill-no-workflow-" + Date.now(),
        slug: "test-no-workflow-skill",
        name: "Test No Workflow Skill",
        moderationStatus: "approved",
      })
      .returning();

    const [version] = await (db as any)
      .insert(skillVersions)
      .values({
        id: "test-version-no-workflow-" + Date.now(),
        skillId: skill.id,
        version: "1.0.0",
        content: SKILL_MD,
        workflowMd: "",
        authorId: 1,
      })
      .returning();

    await (db as any)
      .update(skills)
      .set({ latestVersionId: version.id })
      .where(eq(skills.id, skill.id));

    const req = makeRequest("GET", `/api/skills/${skill.slug}/download`);
    const res = await GET(req, { params: { slug: skill.slug } });

    expect(res.status).toBe(200);

    const buffer = Buffer.from(await res.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const zipFiles = Object.keys(zip.files);

    expect(zipFiles).toContain("SKILL.md");
    expect(zipFiles).not.toContain("references/workflow.md");
  });

  it("400 for invalid slug characters (path traversal guard)", async () => {
    const req = makeRequest("GET", "/api/skills/../../../etc/passwd/download");
    const res = await GET(req, { params: { slug: "../../../etc/passwd" } });
    expect(res.status).toBe(400);
  });

  it("404 for non-existent slug", async () => {
    const req = makeRequest("GET", "/api/skills/does-not-exist/download");
    const res = await GET(req, { params: { slug: "does-not-exist" } });
    expect(res.status).toBe(404);
  });
});
