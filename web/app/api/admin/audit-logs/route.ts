import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const auditPath =
    process.env.AUDIT_LOG_PATH ??
    path.join(process.cwd(), "..", "data", "audit.jsonl");

  let entries: object[] = [];

  try {
    if (!fs.existsSync(auditPath)) {
      return NextResponse.json({ entries: [], total: 0 });
    }

    const content = fs.readFileSync(auditPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Return most recent entries first
    const recent = lines.slice(-limit - offset).slice(0, limit);
    entries = recent.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });

    return NextResponse.json({ entries, total: lines.length });
  } catch (err) {
    console.error("[api/admin/audit-logs]", err);
    return NextResponse.json(
      { error: "Could not read audit log." },
      { status: 500 }
    );
  }
}
