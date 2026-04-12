"use client";
import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n/context";
import LineChart from "@/components/charts/LineChart";
import PieChart from "@/components/charts/PieChart";

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
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/overview?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("Failed to load analytics data."))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
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
        <div className="flex gap-1 bg-white rounded-full p-1 shadow-[0_4px_12px_rgba(86,67,55,0.08)]">
          {(["7d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-body transition-all ${
                period === p
                  ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white"
                  : "text-[#586330] hover:bg-[#ede9cf]"
              }`}
            >
              {p === "7d" ? t("period_7d") : t("period_30d")}
            </button>
          ))}
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
        <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)]">
          <h3 className="text-sm font-semibold text-[#a23f00] font-heading mb-4">{t("event_trend")}</h3>
          <LineChart
            data={trend.eventsByDay}
            color="#a23f00"
            height={160}
          />
        </div>
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
