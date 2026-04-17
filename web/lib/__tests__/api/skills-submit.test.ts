/**
 * Integration tests for POST /api/skills/submit.
 * Verifies workflowMd is saved to skillVersions.workflowMd in the DB.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { tempDbPath, cleanupDb, seedUser } from "../helpers/db";
import { makeRequest } from "../helpers/request";

// ── Redis mock ────────────────────────────────────────────────────────────────
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    eval: vi.fn().mockResolvedValue(990),
  })),
}));

// ── Controllable next/headers mock ───────────────────────────────────────────
const cookieStore = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => ({
    get: (name: string) =>
      name === "clawplay_token" && cookieStore.token
        ? { value: cookieStore.token }
        : undefined,
  })),
}));

// ── Security scan mock — always pass ────────────────────────────────────────
vi.mock("@/lib/skill-security-scan", () => ({
  scanSkillContent: vi.fn().mockReturnValue({ safe: true, flags: [] }),
}));

// ── LLM safety mock — always pass ───────────────────────────────────────────
vi.mock("@/lib/skill-llm-safety", () => ({
  llmSafetyReview: vi.fn().mockResolvedValue(null),
}));

// ── Analytics mock ───────────────────────────────────────────────────────────
vi.mock("@/lib/analytics", () => ({
  analytics: {
    skill: { submit: vi.fn() },
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
let userCookie: string;
let POST: (req: any) => Promise<Response>;

const SKILL_MD = `---
name: Test Skill
---

# Test Skill

## Phase init

Hello world.
`;

const WORKFLOW_MD = `\`\`\`mermaid
stateDiagram-v2
  [*] --> init
  init --> [*]
\`\`\``;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const submitMod = await import("@/app/api/skills/submit/route");
  POST = submitMod.POST;

  const user = await seedUser(db, { email: "submit-workflow-test@example.com" });
  userCookie = user.cookie;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/skills/submit", () => {
  it("201 — saves workflowMd to skillVersions.workflowMd", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");

    const req = makeRequest("POST", "/api/skills/submit", {
      body: {
        name: "Workflow Test Skill",
        summary: "A skill to test workflowMd storage",
        skillMdContent: SKILL_MD,
        workflowMd: WORKFLOW_MD,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const { skill } = await res.json();
    expect(typeof skill.id).toBe("string");
    expect(skill.slug).toBeTruthy();

    // Verify workflowMd was written to DB
    const versions = await db.query.skillVersions.findMany();
    const version = versions.find((v: any) => v.skillId === skill.id);
    expect(version).toBeDefined();
    expect(version.workflowMd).toBe(WORKFLOW_MD);
  });

  it("201 — workflowMd defaults to empty string when not provided", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");

    const req = makeRequest("POST", "/api/skills/submit", {
      body: {
        name: "No Workflow Skill",
        skillMdContent: SKILL_MD,
        // no workflowMd field
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const { skill } = await res.json();
    const versions = await db.query.skillVersions.findMany();
    const version = versions.find((v: any) => v.skillId === skill.id);
    expect(version.workflowMd).toBe("");
  });

  it("401 when not authenticated", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("POST", "/api/skills/submit", {
      body: { name: "X", skillMdContent: SKILL_MD },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("400 when name or skillMdContent is missing", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");

    const req1 = makeRequest("POST", "/api/skills/submit", {
      body: { skillMdContent: SKILL_MD },
    });
    expect((await POST(req1)).status).toBe(400);

    const req2 = makeRequest("POST", "/api/skills/submit", {
      body: { name: "Test" },
    });
    expect((await POST(req2)).status).toBe(400);
  });
});
