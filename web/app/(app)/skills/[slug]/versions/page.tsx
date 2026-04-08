import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getT } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, params.slug), isNull(skills.deletedAt)),
  });
  return {
    title: skill ? `${skill.name} — 版本历史` : "Version History",
  };
}

// ── Pure-TS line diff ──────────────────────────────────────────────────────

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  lineNo: number;
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  let i = m;
  let j = n;
  const ops: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: "unchanged", text: oldLines[i - 1], lineNo: i });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: "added", text: newLines[j - 1], lineNo: j });
      j--;
    } else {
      ops.unshift({ type: "removed", text: oldLines[i - 1], lineNo: i });
      i--;
    }
  }

  return ops;
}

export default async function SkillVersionsPage({
  params,
}: {
  params: { slug: string };
}) {
  const t = getT("skill_versions");
  const tCommon = getT("common");

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, params.slug), isNull(skills.deletedAt)),
  });

  if (!skill) notFound();

  const versions = await db
    .select({
      id: skillVersions.id,
      version: skillVersions.version,
      changelog: skillVersions.changelog,
      content: skillVersions.content,
      createdAt: skillVersions.createdAt,
    })
    .from(skillVersions)
    .where(eq(skillVersions.skillId, skill.id))
    .orderBy(desc(skillVersions.createdAt));

  if (versions.length === 0) notFound();

  // Pre-compute diffs between consecutive versions (oldest → newest)
  // versions[0] is newest, versions[last] is oldest
  const diffs: Array<{
    versionId: string;
    version: string;
    diffLines: DiffLine[] | null;
  }> = [];

  for (let idx = 0; idx < versions.length; idx++) {
    const v = versions[idx];
    const prev = versions[idx + 1]; // older version (lower index = newer)

    let diffLines: DiffLine[] | null = null;
    if (prev) {
      diffLines = computeLineDiff(prev.content, v.content);
    }

    diffs.push({ versionId: v.id, version: v.version, diffLines });
  }

  const latestVersion = versions[0];

  return (
    <div className="min-h-screen bg-[#faf3d0]">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#7a6a5a] mb-8 font-body">
          <Link href="/skills" className="hover:text-[#a23f00]">
            {t("breadcrumb_skills")}
          </Link>
          <span>/</span>
          <Link href={`/skills/${skill.slug}`} className="hover:text-[#a23f00]">
            {skill.name}
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#564337]">
            {t("breadcrumb_versions")}
          </span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-heading text-[#564337] mb-2">
            {t("title")}
          </h1>
          <p className="text-[#7a6a5a] font-body">
            {t("subtitle", { name: skill.name })}
          </p>
        </div>

        {/* Version list */}
        <div className="space-y-8">
          {diffs.map(({ versionId, version, diffLines }, idx) => {
            const v = versions[idx];
            const isLatest = v.id === latestVersion?.id;

            return (
              <div
                key={versionId}
                className="bg-[#fffdf7] card-radius border border-[#e8dfc8] card-shadow overflow-hidden"
              >
                {/* Version header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8dfc8]">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold font-heading text-[#564337]">
                      v{version}
                    </span>
                    {isLatest && (
                      <span className="px-2 py-0.5 bg-[#586330]/10 text-[#586330] text-xs font-semibold rounded-full font-body">
                        {tCommon("latest")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[#7a6a5a] font-body">
                    {v.changelog && (
                      <span>{t("changelog")}: {v.changelog}</span>
                    )}
                    <span>
                      {v.createdAt?.toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Diff view */}
                {diffLines && diffLines.length > 0 ? (
                  <div className="px-6 py-4 overflow-x-auto">
                    <p className="text-xs text-[#7a6a5a] mb-3 font-body">
                      {t("compare_with_previous")}
                    </p>
                    <div className="text-sm font-mono leading-relaxed rounded-lg overflow-hidden">
                      {diffLines.map((line, lineIdx) => (
                        <div
                          key={lineIdx}
                          className={`flex gap-3 px-3 py-0.5 ${
                            line.type === "added"
                              ? "bg-[#d4edda] text-[#155724]"
                              : line.type === "removed"
                              ? "bg-[#f8d7da] text-[#721c24]"
                              : "text-[#495057]"
                          }`}
                        >
                          <span className="w-8 flex-shrink-0 text-right text-[#a89888] select-none">
                            {line.type !== "added" ? line.lineNo : ""}
                          </span>
                          <span className="w-6 flex-shrink-0 select-none">
                            {line.type === "added"
                              ? "+"
                              : line.type === "removed"
                              ? "-"
                              : " "}
                          </span>
                          <span className="whitespace-pre-wrap break-all">
                            {line.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : diffLines ? (
                  <div className="px-6 py-4 text-sm text-[#7a6a5a] font-body italic">
                    {t("no_diff")}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {versions.length === 0 && (
          <div className="text-center py-16 text-[#7a6a5a] font-body">
            {t("no_versions")}
          </div>
        )}
      </div>
    </div>
  );
}
