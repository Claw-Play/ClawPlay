"use client";
import { useState, useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/context";
import PieChart from "@/components/charts/PieChart";
import EventTrendCard from "./EventTrendCard";

type Period = "7d" | "30d" | "3m" | "1y";

const PERIOD_OPTIONS: { value: Period; labelKey: string }[] = [
  { value: "7d", labelKey: "period_7d" },
  { value: "30d", labelKey: "period_30d" },
  { value: "3m", labelKey: "period_3m" },
  { value: "1y", labelKey: "period_1y" },
];

const filterControlClassName =
  "rounded-full border border-[#eadfc8] bg-[#fffdf8] px-4 py-2.5 text-sm text-[#5f493a] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_20px_rgba(86,67,55,0.05)] transition-colors focus:border-[#d8b07d] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/15";
const menuClassName =
  "absolute left-0 top-full z-20 mt-2 min-w-[120px] rounded-[18px] border border-[#eadfc8] bg-[linear-gradient(180deg,#fffdf8_0%,#f7efe1_100%)] p-1 shadow-[0_16px_34px_rgba(86,67,55,0.16)] backdrop-blur-sm";
const menuItemClassName =
  "flex min-h-[30px] w-full items-center justify-between rounded-xl px-2.5 py-1 text-left text-xs font-semibold transition-colors";

interface OverviewData {
  period: string;
  totals: {
    activeUsers: number;
    totalEvents: number;
    totalQuotaUsed: number;
    totalSkills: number;
  };
  trend: {
    eventsByDay: { date: string; count: number }[];
    topSkills: { slug: string; name: string; views: number; downloads: number }[];
    abilityBreakdown: { ability: string; count: number }[];
    providerBreakdown: { provider: string; count: number }[];
  };
  errors: {
    total: number;
    byProvider: { provider: string; count: number }[];
  };
}

const ABILITY_COLORS: Record<string, string> = {
  "llm.generate": "#a23f00",
  "image.generate": "#fa7025",
  "vision.analyze": "#586330",
  "tts.synthesize": "#8a6040",
  "voice.synthesize": "#5a7a4a",
};

const PROVIDER_COLORS: Record<string, string> = {
  ark: "#a23f00",
  gemini: "#586330",
};

export default function OverviewClient() {
  const t = useT("admin");
  const [period, setPeriod] = useState<Period>("7d");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentOption = PERIOD_OPTIONS.find((o) => o.value === period)!;

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setIsMenuOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") setIsMenuOpen(false); };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/overview?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("Failed to load analytics data."))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)] animate-pulse">
              <div className="h-4 bg-[#e8dfc8] rounded w-1/2 mb-3" />
              <div className="h-8 bg-[#e8dfc8] rounded w-2/3" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)] h-48 animate-pulse" />
          <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)] h-48 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 text-[#a23f00] font-body">
        {error ?? "Failed to load data."}
      </div>
    );
  }

  const { totals, trend, errors } = data;

  const statCards = [
    { label: t("active_users"), value: totals.activeUsers, icon: "👥" },
    { label: t("total_events"), value: totals.totalEvents.toLocaleString(), icon: "📊" },
    { label: t("quota_used"), value: totals.totalQuotaUsed.toLocaleString(), icon: "⚡" },
    { label: t("total_skills"), value: totals.totalSkills, icon: "🎯" },
  ];

  const abilityData = trend.abilityBreakdown.map((a) => ({
    name: a.ability.replace("llm.generate", "LLM").replace("image.generate", "Image").replace("vision.analyze", "Vision").replace("tts.synthesize", "TTS"),
    value: a.count,
    color: ABILITY_COLORS[a.ability] ?? "#a89070",
  }));

  const providerData = trend.providerBreakdown.map((p) => ({
    name: p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
    value: p.count,
    color: PROVIDER_COLORS[p.provider] ?? "#a89070",
  }));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex justify-end">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`${filterControlClassName} inline-flex min-w-[120px] items-center justify-between gap-3`}
            style={{ fontFamily: "var(--font-vietnam)" }}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <span>{t(currentOption.labelKey)}</span>
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#f3e6d0] text-[#a23f00] transition-transform ${isMenuOpen ? "rotate-180" : ""}`}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 4L6 7.5L9.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          {isMenuOpen && (
            <div className={menuClassName}>
              {PERIOD_OPTIONS.map((option) => {
                const selected = option.value === period;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { setPeriod(option.value); setIsMenuOpen(false); }}
                    className={`${menuItemClassName} ${selected ? "bg-[#eee0c9] text-[#75563f]" : "text-[#8d745e] hover:bg-[#f5ede0] hover:text-[#a23f00]"}`}
                    style={{ fontFamily: "var(--font-vietnam)" }}
                    role="menuitemradio"
                    aria-checked={selected}
                  >
                    <span className="truncate">{t(option.labelKey)}</span>
                    <span className={`ml-3 inline-flex h-4 w-4 items-center justify-center ${selected ? "text-[#a23f00]" : "text-transparent"}`}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.25 6.25L4.75 8.75L9.75 3.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)]"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{card.icon}</span>
              <span className="text-xs text-[#a89070] font-body">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-[#564337] font-heading">
              {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top skills */}
        <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)]">
          <h3 className="text-sm font-semibold text-[#a23f00] font-heading mb-4">{t("top_skills")}</h3>
          {trend.topSkills.length === 0 ? (
            <p className="text-sm text-[#a89070] font-body">{t("no_data")}</p>
          ) : (
            <div className="space-y-3">
              {trend.topSkills.slice(0, 5).map((s, i) => (
                <div key={s.slug} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#a89070] font-mono-custom w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#564337] font-body truncate">{s.name}</p>
                    <div className="flex gap-3 text-xs text-[#a89070] font-body">
                      <span>{s.views} {t("views")}</span>
                      <span>{s.downloads} {t("downloads")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event trend */}
        <EventTrendCard period={period} t={(k: string) => t(k)} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Ability breakdown */}
        <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)]">
          <h3 className="text-sm font-semibold text-[#a23f00] font-heading mb-4">{t("ability_breakdown")}</h3>
          <div className="flex items-center justify-center">
            <PieChart data={abilityData} size={120} totalLabel={t("total_count")} />
          </div>
        </div>

        {/* Provider breakdown */}
        <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)]">
          <h3 className="text-sm font-semibold text-[#a23f00] font-heading mb-4">{t("provider_breakdown")}</h3>
          <div className="flex items-center justify-center">
            <PieChart data={providerData} size={120} totalLabel={t("total_count")} />
          </div>
        </div>

        {/* Error tracking */}
        <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)]">
          <h3 className="text-sm font-semibold text-[#a23f00] font-heading mb-4">{t("error_tracking")}</h3>
          <p className="text-3xl font-bold text-[#564337] font-heading mb-4">{errors.total}</p>
          {errors.byProvider.length === 0 ? (
            <p className="text-sm text-[#a89070] font-body">{t("no_data")}</p>
          ) : (
            <div className="space-y-2">
              {errors.byProvider.map((e) => (
                <div key={e.provider} className="flex justify-between items-center text-sm font-body">
                  <span className="text-[#564337]">{e.provider?.charAt(0).toUpperCase()}{e.provider?.slice(1)}</span>
                  <span className="text-[#a23f00] font-semibold">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
