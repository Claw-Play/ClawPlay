import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { formatAverageRating } from "@/lib/ratings";
import { QuickInstallCard } from "@/components/QuickInstallCard";
import { ReviewsSection } from "@/components/ReviewsSection";
import { CheckIcon, SettingsIcon, AdminShieldIcon, StarIcon } from "@/components/icons";
import { SkillMdWorkspace, WorkflowDiagramWorkspace } from "@/components/SkillWorkspace";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, params.slug), isNull(skills.deletedAt)),
  });
  return {
    title: skill ? `${skill.name} — ClawPlay` : "Skill not found — ClawPlay",
    description: skill?.summary ?? "",
  };
}

export default async function SkillDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const auth = await getAuthFromCookies();
  const t = await getT("skill_detail");
  const tCommon = await getT("common");

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.slug, params.slug), isNull(skills.deletedAt)),
  });

  if (!skill) notFound();

  // Get all versions
  const versions = await db
    .select({
      id: skillVersions.id,
      version: skillVersions.version,
      changelog: skillVersions.changelog,
      content: skillVersions.content,
      parsedMetadata: skillVersions.parsedMetadata,
      workflowMd: skillVersions.workflowMd,
      createdAt: skillVersions.createdAt,
    })
    .from(skillVersions)
    .where(eq(skillVersions.skillId, skill.id))
    .orderBy(desc(skillVersions.createdAt));

  const latestVersion = versions[0];
  const parsedMetadata = latestVersion ? JSON.parse(latestVersion.parsedMetadata ?? "{}") : {};

  return (
    <div className="relative min-h-screen bg-[#fbfdff]">
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-[#667391]">
          <Link href="/skills" className="font-medium text-[#2d67f7] transition-colors hover:text-[#2457d4]">
            {t("breadcrumb_skills")}
          </Link>
          <span className="text-[#b3c0dd]">/</span>
          <span className="min-w-0 truncate font-medium text-[#102040]">{skill.name}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main content */}
          <div className="space-y-6">
            {/* Header */}
            <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-6 shadow-[0_8px_20px_rgba(25,43,87,0.06)]">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="font-heading text-[32px] font-bold tracking-[-0.03em] text-[#102040]">{skill.name}</h1>
                    <p className="mt-2 font-body text-sm text-[#667391]">
                      {tCommon("by")} <span className="font-semibold text-[#102040]">{skill.authorName || tCommon("anonymous")}</span>
                      <span className="mx-2 text-[#b3c0dd]">•</span>
                      <span className="font-medium text-[#2d67f7]">v{latestVersion?.version ?? "?"}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8f8] bg-[#f7faff] px-3 py-1 text-xs font-semibold text-[#2f6f4f]">
                      <CheckIcon className="h-3.5 w-3.5" /> {tCommon("approved")}
                    </span>
                    {skill.statsRatingsCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8f8] bg-[#f7faff] px-3 py-1 text-xs font-medium text-[#667391]">
                        <StarIcon className="h-3.5 w-3.5 text-[#2d67f7]" /> {formatAverageRating(skill.statsStars, skill.statsRatingsCount)} ({skill.statsRatingsCount})
                      </span>
                    )}
                  </div>
                </div>
                <p className="max-w-3xl text-[15px] leading-7 text-[#52617d] font-body">
                  {skill.summary || tCommon("no_description")}
                </p>
              </div>
            </div>

            {/* Environment Dependencies */}
            {(parsedMetadata?.metadata?.clawdbot?.requires ||
              parsedMetadata?.requires) && (
              <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-6 shadow-[0_8px_20px_rgba(25,43,87,0.06)]">
                <h2 className="mb-4 font-heading text-[20px] font-bold tracking-[-0.02em] text-[#102040]">
                  {t("env_dependencies")}
                </h2>
                <div className="space-y-3">
                  {(() => {
                    const reqs = parsedMetadata?.metadata?.clawdbot?.requires ?? parsedMetadata?.requires ?? {};
                    const deps = [
                      ...(reqs.env ?? []).map((e: string) => ({
                        icon: SettingsIcon,
                        label: e,
                        type: "env",
                      })),
                      ...(reqs.bins ?? []).map((b: string) => ({
                        icon: AdminShieldIcon,
                        label: b,
                        type: "bin",
                      })),
                    ];
                    if (!deps.length) return null;
                    return deps.map((dep, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-[6px] border border-[#dfe8f8] bg-[#f7faff] px-4 py-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[6px] bg-white text-[#2d67f7] shadow-sm">
                          <dep.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-heading text-sm font-semibold text-[#102040]">{dep.label}</p>
                          <p className="text-xs text-[#667391] font-body">
                            {dep.type === "env" ? t("env_var") : t("cli_tool")}
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* SKILL.md Preview */}
            {latestVersion?.content && (
              <SkillMdWorkspace
                title="SKILL.md"
                description={t("skill_md_preview")}
                value={latestVersion.content}
                mode="preview"
              />
            )}

            {/* Workflow Diagram Preview */}
            {latestVersion?.workflowMd && (
              <WorkflowDiagramWorkspace
                title={t("diagram_preview_label")}
                description={t("diagram_preview_desc")}
                mermaid={latestVersion.workflowMd}
                mode="preview"
              />
            )}

            {/* Version history */}
            <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-6 shadow-[0_8px_20px_rgba(25,43,87,0.06)]">
              <h2 className="mb-4 font-heading text-[20px] font-bold tracking-[-0.02em] text-[#102040]">{t("version_history")}</h2>
              <div className="space-y-3">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex gap-4 rounded-[6px] border border-[#edf3fd] bg-[#fbfdff] px-4 py-4 text-sm"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2d67f7]" />
                    </div>
                    <div>
                      <p className="font-heading font-semibold text-[#102040]">
                        v{v.version}
                        {v.id === latestVersion?.id && (
                          <span className="ml-2 text-xs font-normal text-[#667391] font-body">{tCommon("latest")}</span>
                        )}
                      </p>
                      <p className="font-body text-[#667391]">{v.changelog}</p>
                      <p className="mt-0.5 text-xs text-[#8b96ad] font-body">
                        {v.createdAt?.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-[#edf3fd] pt-4">
                <Link
                  href={`/skills/${skill.slug}/versions`}
                  className="text-sm font-medium text-[#2d67f7] transition-colors hover:text-[#2457d4] font-body"
                >
                  {t("view_all_versions")}
                </Link>
              </div>
            </div>

            {/* Reviews */}
            <ReviewsSection skillSlug={skill.slug} authUserId={auth?.userId ?? null} />
          </div>

          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <QuickInstallCard slug={skill.slug} repoUrl={skill.repoUrl} auth={!!auth} />
          </div>
        </div>
      </div>
    </div>
  );
}
