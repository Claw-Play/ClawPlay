import Link from "next/link";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getAuthFromCookies } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { FeaturedGrid } from "@/components/FeaturedGrid";
import { StatsSection } from "./components/StatsSection";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { HomeClient } from "./HomeClient";
import { AdminShieldIcon, BoltIcon, GiftIcon, GlobeIcon, ImageIcon, RobotIcon, ShrimpLogoIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getT("home");
  const tCommon = await getT("common");

  // Fetch featured skills: isFeatured first, then statsInstalls + statsStars, top 12
  let featuredSkills: {
    slug: string;
    name: string;
    iconEmoji: string;
    summary: string;
    authorName: string;
    statsStars: number;
    statsRatingsCount: number;
    statsInstalls: number;
  }[] = [];
  try {
    const base = await db
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
    featuredSkills = base;
  } catch {
    // DB not ready yet
  }

  const auth = await getAuthFromCookies();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#fefae0]/90 backdrop-blur-md border-b border-[#e8dfc8]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-4">
          <Link href="/" className="flex items-center gap-2 group min-w-0">
            <ShrimpLogoIcon className="w-6 h-6 text-[#a23f00]" />
            <span className="truncate text-lg sm:text-xl font-bold font-heading text-[#564337] group-hover:text-[#a23f00] transition-colors">
              ClawPlay
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6">
            <Link
              href="/skills"
              className="text-sm font-medium text-[#7a6a5a] hover:text-[#a23f00] transition-colors font-body"
            >
              {tCommon("explore")}
            </Link>
            <div className="h-5 w-px bg-[#e8dfc8]" />
            <LanguageSwitcher />
            {auth ? (
              <Link
                href="/dashboard"
                className="px-5 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
              >
                {tCommon("dashboard")}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
                >
                  {tCommon("login")}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero — compact single slogan */}
      <section className="relative py-12 md:py-16 px-4 sm:px-6 overflow-hidden" style={{ background: "#fefae0" }}>
        {/* Subtle grain texture */}
        <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold font-heading text-[#564337] leading-[1.08] tracking-tight">
            {t("hero_title")}{" "}
            <span className="bg-gradient-to-r from-[#a23f00] to-[#fa7025] bg-clip-text text-transparent">{t("hero_title_accent")}</span>
          </h1>
          <p className="text-lg md:text-xl text-[#7a6a5a] max-w-2xl mx-auto leading-relaxed font-body">
            {t("hero_subtitle")}
          </p>
        </div>
      </section>

      {/* Stats */}
      <StatsSection />

      {/* One-click CLI install */}
      <HomeClient />

      {/* Featured Skills — grid layout */}
      {featuredSkills.length > 0 && (
        <FeaturedGrid skills={featuredSkills} />
      )}

      {/* Features */}
      <section className="py-16 md:py-20 px-4 sm:px-6" style={{ background: "#fefae0" }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-[#564337] mb-8 text-center">
            {t("features_title")}
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[
              { icon: ImageIcon, title: t("feature_1_title"), desc: t("feature_1_desc") },
              { icon: AdminShieldIcon, title: t("feature_2_title"), desc: t("feature_2_desc") },
              { icon: GiftIcon, title: t("feature_3_title"), desc: t("feature_3_desc") },
              { icon: RobotIcon, title: t("feature_4_title"), desc: t("feature_4_desc") },
              { icon: BoltIcon, title: t("feature_5_title"), desc: t("feature_5_desc") },
              { icon: GlobeIcon, title: t("feature_6_title"), desc: t("feature_6_desc") },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-[#fffdf7] rounded-2xl p-5 md:p-6 border border-[#e8dfc8] space-y-2"
              >
                <f.icon className="w-6 h-6 text-[#a23f00]" />
                <h3 className="font-semibold font-heading text-[#564337] text-base">{f.title}</h3>
                <p className="text-sm text-[#7a6a5a] leading-relaxed font-body">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 sm:px-6" style={{ background: "#fefae0" }}>
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-[#564337]">
            {t("cta_ready")}
          </h2>
          <p className="text-base text-[#7a6a5a] font-body">
            {t("cta_desc")}
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white font-semibold btn-pill shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
          >
            {t("cta_create")}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e8dfc8] py-12 px-4 sm:px-6" style={{ background: "#fefae0" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mb-10">
            {/* Brand — left column */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <ShrimpLogoIcon className="w-5 h-5 text-[#a23f00]" />
                <span className="text-base font-bold font-heading text-[#564337]">ClawPlay</span>
              </div>
              <p className="text-sm text-[#7a6a5a] font-body leading-relaxed max-w-md">
                {t("footer_brand")}
              </p>
            </div>

            {/* Right columns — grouped and pushed right */}
            <div className="md:col-span-3 md:ml-auto flex gap-20 md:gap-40">
              {/* About */}
              <div className="flex-1 min-w-0 space-y-3">
                <h4 className="text-xs font-semibold font-heading text-[#564337] uppercase tracking-wider">{t("footer_about_title")}</h4>
                <ul className="space-y-2">
                  {[
                    { label: t("footer_about"), href: "/about" },
                    { label: t("footer_docs"), href: "/docs" },
                    { label: t("footer_blog"), href: "/blog" },
                    { label: t("footer_careers"), href: "/careers" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-[#7a6a5a] hover:text-[#a23f00] transition-colors font-body whitespace-nowrap">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Resources */}
              <div className="flex-1 min-w-0 space-y-3">
                <h4 className="text-xs font-semibold font-heading text-[#564337] uppercase tracking-wider whitespace-nowrap">{t("footer_resources_title")}</h4>
                <ul className="space-y-2">
                  {[
                    { label: t("footer_skill_guide"), href: "/docs/skill-authoring" },
                    { label: t("footer_cli_ref"), href: "/docs/cli" },
                    { label: t("footer_api"), href: "/docs/api" },
                    { label: t("footer_community"), href: "/community" },
                  ].map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-[#7a6a5a] hover:text-[#a23f00] transition-colors font-body whitespace-nowrap">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact */}
              <div className="flex-1 min-w-0 space-y-3">
                <h4 className="text-xs font-semibold font-heading text-[#564337] uppercase tracking-wider">{t("footer_contact_title")}</h4>
                <ul className="space-y-2">
                  {[
                    { label: t("footer_contact_github"), href: "https://github.com/Claw-Play/ClawPlay" },
                    { label: t("footer_contact_mail"), href: "mailto:clawplay-team@googlegroups.com" },
                  ].map((s) => (
                    <li key={s.label}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-[#7a6a5a] hover:text-[#a23f00] transition-colors font-body"
                      >
                        <span>{s.label === t("footer_contact_github") ? "⌨️" : "✉️"}</span>
                        <span>{s.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-[#e8dfc8] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#a89888] font-body">
              {t("copyright")} {new Date().getFullYear()} ClawPlay。
            </p>
            <div className="flex gap-5">
              <Link href="/terms" className="text-xs text-[#a89888] hover:text-[#a23f00] transition-colors font-body">{t("terms")}</Link>
              <Link href="/privacy" className="text-xs text-[#a89888] hover:text-[#a23f00] transition-colors font-body">{t("privacy")}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
