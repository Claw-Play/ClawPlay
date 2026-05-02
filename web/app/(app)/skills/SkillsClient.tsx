"use client";
import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import { formatAverageRating } from "@/lib/ratings";
import { CopyIcon, SearchIcon, StarIcon } from "@/components/icons";

interface Skill {
  slug: string;
  name: string;
  summary: string | null;
  authorName: string | null;
  iconEmoji: string | null;
  statsStars: number | null;
  statsRatingsCount: number | null;
  statsInstalls: number | null;
  createdAt: Date | null;
}

interface SkillsClientProps {
  initialSkills: Skill[];
  initialSort?: string;
}

export function SkillsClient({ initialSkills, initialSort: _initialSort }: SkillsClientProps) {
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
    <div className="min-h-screen bg-[#fbfdff] flex flex-col">
      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 pb-14 sm:pb-16">
        <div className="pt-9 sm:pt-[42px] pb-6 text-center">
          <h1 className="text-[40px] sm:text-[44px] font-semibold font-heading text-[#15213b] tracking-[-0.025em] leading-[1.08] mb-3 break-words">
            {t("title")}
          </h1>
          <p className="text-[14px] text-[#52617d] font-body max-w-3xl mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <div className="relative mx-auto mb-5 w-full max-w-[760px]">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6d7891] pointer-events-none">
            <SearchIcon className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder={t("search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-11 pr-5 rounded-[9px] bg-white border border-[#cfdcf3] text-[#15213b] placeholder:text-[#7c879f] text-[13px] font-body focus:outline-none focus:border-[#2d67f7] focus:ring-2 focus:ring-[#2d67f7]/10 transition-all shadow-[0_6px_16px_rgba(25,43,87,0.025)]"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {categories.map(({ label, emoji, filter }) => (
            <button
              key={filter}
              onClick={() => setActiveCategory(filter)}
              className={`flex min-h-8 items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-semibold font-body transition-all ${
                activeCategory === filter
                  ? "bg-[#2d67f7] text-white shadow-[0_8px_18px_rgba(45,103,247,0.2)]"
                  : "bg-white text-[#52617d] border border-[#dbe5f7] hover:border-[#bfd0f4] hover:bg-[#f7faff]"
              }`}
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 sm:py-24 space-y-4">
            <div className="text-5xl">{activeCategory || "✨"}</div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#15213b] font-heading">
              {search ? t("no_results", { query: search }) : t("no_category")}
            </h2>
            <p className="text-[#6d7891] font-body">
              {search ? t("try_different") : t("be_first")}
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="mt-2 px-6 py-2 rounded-full bg-white border border-[#dbe5f7] text-[#2d67f7] text-sm font-semibold font-body hover:bg-[#f7faff] transition-all"
              >
                {t("clear_search")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  const totalInstalls = skill.statsInstalls ?? 0;
  const installs = totalInstalls >= 1000
    ? `${(totalInstalls / 1000).toFixed(1)}k`
    : String(totalInstalls);

  return (
      <div className="bg-white rounded-[10px] border border-[#dbe5f7] shadow-[0_8px_22px_rgba(25,43,87,0.03)] overflow-hidden flex flex-col transition-colors hover:border-[#bfd0f4]">
        <Link href={`/skills/${skill.slug}`} className="px-4 pt-4 pb-3 flex flex-col flex-1 gap-2.5 hover:bg-[#fbfdff] transition-colors">
          <h3 className="text-[15px] font-semibold font-heading text-[#15213b] leading-snug line-clamp-2">
            {skill.name}
          </h3>
          <p className="min-h-[36px] text-[12px] text-[#52617d] font-body leading-relaxed line-clamp-2 flex-1">
            {skill.summary || tCommon("no_description")}
          </p>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#d9e8ff] flex items-center justify-center text-[10px] font-bold font-heading text-[#2d67f7] overflow-hidden">
                {skill.authorName ? skill.authorName[0].toUpperCase() : "?"}
              </div>
              <span className="text-[11px] text-[#52617d] font-body truncate max-w-[92px]">
                {skill.authorName || tCommon("anonymous")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#52617d] font-body">
              <span className="inline-flex items-center gap-1">
                <StarIcon className="h-3 w-3 text-[#2d67f7]" />
                {formatAverageRating(skill.statsStars, skill.statsRatingsCount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-[#9aa4be]">◔</span>
                {installs}
              </span>
            </div>
          </div>
        </Link>

      <div className="mx-4 mb-4">
        <div className="bg-[#f0f6ff] rounded-[6px] border border-[#d6e4fb] px-3 py-2 flex items-center justify-between gap-2">
          <code className="text-[11px] font-mono-custom text-[#2d67f7] truncate flex-1">
            {installCmd}
          </code>
          <button
            onClick={onCopy}
            className="flex-shrink-0 text-[#2d67f7] hover:text-[#2457d4] transition-colors"
            title={t("copy_command")}
          >
            {copied ? (
              <span className="text-[11px] font-bold">{t("skill_copied")}</span>
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
