"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import PieChart from "@/components/charts/PieChart";
import EventTrendCard from "./EventTrendCard";
import { ArrowRightIcon, BoltIcon, ChevronDownIcon, DashboardIcon, TargetIcon, UsersIcon } from "@/components/icons";

type Period = "7d" | "30d" | "3m" | "1y";

const PERIOD_OPTIONS: { value: Period; labelKey: string }[] = [
  { value: "7d", labelKey: "period_7d" },
  { value: "30d", labelKey: "period_30d" },
  { value: "3m", labelKey: "period_3m" },
  { value: "1y", labelKey: "period_1y" },
];

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
  "llm.generate": "#2d67f7",
  "image.generate": "#6b8df7",
  "vision.analyze": "#8db3ff",
  "tts.synthesize": "#5aa7ff",
  "voice.synthesize": "#9db5ff",
};

const PROVIDER_COLORS: Record<string, string> = {
  ark: "#2d67f7",
  gemini: "#8db3ff",
};

const cardShell =
  "rounded-[26px] border border-[#dbe5f7] bg-white shadow-[0_12px_28px_rgba(25,43,87,0.05)]";

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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
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
        if (d.error) {
          setError(d.error);
          return;
        }
        setData(d);
      })
      .catch(() => setError("Failed to load analytics data."))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${cardShell} h-[180px] animate-pulse p-6`} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={`${cardShell} h-[340px] animate-pulse p-6`} />
          <div className={`${cardShell} h-[340px] animate-pulse p-6`} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center text-[#2d67f7]">
        {error ?? "Failed to load data."}
      </div>
    );
  }

  const { totals, trend, errors } = data;

  const statCards = [
    { label: t("active_users"), value: totals.activeUsers, icon: UsersIcon },
    { label: t("total_events"), value: totals.totalEvents.toLocaleString(), icon: DashboardIcon },
    { label: t("quota_used"), value: totals.totalQuotaUsed.toLocaleString(), icon: BoltIcon },
    { label: t("total_skills"), value: totals.totalSkills, icon: TargetIcon },
  ];

  const abilityData = trend.abilityBreakdown.map((a) => ({
    name: a.ability.replace("llm.generate", "LLM").replace("image.generate", "Image").replace("vision.analyze", "Vision").replace("tts.synthesize", "TTS"),
    value: a.count,
    color: ABILITY_COLORS[a.ability] ?? "#8db3ff",
  }));

  const providerData = trend.providerBreakdown.map((p) => ({
    name: p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
    value: p.count,
    color: PROVIDER_COLORS[p.provider] ?? "#8db3ff",
  }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="inline-flex h-11 min-w-[118px] items-center justify-between gap-3 rounded-full border border-[#dbe5f7] bg-white px-4 text-[14px] font-medium text-[#394766] shadow-[0_8px_18px_rgba(25,43,87,0.04)] transition-colors hover:bg-[#f7faff]"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <span>{t(currentOption.labelKey)}</span>
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#edf4ff] text-[#2d67f7] transition-transform ${isMenuOpen ? "rotate-180" : ""}`}>
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </span>
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-full z-20 mt-2 w-36 overflow-hidden rounded-[20px] border border-[#dbe5f7] bg-white shadow-[0_18px_36px_rgba(25,43,87,0.12)]">
              {PERIOD_OPTIONS.map((option) => {
                const selected = option.value === period;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPeriod(option.value);
                      setIsMenuOpen(false);
                    }}
                    className={[
                      "flex min-h-10 w-full items-center justify-between px-4 text-left text-[13px] transition-colors",
                      selected ? "bg-[#edf4ff] text-[#2d67f7]" : "text-[#5f6c86] hover:bg-[#f7faff]",
                    ].join(" ")}
                  >
                    <span>{t(option.labelKey)}</span>
                    {selected && <ArrowRightIcon className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className={`${cardShell} flex min-h-[176px] flex-col justify-between px-7 py-7 sm:px-7`}>
            <div className="flex items-start gap-3">
              <card.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#2d67f7]" />
              <span className="text-[13px] font-medium tracking-[-0.01em] text-[#7c879f]">{card.label}</span>
            </div>
            <div className="text-[clamp(2.75rem,4.5vw,3.4rem)] font-semibold leading-none tracking-[-0.06em] text-[#15213b]">
              {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${cardShell} p-5 sm:p-6`}>
          <h3 className="mb-5 text-[15px] font-semibold text-[#15213b]">{t("top_skills")}</h3>
          {trend.topSkills.length === 0 ? (
            <p className="text-[14px] text-[#7c879f]">{t("no_data")}</p>
          ) : (
            <div className="space-y-3">
              {trend.topSkills.slice(0, 5).map((s, i) => (
                <div key={s.slug} className="flex items-center gap-3 rounded-[18px] border border-[#edf1f8] px-3 py-3">
                  <span className="w-4 text-[13px] font-semibold text-[#8aa0cb]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[#15213b]">{s.name}</p>
                    <p className="mt-0.5 text-[12px] text-[#7c879f]">
                      {s.views} {t("views")} · {s.downloads} {t("downloads")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <EventTrendCard period={period} t={(k: string) => t(k)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${cardShell} p-5 sm:p-6`}>
          <h3 className="mb-4 text-[15px] font-semibold text-[#15213b]">{t("ability_breakdown")}</h3>
          <div className="flex min-h-[240px] items-center justify-center">
            <PieChart data={abilityData} size={150} totalLabel={t("total_count")} />
          </div>
        </div>
        <div className={`${cardShell} p-5 sm:p-6`}>
          <h3 className="mb-4 text-[15px] font-semibold text-[#15213b]">{t("provider_breakdown")}</h3>
          <div className="flex min-h-[240px] items-center justify-center">
            <PieChart data={providerData} size={150} totalLabel={t("total_count")} />
          </div>
        </div>
        <div className={`${cardShell} p-5 sm:p-6`}>
          <h3 className="mb-4 text-[15px] font-semibold text-[#15213b]">{t("error_tracking")}</h3>
          <div className="text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-[-0.05em] text-[#15213b]">
            {errors.total}
          </div>
          <p className="mt-2 text-[14px] text-[#7c879f]">
            {errors.byProvider.length === 0 ? t("no_data") : t("total_count")}
          </p>
          {errors.byProvider.length > 0 && (
            <div className="mt-5 space-y-3">
              {errors.byProvider.map((e) => (
                <div key={e.provider} className="flex items-center justify-between rounded-[18px] border border-[#edf1f8] px-4 py-3 text-[13px]">
                  <span className="text-[#394766]">{e.provider?.charAt(0).toUpperCase()}{e.provider?.slice(1)}</span>
                  <span className="font-semibold text-[#2d67f7]">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
