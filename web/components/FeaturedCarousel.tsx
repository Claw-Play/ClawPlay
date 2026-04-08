"use client";

import { useState, useEffect, useCallback } from "react";
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

export function FeaturedCarousel({ skills }: Props) {
  const t = useT("components");
  const tGrid = useT("skills_grid");
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % skills.length);
  }, [skills.length]);

  useEffect(() => {
    if (skills.length <= 1) return;
    const id = setInterval(next, 4000);
    return () => clearInterval(id);
  }, [next, skills.length]);

  if (skills.length === 0) return null;

  const active = skills[current];
  const avgRating =
    active.statsRatingsCount > 0
      ? Number((active.statsStars / active.statsRatingsCount).toFixed(1))
      : null;

  return (
    <div className="space-y-5">
      {/* Main card */}
      <Link
        href={`/skills/${active.slug}`}
        className="block bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow card-shadow-hover transition-all duration-200"
      >
        <div className="flex items-start gap-4">
          <span className="text-5xl flex-shrink-0">{active.iconEmoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-xl font-bold font-heading text-[#564337]">
                {active.name}
              </h3>
              {avgRating !== null && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-[#fa7025]/10 text-[#fa7025] text-xs font-semibold rounded-full font-body">
                  ⭐ {avgRating}
                </span>
              )}
            </div>
            <p className="text-sm text-[#7a6a5a] font-body line-clamp-2">
              {active.summary}
            </p>
            <p className="text-xs text-[#a89888] mt-2 font-body">
              {tGrid("by")} {active.authorName || tGrid("anonymous")}
            </p>
          </div>
        </div>
      </Link>

      {/* Navigation dots + prev/next */}
      <div className="flex items-center justify-between gap-4">
        {/* Dots */}
        <div className="flex gap-2">
          {skills.map((s, i) => (
            <button
              key={s.slug}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all focus:outline-none ${
                i === current
                  ? "bg-[#a23f00] w-5"
                  : "bg-[#d4c8b8] hover:bg-[#a23f00]/50"
              }`}
              aria-label={t("go_to_skill", { i: String(i + 1) })}
            />
          ))}
        </div>

        {/* Prev/Next */}
        {skills.length > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => setCurrent((c) => (c - 1 + skills.length) % skills.length)}
              className="w-8 h-8 rounded-full border border-[#e8dfc8] bg-[#fffdf7] text-[#7a6a5a] hover:text-[#a23f00] hover:border-[#a23f00] transition-all flex items-center justify-center"
              aria-label={t("previous")}
            >
              ‹
            </button>
            <button
              onClick={next}
              className="w-8 h-8 rounded-full border border-[#e8dfc8] bg-[#fffdf7] text-[#7a6a5a] hover:text-[#a23f00] hover:border-[#a23f00] transition-all flex items-center justify-center"
              aria-label={t("next")}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {skills.map((s, i) => (
          <button
            key={s.slug}
            onClick={() => setCurrent(i)}
            className={`flex-shrink-0 w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl transition-all focus:outline-none ${
              i === current
                ? "border-[#a23f00] bg-[#fef0e8] shadow-sm"
                : "border-[#e8dfc8] bg-[#fffdf7] hover:border-[#a23f00]/50"
            }`}
            aria-label={t("select_skill", { name: s.name })}
          >
            {s.iconEmoji}
          </button>
        ))}
      </div>
    </div>
  );
}
