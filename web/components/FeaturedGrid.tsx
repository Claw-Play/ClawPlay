"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import { formatAverageRating } from "@/lib/ratings";

interface Skill {
  slug: string;
  name: string;
  iconEmoji: string;
  summary: string;
  authorName: string;
  statsStars: number;
  statsRatingsCount: number;
  statsInstalls: number;
}

interface Props {
  skills: Skill[];
}

function SkillCard({ skill }: { skill: Skill }) {
  const tGrid = useT("skills_grid");
  const avgRating = skill.statsRatingsCount > 0
    ? formatAverageRating(skill.statsStars, skill.statsRatingsCount)
    : null;

  const installs = skill.statsInstalls > 0
    ? skill.statsInstalls >= 1000
      ? `${(skill.statsInstalls / 1000).toFixed(1)}k`
      : String(skill.statsInstalls)
    : null;

  return (
    <Link
      href={`/skills/${skill.slug}`}
      className="group flex flex-col gap-2 bg-[#ffffff] rounded-2xl p-4 border border-[#dbe5f7] hover:border-[#2d67f7]/40 hover:shadow-[0_4px_20px_rgba(45,103,247,0.1)] transition-all duration-200"
    >
      {/* Emoji icon */}
      <div className="flex items-start justify-between">
        <span className="text-2xl leading-none">{skill.iconEmoji}</span>
        <div className="flex items-center gap-1.5">
          {installs !== null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#52617d] bg-[#dbe5f7] px-1.5 py-0.5 rounded-full">
              ⬇ {installs}
            </span>
          )}
          {avgRating !== null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#4f82f7] bg-[#4f82f7]/10 px-1.5 py-0.5 rounded-full">
              ★ {avgRating}
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <h3 className="text-sm font-bold font-heading text-[#1f2b45] leading-snug group-hover:text-[#2d67f7] transition-colors line-clamp-1">
        {skill.name}
      </h3>

      {/* Summary */}
      <p className="text-xs text-[#52617d] font-body leading-relaxed line-clamp-2 flex-1">
        {skill.summary || tGrid("no_description")}
      </p>

      {/* Author */}
      <p className="text-[10px] text-[#6d7891] font-body mt-auto">
        {tGrid("by")} {skill.authorName || tGrid("anonymous")}
      </p>
    </Link>
  );
}

export function FeaturedGrid({ skills }: Props) {
  const t = useT("home");

  if (skills.length === 0) return null;

  return (
    <section id="featured-skills" className="py-16 md:py-20 px-6" style={{ background: "#f8faff" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs font-semibold font-heading text-[#4f82f7] uppercase tracking-wider mb-1 block">
              {t("featured_label")}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold font-heading text-[#1f2b45]">
              {t("featured_title")}
            </h2>
          </div>
          <Link
            href="/skills"
            className="text-sm font-medium text-[#2d67f7] hover:text-[#2457d4] transition-colors font-body"
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
      </div>
    </section>
  );
}
