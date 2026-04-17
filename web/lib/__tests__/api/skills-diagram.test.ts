/**
 * Integration tests for POST /api/skills/diagram.
 * Mocks the LLM relay fetch call and the @cli/skill/diagram.mjs import.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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

// ── diagram.mjs mock ─────────────────────────────────────────────────────────
vi.mock("@cli/skill/diagram.mjs", () => ({
  extractPhaseDescriptions: vi.fn().mockImplementation((content: string) => {
    const map = new Map<string, string>();
    const re = /^##\s+(?:Phase|状态)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/gm;
    let match;
    while ((match = re.exec(content)) !== null) {
      map.set(match[1], `${match[1]} phase description`);
    }
    return map;
  }),
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
process.env.NEXT_LOCALE = "en";

let dbPath: string;
let db: any;
let userCookie: string;
let POST: (req: any) => Promise<Response>;
let originalFetch: typeof fetch;

const VALID_SKILL_MD = `---
name: Test Skill
---

# Test Skill

## Phase init

Instructions for init.

## Phase awaiting_input

Instructions for awaiting input.

## Phase done

Instructions for done.
`;

const MERMAID_RESPONSE = `\`\`\`mermaid
stateDiagram-v2
  [*] --> init
  init --> awaiting_input
  awaiting_input --> done
  done --> [*]
\`\`\``;

beforeAll(async () => {
  dbPath = tempDbPath();
  process.env.DATABASE_URL = dbPath;
  vi.resetModules();

  const dbMod = await import("@/lib/db");
  db = dbMod.db;

  const diagramMod = await import("@/app/api/skills/diagram/route");
  POST = diagramMod.POST;

  const user = await seedUser(db, { email: "diagram-test@example.com" });
  userCookie = user.cookie;

  // Save original fetch so we can restore it in afterAll
  originalFetch = global.fetch;
});

afterAll(() => {
  cleanupDb(dbPath);
  delete process.env.DATABASE_URL;
  cookieStore.token = undefined;
  global.fetch = originalFetch;
});

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/skills/diagram", () => {
  it("401 when not authenticated", async () => {
    cookieStore.token = undefined;
    const req = makeRequest("POST", "/api/skills/diagram", {
      body: { skillMdContent: VALID_SKILL_MD },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("400 when skillMdContent is missing", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/skills/diagram", { body: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("skillMdContent is required");
  });

  it("422 when no phase headers found", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    const req = makeRequest("POST", "/api/skills/diagram", {
      body: { skillMdContent: "# No phases here\nJust text." },
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("No phase headers detected");
  });

  it("502 when LLM relay returns non-ok", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 500 })
    );

    const req = makeRequest("POST", "/api/skills/diagram", {
      body: { skillMdContent: VALID_SKILL_MD },
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("200 and returns mermaid when LLM succeeds", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ text: MERMAID_RESPONSE }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = makeRequest("POST", "/api/skills/diagram", {
      body: { skillMdContent: VALID_SKILL_MD },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.mermaid).toBe("string");
    expect(json.mermaid).toContain("stateDiagram-v2");
    expect(json.mermaid).toContain("init");
  });

  it("500 when LLM output lacks code block delimiters", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          text: "stateDiagram-v2\n  [*] --> init\n  init --> [*]",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = makeRequest("POST", "/api/skills/diagram", {
      body: { skillMdContent: VALID_SKILL_MD },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("LLM did not return a valid Mermaid code block. Please try again");
  });

  it("deduplicates stateDiagram-v2 when LLM already includes it", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          text: "```mermaid\nstateDiagram-v2\n  [*] --> init\n  init --> [*]\n```",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = makeRequest("POST", "/api/skills/diagram", {
      body: { skillMdContent: VALID_SKILL_MD },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    // Should have exactly one stateDiagram-v2, not two
    const count = (json.mermaid.match(/stateDiagram-v2/g) || []).length;
    expect(count).toBe(1);
    expect(json.mermaid).toContain("stateDiagram-v2");
    expect(json.mermaid).toContain("[*] --> init");
  });

  it("500 when LLM output lacks entry node", async () => {
    cookieStore.token = userCookie.replace("clawplay_token=", "");
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          text: "```mermaid\nstateDiagram-v2\n  init --> [*]\n```",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = makeRequest("POST", "/api/skills/diagram", {
      body: { skillMdContent: VALID_SKILL_MD },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("LLM output is missing the entry node [*] -->. Please try again");
  });
});
