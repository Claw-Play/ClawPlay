"use client";
import { useState } from "react";
import Link from "next/link";

interface Skill {
  slug: string;
  name: string;
  summary: string | null;
  authorName: string | null;
  iconEmoji: string | null;
  statsStars: number | null;
  createdAt: Date | null;
}

interface SkillsClientProps {
  initialSkills: Skill[];
}

const CATEGORIES = [
  { label: "艺术", emoji: "🎨", filter: "🎨" },
  { label: "写作", emoji: "✍️", filter: "✍️" },
  { label: "游戏", emoji: "🎮", filter: "🎮" },
  { label: "工具", emoji: "🛠️", filter: "🛠️" },
  { label: "健康", emoji: "🌿", filter: "🌿" },
];

export function SkillsClient({ initialSkills }: SkillsClientProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<"new" | "trending">("new");

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
    })
    .sort((a, b) => {
      if (sort === "trending") {
        return (b.statsStars ?? 0) - (a.statsStars ?? 0);
      }
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });

  return (
    <div className="max-w-[1024px] mx-auto px-8 py-12 flex flex-col gap-10">
      {/* Hero Header */}
      <div className="text-center space-y-5 pt-8">
        <h1 className="text-5xl font-extrabold font-heading text-[#1d1c0d] tracking-tight leading-[1.1]">
          发现精彩技能
        </h1>
        <p className="text-lg text-[#564337] font-body max-w-[672px] mx-auto leading-relaxed">
          从艺术创作到效率工具，探索专为 X Claw 设计的 AI 行为集。
          <br />
          找到最适合你的数字伴侣。
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute left-7 top-1/2 -translate-y-1/2 text-[#a89888] pointer-events-none text-lg">
          ⌕
        </div>
        <input
          type="text"
          placeholder="搜索技能、创作者或行为..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-16 pl-16 pr-8 rounded-full bg-white backdrop-blur-md border border-[#e8dfc8] text-[#564337] placeholder-[#a89888] text-base font-body focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30 focus:border-[#a23f00] transition-all shadow-[0_10px_15px_-3px_rgba(86,67,55,0.05),0_4px_6px_-4px_rgba(86,67,55,0.05)]"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-6 py-3 rounded-full text-sm font-semibold font-body transition-all ${
            activeCategory === null
              ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0_6px_20px_rgba(162,63,0,0.25)]"
              : "bg-[#ede9cf] text-[#5c6834] hover:bg-[#ddd8b8]"
          }`}
        >
          全部
        </button>
        {CATEGORIES.map(({ label, emoji, filter }) => (
          <button
            key={filter}
            onClick={() => setActiveCategory(activeCategory === filter ? null : filter)}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold font-body transition-all ${
              activeCategory === filter
                ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0_6px_20px_rgba(162,63,0,0.25)]"
                : "bg-[#ede9cf] text-[#5c6834] hover:bg-[#ddd8b8]"
            }`}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Sort toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => setSort("new")}
          className={`px-5 py-2 rounded-full text-sm font-semibold font-body transition-all ${
            sort === "new"
              ? "bg-[#1d1c0d] text-white"
              : "bg-[#f8f4db] text-[#564337] hover:bg-[#ede9cf]"
          }`}
        >
          ✦ 最新
        </button>
        <button
          onClick={() => setSort("trending")}
          className={`px-5 py-2 rounded-full text-sm font-semibold font-body transition-all ${
            sort === "trending"
              ? "bg-[#1d1c0d] text-white"
              : "bg-[#f8f4db] text-[#564337] hover:bg-[#ede9cf]"
          }`}
        >
          ↗ 热门
        </button>
      </div>

      {/* Skill Cards — Horizontal Layout */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <div className="text-6xl">{activeCategory ?? "🦐"}</div>
          <h2 className="text-2xl font-bold text-[#564337] font-heading">
            {search ? `未找到「${search}」相关结果` : "暂无该分类技能"}
          </h2>
          <p className="text-[#7a6a5a] font-body">
            {search ? "换个关键词试试吧。" : "成为第一个提交者！"}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-2 px-6 py-2 rounded-full bg-[#ede9cf] text-[#5c6834] text-sm font-semibold font-body hover:bg-[#ddd8b8] transition-all"
            >
              清除搜索
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filtered.map((s) => (
            <SkillCard key={s.slug} skill={s} />
          ))}
        </div>
      )}

      {/* Load More */}
      {filtered.length > 0 && (
        <div className="flex justify-center pt-4">
          <button className="px-10 py-4 rounded-full bg-[#ede9cf] border border-[rgba(220,193,177,0.1)] text-[#1d1c0d] text-base font-semibold font-body hover:bg-[#ddd8b8] transition-all">
            探索更多技能
          </button>
        </div>
      )}
    </div>
  );
}

function SkillCard({ skill }: { skill: Skill }) {
  return (
    <div className="bg-[#f8f4db] rounded-[48px] p-6 flex items-center gap-8 shadow-[0_8px_24px_rgba(86,67,55,0.04)]">
      {/* Emoji icon */}
      <div className="w-[96px] h-[96px] shrink-0 bg-white rounded-[32px] border border-[rgba(220,193,177,0.05)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center">
        <span className="text-[48px] leading-none">
          {skill.iconEmoji ?? "🦐"}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-2">
        <h3 className="text-2xl font-bold font-heading text-[#1d1c0d] leading-tight truncate">
          {skill.name}
        </h3>
        <p className="text-base text-[#564337] font-body line-clamp-2 leading-relaxed">
          {skill.summary || "暂无描述。"}
        </p>
        {/* Author */}
        <div className="flex items-center gap-2 pt-1">
          <div className="w-6 h-6 rounded-full bg-[#ede9cf] flex items-center justify-center text-sm">
            {skill.authorName ? skill.authorName[0].toUpperCase() : "?"}
          </div>
          <span className="text-sm text-[#586330] font-medium font-body">
            {skill.authorName || "匿名创作者"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="shrink-0 space-y-2 text-right">
        <div className="flex items-center gap-1 justify-end">
          <span className="text-[#fa7025] font-semibold text-base font-body">
            ⭐ {((skill.statsStars ?? 0) / 100).toFixed(1)}
          </span>
        </div>
        {skill.createdAt && (
          <p className="text-xs text-[#564337] opacity-60 font-body uppercase tracking-wider">
            {new Date(skill.createdAt).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Install Button */}
      <Link
        href={`/skills/${skill.slug}`}
        className="shrink-0 px-8 py-3 rounded-full bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white text-base font-semibold font-heading shadow-[0_10px_15px_-3px_rgba(162,63,0,0.2),0_4px_6px_-4px_rgba(162,63,0,0.2)] hover:opacity-90 transition-opacity"
      >
        查看详情
      </Link>
    </div>
  );
}
