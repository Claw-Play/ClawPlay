import fs from "fs";
import path from "path";

export type AuditAction =
  | "approve_skill"
  | "reject_skill"
  | "generate_token"
  | "revoke_token"
  | "submit_skill";

export interface AuditEntry {
  ts: string;
  actorId: number;
  action: AuditAction;
  targetType: "skill" | "user_token" | "user";
  targetId: string;
  metadata: Record<string, unknown>;
}

const AUDIT_FILE =
  process.env.AUDIT_LOG_PATH ??
  path.join(process.cwd(), "..", "data", "audit.jsonl");

export function appendAuditLog(entry: AuditEntry): void {
  try {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n");
  } catch (err) {
    // Don't crash the request — log and continue
    console.error("[audit] Failed to write audit log:", err);
  }
}
