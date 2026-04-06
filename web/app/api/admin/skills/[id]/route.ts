import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { appendAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = params;
  const body = await request.json();
  const { action, reason } = body as {
    action?: "approve" | "reject";
    reason?: string;
  };

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'." },
      { status: 400 }
    );
  }

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, id), isNull(skills.deletedAt)),
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  await db
    .update(skills)
    .set({
      moderationStatus: newStatus,
      moderationReason: reason ?? "",
      updatedAt: new Date(),
    })
    .where(and(eq(skills.id, id), isNull(skills.deletedAt)));

  appendAuditLog({
    ts: new Date().toISOString(),
    actorId: auth.userId,
    action: action === "approve" ? "approve_skill" : "reject_skill",
    targetType: "skill",
    targetId: id,
    metadata: { reason: reason ?? "", slug: skill.slug },
  });

  return NextResponse.json({
    skill: { ...skill, moderationStatus: newStatus },
    message:
      action === "approve"
        ? "Skill approved and published."
        : "Skill rejected.",
  });
}
