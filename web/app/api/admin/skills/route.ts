import { NextRequest, NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { raw } from "@/lib/db";
import { getT } from "@/lib/i18n";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function buildSearchClause(search: string): { clause: string; params: string[] } {
  if (!search.trim()) return { clause: "", params: [] };
  const pattern = `%${search.trim()}%`;
  return {
    clause: "AND (name LIKE ? OR slug LIKE ? OR author_name LIKE ? OR author_email LIKE ?)",
    params: [pattern, pattern, pattern, pattern],
  };
}

export async function GET(request: NextRequest) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  }

  if (auth.role !== "admin" && auth.role !== "reviewer") {
    return NextResponse.json({ error: t("forbidden") }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = clampInt(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 1_000_000);
  const search = searchParams.get("search")?.trim() ?? "";
  const searchClause = buildSearchClause(search);

  const baseWhere = `FROM skills WHERE moderation_status = 'pending' AND deleted_at IS NULL ${searchClause.clause}`;

  const countRows = raw(
    `SELECT COUNT(*) as count ${baseWhere}`,
    searchClause.params
  ) as { count: number }[];
  const total = Number(countRows[0]?.count ?? 0);

  const skillsRows = raw(
    `SELECT id,
            slug,
            name,
            summary,
            author_name as authorName,
            author_email as authorEmail,
            icon_emoji as iconEmoji,
            created_at as createdAt
       ${baseWhere}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    [...searchClause.params, limit, offset]
  ) as {
    id: string;
    slug: string;
    name: string;
    summary: string;
    authorName: string;
    authorEmail: string;
    iconEmoji: string;
    createdAt: string | number;
  }[];

  const skills = skillsRows.map((skill) => ({
    ...skill,
    createdAt:
      typeof skill.createdAt === "number"
        ? new Date(skill.createdAt * 1000).toISOString()
        : new Date(skill.createdAt).toISOString(),
  }));

  return NextResponse.json({
    skills,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + skills.length < total,
    },
  });
}
