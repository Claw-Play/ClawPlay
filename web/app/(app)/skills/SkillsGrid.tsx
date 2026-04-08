"use client";
import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

interface Skill {
  slug: string;
  name: string;
  summary: string | null;
  authorName: string | null;
  iconEmoji: string | null;
  statsStars: number | null;
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
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#a89888] pointer-events-none">
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
          className="w-full h-16 pl-14 pr-5 rounded-[24px] bg-[#fffdf7]/80 backdrop-blur-md border border-[#e8dfc8] text-[#564337] placeholder-[#a89888] text-sm focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30 focus:border-[#a23f00] transition-all shadow-sm"
        />
      </div>

      {/* Emoji filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveEmoji(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeEmoji === null
              ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0_4px_12px_rgba(162,63,0,0.2)]"
              : "bg-[#fffdf7] border border-[#e8dfc8] text-[#7a6a5a] hover:border-[#a23f00] hover:text-[#a23f00]"
          }`}
        >
          {t("all")}
        </button>
        {allEmojis.map((e) => (
          <button
            key={e}
            onClick={() => setActiveEmoji(e === activeEmoji ? null : e)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeEmoji === e
                ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0_4px_12px_rgba(162,63,0,0.2)]"
                : "bg-[#fffdf7] border border-[#e8dfc8] text-[#7a6a5a] hover:border-[#a23f00] hover:text-[#a23f00]"
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
            className="text-sm text-[#a23f00] hover:underline font-body"
          >
            {t("show_all")}
          </button>
        </div>
      )}

      {/* Skills grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <div className="text-5xl">
            {activeEmoji ?? "🦐"}
          </div>
          <h2 className="text-xl font-semibold text-[#564337]">
            {search ? t("no_results", {search}) : t("no_emoji_filter")}
          </h2>
          <p className="text-[#7a6a5a]">
            {search ? t("try_different") : t("try_first")}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <Link
              key={s.slug}
              href={`/skills/${s.slug}`}
              className="bg-[#fffdf7] card-radius p-5 border border-[#e8dfc8] card-shadow card-shadow-hover transition-all duration-200"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl flex-shrink-0">
                  {s.iconEmoji ?? "🦐"}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#564337] truncate font-heading">
                    {s.name}
                  </h3>
                  <p className="text-xs text-[#a89888] font-body">
                    {t("by")} {s.authorName || t("anonymous")}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[#7a6a5a] line-clamp-2 leading-relaxed font-body">
                {s.summary || t("no_description")}
              </p>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#e8dfc8]">
                <span className="text-xs text-[#a89888] font-body">
                  ⭐ {s.statsStars ?? 0}
                </span>
                {s.createdAt && (
                  <span className="text-xs text-[#a89888] font-body">
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
