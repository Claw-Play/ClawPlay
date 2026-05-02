import nodemailer from "nodemailer";

export const DEFAULT_TEAM_REVIEW_EMAIL = "clawplay-team@googlegroups.com";

export interface ReviewFlag {
  code: string;
  description: string;
}

export interface SkillSubmissionReviewEmailInput {
  skillId: string;
  skillName: string;
  slug: string;
  summary: string;
  repoUrl: string;
  authorName: string;
  authorEmail: string;
  reviewFlags: ReviewFlag[];
  reviewUrl: string;
  submittedAt?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
}

function normalizeSingleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function formatField(label: string, value: string | undefined | null): string {
  const normalized = value?.trim();
  return `${label}: ${normalized ? normalized : "—"}`;
}

function formatFlags(flags: ReviewFlag[]): string {
  if (flags.length === 0) return "- None (no warnings detected)";
  return flags
    .map((flag) => {
      const description = normalizeSingleLine(flag.description || "");
      return `- [${flag.code}] ${description}`;
    })
    .join("\n");
}

export function getReviewSubmissionEmailConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number.parseInt(process.env.SMTP_PORT?.trim() || "587", 10);
  if (!Number.isFinite(port) || port <= 0) {
    console.warn("[review-email] Invalid SMTP_PORT value");
    return null;
  }

  const from = process.env.SMTP_FROM?.trim() || user;
  const to = process.env.TEAM_REVIEW_EMAIL?.trim() || DEFAULT_TEAM_REVIEW_EMAIL;
  const secure = parseBooleanEnv(process.env.SMTP_SECURE, port === 465);

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    to,
  };
}

export function buildReviewSubmissionEmail(input: SkillSubmissionReviewEmailInput): {
  subject: string;
  text: string;
} {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const summary = input.summary.trim() || "—";
  const authorName = input.authorName.trim() || "Unknown author";
  const authorEmail = input.authorEmail.trim() || "—";
  const repoUrl = input.repoUrl.trim() || "—";
  const reviewFlags = formatFlags(input.reviewFlags);

  const text = [
    "A new Skill has been submitted for review.",
    "",
    formatField("Skill ID", input.skillId),
    formatField("Skill name", input.skillName),
    formatField("Slug", input.slug),
    formatField("Submitted at", submittedAt),
    formatField("Author", authorName),
    formatField("Author email", authorEmail),
    formatField("Repository", repoUrl),
    "",
    "Summary:",
    summary,
    "",
    "Review flags:",
    reviewFlags,
    "",
    `Review page: ${input.reviewUrl}`,
    "",
  ].join("\n");

  return {
    subject: `[ClawPlay] Skill awaiting review: ${input.slug}`,
    text,
  };
}

export async function sendSkillSubmissionReviewEmail(
  input: SkillSubmissionReviewEmailInput
): Promise<boolean> {
  const config = getReviewSubmissionEmailConfig();
  if (!config) {
    console.info("[review-email] SMTP not configured; skipping review notification");
    return false;
  }

  const { subject, text } = buildReviewSubmissionEmail(input);

  try {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      requireTLS: !config.secure,
    });

    await transport.sendMail({
      from: config.from,
      to: config.to,
      subject,
      text,
    });

    return true;
  } catch (err) {
    console.error("[review-email] Failed to send Skill submission notification:", err);
    return false;
  }
}
