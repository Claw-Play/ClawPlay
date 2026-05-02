import Link from "next/link";
import { and, desc, isNull, eq } from "drizzle-orm";
import { db, raw } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { getT } from "@/lib/i18n";
import { formatAverageRating } from "@/lib/ratings";
import {
  ArrowRightIcon,
  ShrimpLogoIcon,
  StarIcon,
} from "@/components/icons";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import HomeHeaderAuth from "@/components/HomeHeaderAuth";
import { CenteredNavLinks } from "@/components/CenteredNavLinks";
import { HomeClient } from "./HomeClient";

export const dynamic = "force-dynamic";

type FeaturedSkill = {
  slug: string;
  name: string;
  iconEmoji: string;
  summary: string;
  authorName: string;
  statsStars: number;
  statsRatingsCount: number;
  statsInstalls: number;
};

type HomeStats = {
  installs: number;
  creators: number;
  skills: number;
  activeThisWeek: number;
};

function formatCompactNumber(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1).replace(/\.0$/, "")}w`;
  }
  return value.toLocaleString("zh-CN");
}

function StatCell({
  value,
  label,
  unit,
  highlight = false,
}: {
  value: number;
  label: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-4 text-center">
      <div className="flex items-baseline gap-1">
        <span
          className={[
            "text-[clamp(1.75rem,2.4vw,2.25rem)] font-semibold leading-none tracking-tight",
            highlight ? "text-[#2d67f7]" : "text-[#26314d]",
          ].join(" ")}
        >
          {formatCompactNumber(value)}
        </span>
        <span className="text-[11px] font-medium text-[#7c879f]">{unit}</span>
      </div>
      <p className="mt-1 text-[11px] font-medium text-[#6e7890]">{label}</p>
    </div>
  );
}

function SkillCard({ skill, index }: { skill: FeaturedSkill; index: number }) {
  return (
    <article className="group rounded-[20px] border border-[#e4e8f2] bg-white/95 p-4 shadow-[0_8px_24px_rgba(22,38,77,0.04)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(22,38,77,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2f6ff] text-lg shadow-[0_4px_10px_rgba(45,103,247,0.08)]">
            {skill.iconEmoji || "✦"}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-[#1f2b45]">
              {skill.name}
            </h3>
            <p className="text-[12px] text-[#8791a7]">#{index + 1}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#d9e2fb] bg-[#f7faff] px-2.5 py-1 text-[11px] font-medium text-[#7380a3]">
            <span className="text-[#9aa4be]">◔</span>
            {formatCompactNumber(skill.statsInstalls)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf1ff] px-2.5 py-1 text-[11px] font-semibold text-[#2d67f7]">
            <StarIcon className="h-3.5 w-3.5" />
            {formatAverageRating(skill.statsStars, skill.statsRatingsCount)}
          </span>
        </div>
      </div>
      <p className="min-h-[40px] text-[13px] leading-6 text-[#68758f]">
        {skill.summary || "A useful skill for ClawPlay."}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-[#edf1f7] pt-3">
        <span className="text-[12px] text-[#97a1b7]">作者：{skill.authorName || "ClawPlay"}</span>
        <Link
          href={`/skills/${skill.slug}`}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2d67f7] transition-colors hover:text-[#1f54d4]"
        >
          详情 <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

async function loadStats(): Promise<HomeStats> {
  const stats: HomeStats = {
    installs: 0,
    creators: 0,
    skills: 0,
    activeThisWeek: 0,
  };

  try {
    const [installsRows, creatorsRows, skillsRows, activeRows] = await Promise.all([
      Promise.resolve(raw(`SELECT COALESCE(SUM(stats_installs), 0) as total FROM skills WHERE moderation_status = 'approved' AND deleted_at IS NULL`)),
      Promise.resolve(raw(`SELECT COUNT(*) as total FROM users`)),
      Promise.resolve(raw(`SELECT COUNT(*) as total FROM skills WHERE moderation_status = 'approved' AND deleted_at IS NULL`)),
      Promise.resolve(
        raw(
          `SELECT COUNT(DISTINCT user_id) as total FROM event_logs WHERE user_id IS NOT NULL AND created_at >= ?`,
          [Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60]
        )
      ),
    ]);

    stats.installs = Number((installsRows as { total: number }[])[0]?.total ?? 0);
    stats.creators = Number((creatorsRows as { total: number }[])[0]?.total ?? 0);
    stats.skills = Number((skillsRows as { total: number }[])[0]?.total ?? 0);
    stats.activeThisWeek = Number((activeRows as { total: number }[])[0]?.total ?? 0);
  } catch {
    // Render the shell even when the database is unavailable.
  }

  return stats;
}

async function loadFeaturedSkills(): Promise<FeaturedSkill[]> {
  try {
    return await db
      .select({
        slug: skills.slug,
        name: skills.name,
        iconEmoji: skills.iconEmoji,
        summary: skills.summary,
        authorName: skills.authorName,
        statsStars: skills.statsStars,
        statsRatingsCount: skills.statsRatingsCount,
        statsInstalls: skills.statsInstalls,
      })
      .from(skills)
      .where(and(eq(skills.moderationStatus, "approved"), isNull(skills.deletedAt)))
      .orderBy(desc(skills.statsInstalls), desc(skills.statsStars))
      .limit(12);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const t = await getT("home");
  const tNav = await getT("nav");
  const stats = await loadStats();
  const featuredSkills = await loadFeaturedSkills();

  const skillsForDisplay =
    featuredSkills.length > 0
      ? featuredSkills
      : [
          {
            slug: "avatar-studio",
            name: "Avatar Studio",
            iconEmoji: "🧑‍🎨",
            summary: "Create beautiful avatar studio with AI.",
            authorName: "Aivisli",
            statsStars: 4.1,
            statsRatingsCount: 128,
            statsInstalls: 1200,
          },
          {
            slug: "meme-generator",
            name: "Meme Generator",
            iconEmoji: "🤣",
            summary: "Create beautiful meme generator with AI.",
            authorName: "FunMaker",
            statsStars: 4.6,
            statsRatingsCount: 876,
            statsInstalls: 876,
          },
          {
            slug: "pixel-art-creator",
            name: "Pixel Art Creator",
            iconEmoji: "🧩",
            summary: "Create beautiful pixel art creator with AI.",
            authorName: "MemeWizard",
            statsStars: 4.8,
            statsRatingsCount: 543,
            statsInstalls: 543,
          },
          {
            slug: "gif-maker",
            name: "GIF Maker",
            iconEmoji: "🎞️",
            summary: "Create beautiful gif maker with AI.",
            authorName: "FunMaker",
            statsStars: 4.3,
            statsRatingsCount: 321,
            statsInstalls: 321,
          },
          {
            slug: "profile-frame",
            name: "Profile Frame",
            iconEmoji: "🖼️",
            summary: "Create beautiful profile frame with AI.",
            authorName: "CreativeBot",
            statsStars: 4.2,
            statsRatingsCount: 209,
            statsInstalls: 209,
          },
          {
            slug: "quote-card",
            name: "Quote Card",
            iconEmoji: "💬",
            summary: "Create beautiful quote card with AI.",
            authorName: "ShrimpMaster",
            statsStars: 4.1,
            statsRatingsCount: 187,
            statsInstalls: 187,
          },
          {
            slug: "code-review",
            name: "Code Review",
            iconEmoji: "1.0",
            summary: "A useful skill for code review",
            authorName: "Grace Zhou",
            statsStars: 4.0,
            statsRatingsCount: 160,
            statsInstalls: 160,
          },
          {
            slug: "image-upscale",
            name: "Image Upscale",
            iconEmoji: "0.0",
            summary: "A useful skill for image upscale",
            authorName: "David Chen",
            statsStars: 4.0,
            statsRatingsCount: 143,
            statsInstalls: 143,
          },
          {
            slug: "doc-generator",
            name: "文档生成器",
            iconEmoji: "📝",
            summary: "根据代码自动生成 API 文档和技术说明",
            authorName: "王五",
            statsStars: 4.0,
            statsRatingsCount: 132,
            statsInstalls: 132,
          },
          {
            slug: "translate-zh",
            name: "Translate Zh",
            iconEmoji: "0.0",
            summary: "A useful skill for translate zh",
            authorName: "Henry Sun",
            statsStars: 4.0,
            statsRatingsCount: 121,
            statsInstalls: 121,
          },
          {
            slug: "voice-clone",
            name: "Voice Clone",
            iconEmoji: "1.0",
            summary: "A useful skill for voice clone",
            authorName: "David Chen",
            statsStars: 4.0,
            statsRatingsCount: 112,
            statsInstalls: 112,
          },
          {
            slug: "diy-crafts",
            name: "Diy Crafts",
            iconEmoji: "1.0",
            summary: "A useful skill for diy crafts",
            authorName: "Henry Sun",
            statsStars: 4.0,
            statsRatingsCount: 98,
            statsInstalls: 98,
          },
        ];

  return (
    <main className="min-h-screen bg-[#f3f7ff] text-[#1f2b45]">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(45,103,247,0.11)_0%,rgba(45,103,247,0.04)_34%,transparent_72%)] blur-3xl" />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98)_0%,rgba(241,246,255,0.95)_34%,rgba(236,242,255,0.9)_100%)]" />
        <header className="sticky top-0 z-50 border-b border-white/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <div className="relative flex h-16 items-center sm:h-[72px]">
              <Link href="/" className="flex items-center gap-3">
                <ShrimpLogoIcon className="h-14 w-14" />
                <span className="text-[22px] font-bold tracking-tight text-[#1f2b45]">
                  ClawPlay
                </span>
              </Link>

              <div className="pointer-events-none absolute inset-x-0 hidden justify-center md:flex">
                <div className="pointer-events-auto">
                  <CenteredNavLinks
                    items={[
                      { href: "/#hot-skills", label: tNav("hot") },
                      { href: "/skills", label: tNav("skill_lib") },
                      { href: "/community", label: tNav("community") },
                    ]}
                  />
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <LanguageSwitcher variant="home" />
                <div className="hidden h-6 w-px bg-[#dbe5f7] md:block" />
                <HomeHeaderAuth />
              </div>
            </div>
          </div>
        </header>

        <section className="relative mx-auto max-w-[1240px] px-4 pb-10 pt-10 text-center sm:px-6 sm:pb-12 sm:pt-14 lg:px-8 lg:pb-14 lg:pt-16">
          <div className="mx-auto max-w-[760px]">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.26em] text-[#5c77c8]">
              {t("hero_badge")}
            </p>
            <h1 className="text-[clamp(2.9rem,5.6vw,4.7rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#15213b]">
              {t("hero_title")}{" "}
              <span className="text-[#2d67f7]">{t("hero_title_accent")}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-8 text-[#6d7891] sm:text-[16px]">
              {t("hero_subtitle")}
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-[780px]">
            <div className="overflow-hidden rounded-[22px] border border-[#dfe6f4] bg-[#edf3ff] shadow-[0_18px_50px_rgba(25,43,87,0.08)] backdrop-blur-sm">
              <div className="grid grid-cols-1 divide-y divide-[#e8eef8] md:grid-cols-4 md:divide-y-0 md:divide-x">
                <StatCell value={stats.installs} label={t("stats_installs")} unit={t("stats_installs_unit")} />
                <StatCell value={stats.creators} label={t("stats_creators")} unit={t("stats_creators_unit")} />
                <StatCell value={stats.skills} label={t("stats_skills")} unit={t("stats_skills_unit")} />
                <StatCell
                  value={stats.activeThisWeek}
                  label={t("stats_active")}
                  unit={t("stats_active_unit")}
                  highlight
                />
              </div>
            </div>
          </div>

          <div className="mx-auto mt-7 max-w-[620px]">
            <HomeClient />
          </div>
        </section>

        <section
          id="hot-skills"
          className="relative mx-auto max-w-[1240px] scroll-mt-20 px-4 pb-10 sm:px-6 lg:px-8"
        >
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#5c77c8]">
                {t("featured_label")}
              </p>
              <h2 className="mt-2 text-[clamp(1.7rem,3vw,2.45rem)] font-semibold tracking-[-0.04em] text-[#15213b]">
                {t("featured_title")}
              </h2>
            </div>
            <Link
              href="/skills"
              className="hidden items-center gap-1 text-[13px] font-semibold text-[#2d67f7] transition-colors hover:text-[#1f54d4] sm:inline-flex"
            >
              {t("see_all")}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {skillsForDisplay.slice(0, 12).map((skill, index) => (
              <SkillCard key={skill.slug} skill={skill} index={index} />
            ))}
          </div>

          <div className="mt-5 flex justify-end sm:hidden">
            <Link
              href="/skills"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2d67f7]"
            >
              {t("see_all")}
            </Link>
          </div>
        </section>
      </div>

      <section className="relative mx-auto max-w-[1240px] px-4 pb-14 pt-2 text-center sm:px-6 lg:px-8 lg:pb-16">
          <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.04em] text-[#15213b]">
            {t("cta_ready")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-[#6d7891]">
            {t("cta_desc")}
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-[#2d67f7] px-6 text-[14px] font-semibold text-white shadow-[0_12px_28px_rgba(45,103,247,0.24)] transition-transform hover:-translate-y-0.5 hover:bg-[#2457d4]"
          >
            {t("cta_create")}
          </Link>
        </section>

        <footer className="border-t border-[#cfdcf3] bg-[#f8fbff]">
          <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
            <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <ShrimpLogoIcon className="h-14 w-14" />
                  <span className="text-[22px] font-bold text-[#1f2b45]">ClawPlay</span>
                </div>
                <p className="max-w-md text-[13px] leading-7 text-[#34435f]">
                  {t("footer_brand")}
                </p>
                <p className="text-[12px] text-[#4d5d82]">
                  {t("copyright")} {new Date().getFullYear()} ClawPlay.
                </p>
              </div>

              <div>
                <h3 className="text-[13px] font-semibold text-[#1f2b45]">{t("footer_about_title")}</h3>
                <ul className="mt-4 space-y-3 text-[13px] text-[#34435f]">
                  <li><Link className="transition-colors hover:text-[#2d67f7]" href="/about">{t("footer_about")}</Link></li>
                  <li><Link className="transition-colors hover:text-[#2d67f7]" href="/docs">{t("footer_docs")}</Link></li>
                  <li><Link className="transition-colors hover:text-[#2d67f7]" href="/blog">{t("footer_blog")}</Link></li>
                  <li><Link className="transition-colors hover:text-[#2d67f7]" href="/careers">{t("footer_careers")}</Link></li>
                </ul>
              </div>

              <div>
                <h3 className="text-[13px] font-semibold text-[#1f2b45]">{t("footer_resources_title")}</h3>
                <ul className="mt-4 space-y-3 text-[13px] text-[#34435f]">
                  <li><Link className="transition-colors hover:text-[#2d67f7]" href="/docs/skill-authoring">{t("footer_skill_guide")}</Link></li>
                  <li><Link className="transition-colors hover:text-[#2d67f7]" href="/docs/cli">{t("footer_cli_ref")}</Link></li>
                  <li><Link className="transition-colors hover:text-[#2d67f7]" href="/docs/api">{t("footer_api")}</Link></li>
                  <li><Link className="transition-colors hover:text-[#2d67f7]" href="/community">{t("footer_community")}</Link></li>
                </ul>
              </div>

              <div>
                <h3 className="text-[13px] font-semibold text-[#1f2b45]">{t("footer_contact_title")}</h3>
                <ul className="mt-4 space-y-3 text-[13px] text-[#34435f]">
                  <li>
                    <a className="transition-colors hover:text-[#2d67f7]" href="https://github.com/Claw-Play/ClawPlay" target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  </li>
                  <li>
                    <a className="transition-colors hover:text-[#2d67f7]" href="mailto:clawplay-team@googlegroups.com">
                      Mail
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3 border-t border-[#cfdcf3] pt-5 text-[12px] text-[#4d5d82] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-5">
                <Link className="transition-colors hover:text-[#2d67f7]" href="/terms">
                  {t("terms")}
                </Link>
                <Link className="transition-colors hover:text-[#2d67f7]" href="/privacy">
                  {t("privacy")}
                </Link>
              </div>
            </div>
          </div>
        </footer>
    </main>
  );
}
