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
  statsRatingsCount: number | null;
  createdAt: Date | null;
}

interface SkillsClientProps {
  initialSkills: Skill[];
  initialSort?: string;
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

export function SkillsClient({ initialSkills, initialSort = "" }: SkillsClientProps) {
  const t = useT("skills");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const categories = [
    { label: t("category_all"), emoji: "✨", filter: "" },
    { label: t("category_art"), emoji: "💝", filter: "💝" },
    { label: t("category_write"), emoji: "✨", filter: "✨" },
    { label: t("category_game"), emoji: "🎭", filter: "🎭" },
    { label: t("category_tool"), emoji: "🔮", filter: "🔮" },
    { label: t("category_health"), emoji: "🎉", filter: "🎉" },
    { label: t("category_extra"), emoji: "🎮", filter: "🎮" },
  ];

  const filtered = initialSkills
    .filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.summary ?? "").toLowerCase().includes(q) ||
        (s.authorName ?? "").toLowerCase().includes(q);
      const matchesCategory =
        !activeCategory || s.iconEmoji === activeCategory;
      return matchesSearch && matchesCategory;
    });

  function copyInstall(slug: string) {
    const cmd = `clawplay install ${slug}`;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-[#fefae0] flex flex-col">
      {/* Main content — centered, max-w-[1280px] */}
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-6 pb-20">
        {/* Hero Header */}
        <div className="text-center pt-16 pb-8">
          <h1 className="text-6xl md:text-7xl font-extrabold font-heading text-[#1d1c0d] tracking-tight leading-[1.05] mb-4">
            {t("title")}
          </h1>
          <p className="text-lg text-[#564337] font-body max-w-2xl mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Search Bar — centered, max-w-[672px] */}
        <div className="relative max-w-[672px] mx-auto mb-6">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[rgba(86,67,55,0.6)] pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder={t("search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-14 pl-16 pr-6 rounded-2xl bg-[#ede9cf] border-2 border-transparent text-[#564337] placeholder-[rgba(86,67,55,0.6)] text-base font-body focus:outline-none focus:border-[#a23f00] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          />
        </div>

        {/* Category Filters — centered row */}
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          {categories.map(({ label, emoji, filter }) => (
            <button
              key={filter}
              onClick={() => setActiveCategory(filter)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-base font-semibold font-body transition-all ${
                activeCategory === filter
                  ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0_6px_20px_rgba(162,63,0,0.25)]"
                  : "bg-[#ede9cf] text-[#586330] hover:bg-[#ddd8b8]"
              }`}
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Skills Grid — 4 columns */}
        {filtered.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="text-6xl">{activeCategory || "🦐"}</div>
            <h2 className="text-2xl font-bold text-[#564337] font-heading">
              {search ? t("no_results", { query: search }) : t("no_category")}
            </h2>
            <p className="text-[#7a6a5a] font-body">
              {search ? t("try_different") : t("be_first")}
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="mt-2 px-6 py-2 rounded-full bg-[#ede9cf] text-[#5c6834] text-sm font-semibold font-body hover:bg-[#ddd8b8] transition-all"
              >
                {t("clear_search")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((s) => (
              <SkillCard
                key={s.slug}
                skill={s}
                copied={copiedSlug === s.slug}
                onCopy={() => copyInstall(s.slug)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  copied,
  onCopy,
}: {
  skill: Skill;
  copied: boolean;
  onCopy: () => void;
}) {
  const t = useT("skills");
  const tCommon = useT("common");
  const installCmd = `clawplay install ${skill.slug}`;
  const stars = skill.statsRatingsCount ? (skill.statsStars ?? 0) / skill.statsRatingsCount : 0;

  return (
    <div className="bg-white rounded-[48px] shadow-[0_8px_24px_rgba(86,67,55,0.06)] overflow-hidden flex flex-col">
      {/* Card body — clickable link */}
      <Link href={`/skills/${skill.slug}`} className="p-8 flex flex-col flex-1 gap-3 hover:opacity-80 transition-opacity">
        {/* Skill name */}
        <h3 className="text-xl font-bold font-heading text-[#1d1c0d] leading-snug">
          {skill.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-[#564337] font-body leading-relaxed line-clamp-3 flex-1">
          {skill.summary || tCommon("no_description")}
        </p>

        {/* Author + stats */}
        <div className="flex items-center justify-between pt-3 border-t border-[rgba(220,193,177,0.2)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#ede9cf] flex items-center justify-center text-xs font-bold font-heading text-[#586330] overflow-hidden">
              {skill.authorName ? skill.authorName[0].toUpperCase() : "?"}
            </div>
            <span className="text-xs text-[#564337] font-body truncate max-w-[100px]">
              {skill.authorName || tCommon("anonymous")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[rgba(86,67,55,0.8)] font-body">
              ⭐ {stars.toFixed(1)}
            </span>
          </div>
        </div>
      </Link>

      {/* Install command bar */}
      <div className="mx-6 mb-6">
        <div className="bg-[#586330] rounded-[32px] px-4 py-2.5 flex items-center justify-between gap-2">
          <code className="text-xs font-mono-custom text-[#fefae0] truncate flex-1">
            {installCmd}
          </code>
          <button
            onClick={onCopy}
            className="flex-shrink-0 text-[#fefae0] hover:text-white transition-colors"
            title={t("copy_command")}
          >
            {copied ? (
              <span className="text-xs font-bold">{t("skill_copied")}</span>
            ) : (
              <CopyIcon />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
