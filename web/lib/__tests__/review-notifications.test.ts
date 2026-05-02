import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const smtp = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: smtp.createTransport,
  },
}));

let buildReviewSubmissionEmail: typeof import("@/lib/review-notifications").buildReviewSubmissionEmail;
let getReviewSubmissionEmailConfig: typeof import("@/lib/review-notifications").getReviewSubmissionEmailConfig;
let sendSkillSubmissionReviewEmail: typeof import("@/lib/review-notifications").sendSkillSubmissionReviewEmail;

beforeEach(async () => {
  vi.resetModules();
  smtp.createTransport.mockReset();
  smtp.sendMail.mockReset();

  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "app-password";
  delete process.env.SMTP_FROM;
  delete process.env.SMTP_SECURE;
  delete process.env.TEAM_REVIEW_EMAIL;

  const mod = await import("@/lib/review-notifications");
  buildReviewSubmissionEmail = mod.buildReviewSubmissionEmail;
  getReviewSubmissionEmailConfig = mod.getReviewSubmissionEmailConfig;
  sendSkillSubmissionReviewEmail = mod.sendSkillSubmissionReviewEmail;
});

afterEach(() => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
  delete process.env.SMTP_SECURE;
  delete process.env.TEAM_REVIEW_EMAIL;
});

describe("review notifications", () => {
  it("builds a review notification message with key details", () => {
    const email = buildReviewSubmissionEmail({
      skillId: "skill_123",
      skillName: "Workflow Test Skill",
      slug: "workflow-test-skill",
      summary: "Short summary",
      repoUrl: "https://github.com/acme/workflow-test",
      authorName: "Alice",
      authorEmail: "alice@example.com",
      reviewFlags: [{ code: "LLM_WARN", description: "Needs manual check" }],
      reviewUrl: "https://clawplay.shop/admin/review/skill_123",
      submittedAt: "2026-04-29T12:00:00.000Z",
    });

    expect(email.subject).toBe("[ClawPlay] Skill awaiting review: workflow-test-skill");
    expect(email.text).toContain("Skill ID: skill_123");
    expect(email.text).toContain("Skill name: Workflow Test Skill");
    expect(email.text).toContain("Author: Alice");
    expect(email.text).toContain("Author email: alice@example.com");
    expect(email.text).toContain("- [LLM_WARN] Needs manual check");
    expect(email.text).toContain("Review page: https://clawplay.shop/admin/review/skill_123");
  });

  it("reads smtp config with default team recipient", () => {
    expect(getReviewSubmissionEmailConfig()).toEqual({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user: "sender@example.com",
      pass: "app-password",
      from: "sender@example.com",
      to: "clawplay-team@googlegroups.com",
    });
  });

  it("renders a clearer no-flag message when there are no warnings", () => {
    const email = buildReviewSubmissionEmail({
      skillId: "skill_123",
      skillName: "Workflow Test Skill",
      slug: "workflow-test-skill",
      summary: "Short summary",
      repoUrl: "https://github.com/acme/workflow-test",
      authorName: "Alice",
      authorEmail: "alice@example.com",
      reviewFlags: [],
      reviewUrl: "https://clawplay.shop/admin/review/skill_123",
      submittedAt: "2026-04-29T12:00:00.000Z",
    });

    expect(email.text).toContain("Review flags:");
    expect(email.text).toContain("None (no warnings detected)");
  });

  it("sends mail through nodemailer using the configured values", async () => {
    smtp.sendMail.mockResolvedValue({ messageId: "msg-1" });
    smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail });

    const sent = await sendSkillSubmissionReviewEmail({
      skillId: "skill_123",
      skillName: "Workflow Test Skill",
      slug: "workflow-test-skill",
      summary: "Short summary",
      repoUrl: "https://github.com/acme/workflow-test",
      authorName: "Alice",
      authorEmail: "alice@example.com",
      reviewFlags: [],
      reviewUrl: "https://clawplay.shop/admin/review/skill_123",
      submittedAt: "2026-04-29T12:00:00.000Z",
    });

    expect(sent).toBe(true);
    expect(smtp.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: "sender@example.com",
          pass: "app-password",
        },
      })
    );
    expect(smtp.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "sender@example.com",
        to: "clawplay-team@googlegroups.com",
        subject: "[ClawPlay] Skill awaiting review: workflow-test-skill",
      })
    );
  });

  it("skips safely when SMTP is not configured", async () => {
    delete process.env.SMTP_HOST;

    const sent = await sendSkillSubmissionReviewEmail({
      skillId: "skill_123",
      skillName: "Workflow Test Skill",
      slug: "workflow-test-skill",
      summary: "Short summary",
      repoUrl: "https://github.com/acme/workflow-test",
      authorName: "Alice",
      authorEmail: "alice@example.com",
      reviewFlags: [],
      reviewUrl: "https://clawplay.shop/admin/review/skill_123",
      submittedAt: "2026-04-29T12:00:00.000Z",
    });

    expect(sent).toBe(false);
    expect(smtp.createTransport).not.toHaveBeenCalled();
  });
});
