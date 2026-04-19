import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { QuickInstallCard } from "@/components/QuickInstallCard";
import { ReviewsSection } from "@/components/ReviewsSection";
import { CheckIcon, SettingsIcon, AdminShieldIcon, StarIcon } from "@/components/icons";

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
      createdAt: skillVersions.createdAt,
    })
    .from(skillVersions)
    .where(eq(skillVersions.skillId, skill.id))
    .orderBy(desc(skillVersions.createdAt));

  const latestVersion = versions[0];
  const parsedMetadata = latestVersion
    ? JSON.parse((await db.query.skillVersions.findFirst({
        where: eq(skillVersions.id, latestVersion.id),
      }))?.parsedMetadata ?? "{}")
    : {};

  return (
    <div className="min-h-screen bg-[#faf3d0]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#7a6a5a] mb-8 font-body">
          <Link href="/skills" className="hover:text-[#a23f00]">{t("breadcrumb_skills")}</Link>
          <span>/</span>
          <span className="font-semibold text-[#564337] truncate">{skill.name}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow">
              <div className="flex flex-col gap-1">
                  <h1 className="text-2xl font-bold font-heading text-[#564337]">{skill.name}</h1>
                  <p className="text-[#7a6a5a] mt-1 font-body">
                    {tCommon("by")} <span className="font-semibold">{skill.authorName || tCommon("anonymous")}</span>
                    {" · "}
                    <span className="text-[#fa7025]">v{latestVersion?.version ?? "?"}</span>
                  </p>
                  <p className="text-[#7a6a5a] text-sm mt-2 font-body">
                    {skill.summary || tCommon("no_description")}
                  </p>
                </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#586330]/10 text-[#586330] text-xs font-semibold rounded-full font-body">
                  <CheckIcon className="w-3.5 h-3.5" /> {tCommon("approved")}
                </span>
                {skill.statsRatingsCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#faf3d0] text-[#7a6a5a] text-xs font-medium rounded-full font-body">
                    <StarIcon className="w-3 h-3" /> {(skill.statsStars / skill.statsRatingsCount).toFixed(1)} ({skill.statsRatingsCount})
                  </span>
                )}
              </div>
            </div>

            {/* Environment Dependencies */}
            {(parsedMetadata?.metadata?.clawdbot?.requires ||
              parsedMetadata?.requires) && (
              <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow">
                <h2 className="font-semibold font-heading text-[#564337] mb-4">
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
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[12px] bg-[#faf3d0] flex items-center justify-center flex-shrink-0">
                          <dep.icon className="w-4 h-4 text-[#a23f00]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#564337] font-heading">{dep.label}</p>
                          <p className="text-xs text-[#a89888] font-body">
                            {dep.type === "env" ? t("env_var") : t("cli_tool")}
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Version history */}
            <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow">
              <h2 className="font-semibold font-heading text-[#564337] mb-4">{t("version_history")}</h2>
              <div className="space-y-3">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex gap-4 text-sm"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-[#fa7025]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#564337] font-heading">
                        v{v.version}
                        {v.id === latestVersion?.id && (
                          <span className="ml-2 text-xs text-[#7a6a5a] font-body">{tCommon("latest")}</span>
                        )}
                      </p>
                      <p className="text-[#7a6a5a] font-body">{v.changelog}</p>
                      <p className="text-[#a89888] text-xs mt-0.5 font-body">
                        {v.createdAt?.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[#e8dfc8]">
                <Link
                  href={`/skills/${skill.slug}/versions`}
                  className="text-sm text-[#a23f00] hover:text-[#c45000] font-body font-medium transition-colors"
                >
                  {t("view_all_versions")}
                </Link>
              </div>
            </div>

            {/* Reviews */}
            <ReviewsSection skillSlug={skill.slug} authUserId={auth?.userId ?? null} />
          </div>

          <QuickInstallCard slug={skill.slug} repoUrl={skill.repoUrl} auth={!!auth} />
        </div>
      </div>
    </div>
  );
}
