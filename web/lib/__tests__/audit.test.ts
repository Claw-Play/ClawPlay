import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("appendAuditLog", () => {
  let tmpDir: string;
  let tmpFile: string;
  const originalEnv = process.env.AUDIT_LOG_PATH;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawplay-audit-test-"));
    tmpFile = path.join(tmpDir, "audit.jsonl");
    process.env.AUDIT_LOG_PATH = tmpFile;
    // Clear module cache so AUDIT_FILE is re-evaluated with new env var
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalEnv !== undefined) {
      process.env.AUDIT_LOG_PATH = originalEnv;
    } else {
      delete process.env.AUDIT_LOG_PATH;
    }
  });

  it("writes a JSONL entry to the audit log file", async () => {
    const { appendAuditLog } = await import("@/lib/audit");
    const entry = {
      ts: new Date().toISOString(),
      actorId: 1,
      action: "approve_skill" as const,
      targetType: "skill" as const,
      targetId: "skill-123",
      metadata: { reason: "looks good" },
    };

    appendAuditLog(entry);

    const content = fs.readFileSync(tmpFile, "utf8");
    const parsed = JSON.parse(content.trim());
    expect(parsed.actorId).toBe(1);
    expect(parsed.action).toBe("approve_skill");
    expect(parsed.targetId).toBe("skill-123");
    expect(parsed.metadata.reason).toBe("looks good");
  });

  it("appends multiple entries as separate JSONL lines", async () => {
    const { appendAuditLog } = await import("@/lib/audit");
    const entry1 = {
      ts: new Date().toISOString(),
      actorId: 1,
      action: "submit_skill" as const,
      targetType: "skill" as const,
      targetId: "skill-1",
      metadata: {},
    };
    const entry2 = {
      ts: new Date().toISOString(),
      actorId: 2,
      action: "reject_skill" as const,
      targetType: "skill" as const,
      targetId: "skill-2",
      metadata: { reason: "spam" },
    };

    appendAuditLog(entry1);
    appendAuditLog(entry2);

    const lines = fs.readFileSync(tmpFile, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).action).toBe("submit_skill");
    expect(JSON.parse(lines[1]).action).toBe("reject_skill");
  });

  it("creates the directory if it does not exist", async () => {
    const nestedDir = path.join(tmpDir, "nested", "dir");
    const nestedFile = path.join(nestedDir, "audit.jsonl");
    process.env.AUDIT_LOG_PATH = nestedFile;
    vi.resetModules();

    const { appendAuditLog } = await import("@/lib/audit");
    appendAuditLog({
      ts: new Date().toISOString(),
      actorId: 5,
      action: "generate_token" as const,
      targetType: "user_token" as const,
      targetId: "token-abc",
      metadata: {},
    });

    expect(fs.existsSync(nestedFile)).toBe(true);
  });

  it("does not throw if the log path is not writable (non-crash contract)", async () => {
    process.env.AUDIT_LOG_PATH = "/nonexistent-root-path/audit.jsonl";
    vi.resetModules();

    const { appendAuditLog } = await import("@/lib/audit");
    expect(() =>
      appendAuditLog({
        ts: new Date().toISOString(),
        actorId: 1,
        action: "revoke_token" as const,
        targetType: "user_token" as const,
        targetId: "tok",
        metadata: {},
      })
    ).not.toThrow();
  });
});
