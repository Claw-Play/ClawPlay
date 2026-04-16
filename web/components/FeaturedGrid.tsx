"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/context";

interface Skill {
  slug: string;
  name: string;
  iconEmoji: string;
  summary: string;
  authorName: string;
  statsStars: number;
  statsRatingsCount: number;
}

interface Props {
  skills: Skill[];
}

function SkillCard({ skill }: { skill: Skill }) {
  const tGrid = useT("skills_grid");
  const avgRating =
    skill.statsRatingsCount > 0
      ? Number((skill.statsStars / skill.statsRatingsCount).toFixed(1))
      : null;

  return (
    <Link
      href={`/skills/${skill.slug}`}
      className="group flex flex-col gap-2 bg-[#fffdf7] rounded-2xl p-4 border border-[#e8dfc8] hover:border-[#a23f00]/40 hover:shadow-[0_4px_20px_rgba(162,63,0,0.1)] transition-all duration-200"
    >
      {/* Emoji icon */}
      <div className="flex items-start justify-between">
        <span className="text-2xl leading-none">{skill.iconEmoji}</span>
        {avgRating !== null && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#fa7025] bg-[#fa7025]/10 px-1.5 py-0.5 rounded-full">
            ★ {avgRating}
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="text-sm font-bold font-heading text-[#564337] leading-snug group-hover:text-[#a23f00] transition-colors line-clamp-1">
        {skill.name}
      </h3>

      {/* Summary */}
      <p className="text-xs text-[#7a6a5a] font-body leading-relaxed line-clamp-2 flex-1">
        {skill.summary || tGrid("no_description")}
      </p>

      {/* Author */}
      <p className="text-[10px] text-[#a89888] font-body mt-auto">
        {tGrid("by")} {skill.authorName || tGrid("anonymous")}
      </p>
    </Link>
  );
}

export function FeaturedGrid({ skills }: Props) {
  const t = useT("home");

  if (skills.length === 0) return null;

  return (
    <section id="featured-skills" className="py-16 md:py-20 px-6" style={{ background: "#fefae0" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs font-semibold font-heading text-[#fa7025] uppercase tracking-wider mb-1 block">
              {t("featured_label")}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold font-heading text-[#564337]">
              {t("featured_title")}
            </h2>
          </div>
          <Link
            href="/skills"
            className="text-sm font-medium text-[#a23f00] hover:text-[#c45000] transition-colors font-body"
          >
            {t("see_all")}
          </Link>
        </div>

        {/* Skill grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {skills.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} />
          ))}
        </div>

        {/* Load more */}
        {skills.length >= 8 && (
          <div className="mt-8 text-center">
            <Link
              href="/skills"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#a23f00] hover:text-[#c45000] transition-colors font-body"
            >
              {t("see_all")}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
