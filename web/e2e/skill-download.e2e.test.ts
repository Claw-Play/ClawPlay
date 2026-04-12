import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import AdmZip from "adm-zip";
import { cleanupE2EData } from "../lib/__tests__/helpers/cleanup";

const ADMIN_PASSWORD = "adminpass123";
const SKILL_CONTENT = `---
name: Download Test Skill
version: 1.0.0
summary: A skill for download API testing.
author:
  name: Test Author
  email: test@example.com
---
# Download Test Skill
This skill exists to test the /download endpoint.
`;

let ADMIN_EMAIL = "";
let SKILL_SLUG = "";

function makeAdmin(email: string) {
  const scriptPath = path.join(__dirname, "..", "scripts", "make-admin.js");
  execSync(`node "${scriptPath}" "${email}"`, { cwd: path.join(__dirname, "..") });
}

test.describe("GET /api/skills/[slug]/download", () => {
  test.beforeAll(async ({ request }) => {
    cleanupE2EData();
    const ts = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    ADMIN_EMAIL = `dl_admin_${ts}_${suffix}@example.com`;
    const SKILL_NAME = `Download Test ${ts}_${suffix}`;
    SKILL_SLUG = `download-test-${ts}-${suffix}`;

    // Register + promote admin
    const reg = await request.post("/api/auth/register", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: "DL Admin" },
    });
    expect(reg.ok(), `admin registration failed: ${(await reg.json()).error}`).toBeTruthy();
    makeAdmin(ADMIN_EMAIL.toLowerCase());

    // Submit a skill (as admin — reuse same account)
    const loginRes = await request.post("/api/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.ok()).toBeTruthy();

    const submitRes = await request.post("/api/skills/submit", {
      data: { name: SKILL_NAME, slug: SKILL_SLUG, skillMdContent: SKILL_CONTENT },
    });
    expect(submitRes.ok(), `submit failed: ${JSON.stringify(await submitRes.json())}`).toBeTruthy();
    const { skill } = await submitRes.json();

    // Admin approves via API
    const approveRes = await request.patch(`/api/admin/skills/${skill.id}`, {
      data: { action: "approve" },
    });
    expect(approveRes.ok(), `approve failed: ${JSON.stringify(await approveRes.json())}`).toBeTruthy();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  test("returns a valid zip with SKILL.md and origin.json", async ({ request }) => {
    const res = await request.get(`/api/skills/${SKILL_SLUG}/download`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/zip");

    const body = await res.body();
    const zip = new AdmZip(body);
    const entries = zip.getEntries().map((e) => e.entryName);

    expect(entries).toContain("SKILL.md");
    expect(entries).toContain("origin.json");
  });

  test("SKILL.md contains the original content", async ({ request }) => {
    const res = await request.get(`/api/skills/${SKILL_SLUG}/download`);
    const body = await res.body();
    const zip = new AdmZip(body);

    const skillMd = zip.readAsText("SKILL.md");
    expect(skillMd).toContain("Download Test Skill");
  });

  test("origin.json has correct slug and source", async ({ request }) => {
    const res = await request.get(`/api/skills/${SKILL_SLUG}/download`);
    const body = await res.body();
    const zip = new AdmZip(body);

    const origin = JSON.parse(zip.readAsText("origin.json"));
    expect(origin.slug).toBe(SKILL_SLUG);
    expect(origin.source).toBe("clawplay");
    expect(origin.version).toBeTruthy();
    expect(origin.installedAt).toBeTruthy();
  });

  test("Content-Disposition header contains slug and version", async ({ request }) => {
    const res = await request.get(`/api/skills/${SKILL_SLUG}/download`);
    const disposition = res.headers()["content-disposition"] ?? "";
    expect(disposition).toContain(SKILL_SLUG);
    expect(disposition).toContain(".zip");
  });

  test("?version= resolves a specific version", async ({ request }) => {
    // Get the skill's version first
    const skillRes = await request.get(`/api/skills/${SKILL_SLUG}`);
    const { skill } = await skillRes.json();
    const version = skill.version;

    const res = await request.get(`/api/skills/${SKILL_SLUG}/download?version=${version}`);
    expect(res.status()).toBe(200);
  });

  // ── Error cases ─────────────────────────────────────────────────────────────

  test("non-existent slug → 404", async ({ request }) => {
    const res = await request.get("/api/skills/does-not-exist-xyz/download");
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  test("non-existent version → 404", async ({ request }) => {
    const res = await request.get(`/api/skills/${SKILL_SLUG}/download?version=99.99.99`);
    expect(res.status()).toBe(404);
  });

  test("invalid slug characters → 400", async ({ request }) => {
    const res = await request.get("/api/skills/Bad_Slug!/download");
    expect(res.status()).toBe(400);
  });

  test("pending (unapproved) skill → 404", async ({ request }) => {
    // Submit a new skill without approving it
    const ts = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    const pendingSlug = `pending-skill-${ts}-${suffix}`;

    await request.post("/api/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    await request.post("/api/skills/submit", {
      data: {
        name: `Pending ${ts}`,
        slug: pendingSlug,
        skillMdContent: SKILL_CONTENT,
      },
    });

    const res = await request.get(`/api/skills/${pendingSlug}/download`);
    expect(res.status()).toBe(404);
  });
});
