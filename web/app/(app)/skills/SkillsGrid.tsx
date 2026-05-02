"use client";
import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import { formatAverageRating } from "@/lib/ratings";

interface Skill {
  slug: string;
  name: string;
  summary: string | null;
  authorName: string | null;
  iconEmoji: string | null;
  statsStars: number | null;
  statsRatingsCount: number | null;
  createdAt: Date | null;
}

interface SkillsGridProps {
  initialSkills: Skill[];
  allEmojis: string[];
}

export function SkillsGrid({ initialSkills, allEmojis }: SkillsGridProps) {
  const t = useT("skills_grid");
  const [activeEmoji, setActiveEmoji] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = initialSkills.filter((s) => {
    const matchesEmoji = !activeEmoji || s.iconEmoji === activeEmoji;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.summary ?? "").toLowerCase().includes(q) ||
      (s.authorName ?? "").toLowerCase().includes(q);
    return matchesEmoji && matchesSearch;
  });

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-6">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#6d7891] pointer-events-none">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <input
          type="text"
          placeholder={t("search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-14 sm:h-16 pl-14 pr-5 rounded-[24px] bg-[#ffffff]/80 backdrop-blur-md border border-[#dbe5f7] text-[#1f2b45] placeholder-[#6d7891] text-sm focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/30 focus:border-[#2d67f7] transition-all shadow-sm"
        />
      </div>

      {/* Emoji filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveEmoji(null)}
          className={`min-h-11 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeEmoji === null
              ? "bg-gradient-to-r from-[#2d67f7] to-[#4f82f7] text-white shadow-[0_4px_12px_rgba(45,103,247,0.2)]"
              : "bg-[#ffffff] border border-[#dbe5f7] text-[#52617d] hover:border-[#2d67f7] hover:text-[#2d67f7]"
          }`}
        >
          {t("all")}
        </button>
        {allEmojis.map((e) => (
          <button
            key={e}
            onClick={() => setActiveEmoji(e === activeEmoji ? null : e)}
            className={`min-h-11 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeEmoji === e
                ? "bg-gradient-to-r from-[#2d67f7] to-[#4f82f7] text-white shadow-[0_4px_12px_rgba(45,103,247,0.2)]"
                : "bg-[#ffffff] border border-[#dbe5f7] text-[#52617d] hover:border-[#2d67f7] hover:text-[#2d67f7]"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Active filter indicator */}
      {(search || activeEmoji) && (
        <div className="flex justify-end mt-3">
          <button
            onClick={() => { setActiveEmoji(null); setSearch(""); }}
            className="text-sm text-[#2d67f7] hover:underline font-body"
          >
            {t("show_all")}
          </button>
        </div>
      )}

      {/* Skills grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 sm:py-20 space-y-4">
          <div className="text-5xl">
            {activeEmoji ?? "🦐"}
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-[#1f2b45]">
            {search ? t("no_results", {search}) : t("no_emoji_filter")}
          </h2>
          <p className="text-[#52617d]">
            {search ? t("try_different") : t("try_first")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((s) => (
            <Link
              key={s.slug}
              href={`/skills/${s.slug}`}
              className="bg-[#ffffff] card-radius p-5 border border-[#dbe5f7] card-shadow card-shadow-hover transition-all duration-200"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#1f2b45] truncate font-heading">
                    {s.name}
                  </h3>
                  <p className="text-xs text-[#6d7891] font-body">
                    {t("by")} {s.authorName || t("anonymous")}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[#52617d] line-clamp-2 leading-relaxed font-body">
                {s.summary || t("no_description")}
              </p>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#dbe5f7]">
                <span className="text-xs text-[#6d7891] font-body">
                  ⭐ {formatAverageRating(s.statsStars, s.statsRatingsCount)}
                </span>
                {s.createdAt && (
                  <span className="text-xs text-[#6d7891] font-body">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
