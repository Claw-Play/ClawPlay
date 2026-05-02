import { describe, it, expect, vi, beforeAll } from "vitest";
import { makeRequest } from "../helpers/request";

const authMock = vi.hoisted(() => ({
  user: { userId: 1, role: "user" as const },
}));

vi.mock("@/lib/auth", () => ({
  getAuthFromCookies: vi.fn().mockImplementation(() => authMock.user),
}));

const scanMock = vi.hoisted(() => ({
  result: { safe: true, flags: [] as { code: string; description: string; severity: string }[] },
}));

vi.mock("@/lib/skill-security-scan", () => ({
  scanSkillContent: vi.fn().mockImplementation(() => scanMock.result),
}));

const llmMock = vi.hoisted(() => ({
  result: null as { verdict: string; reason: string; flags: { code: string; description: string }[] } | null,
  shouldThrow: false,
}));

vi.mock("@/lib/skill-llm-safety", () => ({
  llmSafetyReview: vi.fn().mockImplementation(() => {
    if (llmMock.shouldThrow) throw new Error("LLM not available");
    return llmMock.result;
  }),
}));

vi.mock("@/lib/providers/llm", () => ({
  getLLMProvider: vi.fn(() => ({
    generate: vi.fn(),
  })),
}));

vi.mock("@/lib/i18n", () => ({
  getT: vi.fn().mockResolvedValue((key: string) => key),
}));

const VALID_MINIMAL_SKILL_MD = `---
name: Minimal Skill
description: Minimal description
---

# Minimal Skill
`;

let POST: (req: any) => Promise<Response>;

beforeAll(async () => {
  const mod = await import("@/app/api/skills/validate/route");
  POST = mod.POST;
});

describe("POST /api/skills/validate", () => {
  beforeEach(() => {
    // Reset all mocks to defaults
    authMock.user = { userId: 1, role: "user" };
    scanMock.result = { safe: true, flags: [] };
    llmMock.result = null;
    llmMock.shouldThrow = false;
  });

  it("accepts minimal frontmatter without Phase or recommended sections", async () => {
    const req = makeRequest("POST", "/api/skills/validate", {
      body: { skillMdContent: VALID_MINIMAL_SKILL_MD },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.safe).toBe(true);
    expect(json.errors).toEqual([]);
    expect(json.warnings).toEqual([]);
  });

  it("still requires name and description in frontmatter", async () => {
    const req = makeRequest("POST", "/api/skills/validate", {
      body: { skillMdContent: `---\nname: Only Name\n---\n# Title` },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.safe).toBe(false);
    expect(json.errors.join("\n")).toContain("Frontmatter is missing a `description` field.");
  });

  it("unauthenticated → 401", async () => {
    authMock.user = null;
    const req = makeRequest("POST", "/api/skills/validate", {
      body: { skillMdContent: VALID_MINIMAL_SKILL_MD },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("missing skillMdContent → 400", async () => {
    const req = makeRequest("POST", "/api/skills/validate", {
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("security scan error → unsafe", async () => {
    scanMock.result = {
      safe: false,
      flags: [{ code: "EXEC_SCRIPT", description: "Contains exec-like code", severity: "error" }],
    };
    const req = makeRequest("POST", "/api/skills/validate", {
      body: { skillMdContent: VALID_MINIMAL_SKILL_MD },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.safe).toBe(false);
    expect(json.errors).toContain("[EXEC_SCRIPT] Contains exec-like code");
  });

  it("security scan warning → included in warnings", async () => {
    scanMock.result = {
      safe: true,
      flags: [{ code: "EXTERNAL_URL", description: "Contains external URL", severity: "warning" }],
    };
    const req = makeRequest("POST", "/api/skills/validate", {
      body: { skillMdContent: VALID_MINIMAL_SKILL_MD },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.warnings).toContain("[EXTERNAL_URL] Contains external URL");
  });

  it("LLM review returns UNSAFE → errors added", async () => {
    llmMock.result = {
      verdict: "UNSAFE",
      reason: "Contains suspicious content",
      flags: [{ code: "SUS_CONTENT", description: "Suspicious markdown detected" }],
    };
    const req = makeRequest("POST", "/api/skills/validate", {
      body: { skillMdContent: VALID_MINIMAL_SKILL_MD },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.errors).toContain("Safety review: Contains suspicious content");
    expect(json.warnings).toContain("[LLM_SUS_CONTENT] Suspicious markdown detected");
  });

  it("LLM review returns SAFE → warnings only", async () => {
    llmMock.result = {
      verdict: "SAFE",
      reason: "",
      flags: [{ code: "CHECK", description: "Minor concern" }],
    };
    const req = makeRequest("POST", "/api/skills/validate", {
      body: { skillMdContent: VALID_MINIMAL_SKILL_MD },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.safe).toBe(true);
    expect(json.warnings).toContain("[LLM_CHECK] Minor concern");
  });

  it("LLM review throws → gracefully degrades (no error)", async () => {
    llmMock.shouldThrow = true;
    const req = makeRequest("POST", "/api/skills/validate", {
      body: { skillMdContent: VALID_MINIMAL_SKILL_MD },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.safe).toBe(true);
  });
});
