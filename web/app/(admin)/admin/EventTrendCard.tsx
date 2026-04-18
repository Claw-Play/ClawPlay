"use client";
import { useState, useEffect } from "react";
import LineChart from "@/components/charts/LineChart";

type Period = "7d" | "30d" | "3m" | "1y";
type EventType = "all" | "skill.view" | "skill.download" | "quota.use" | "auth.login";

const EVENT_OPTIONS: { value: EventType; labelKey: string }[] = [
  { value: "all", labelKey: "event_all" },
  { value: "skill.view", labelKey: "event_skill_view" },
  { value: "skill.download", labelKey: "event_skill_download" },
  { value: "quota.use", labelKey: "event_quota_use" },
  { value: "auth.login", labelKey: "event_auth_login" },
];

export default function EventTrendCard({
  period,
  t,
}: {
  period: Period;
  t: (key: string) => string;
}) {
  const [eventType, setEventType] = useState<EventType>("all");
  const [data, setData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/overview?period=${period}&event=${eventType}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.trend?.eventsByDay) setData(d.trend.eventsByDay);
      })
      .finally(() => setLoading(false));
  }, [period, eventType]);

  return (
    <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#a23f00] font-heading">{t("event_trend")}</h3>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEventType(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                eventType === opt.value
                  ? "bg-[#a23f00] text-white"
                  : "border border-[#eadfc8] text-[#8d745e] hover:border-[#d8b07d] hover:text-[#a23f00]"
              }`}
              style={{ fontFamily: "var(--font-vietnam)" }}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[220px]">
        <LineChart data={data} color="#a23f00" height={220} />
        {loading && data.length > 0 && (
          <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[linear-gradient(180deg,rgba(255,253,248,0.28),rgba(247,240,226,0.16))] backdrop-blur-[1px]">
            <div className="absolute inset-x-6 top-6 h-px bg-[linear-gradient(90deg,transparent,rgba(162,63,0,0.2),transparent)] animate-pulse" />
          </div>
        )}
        {loading && data.length === 0 && (
          <div className="absolute inset-0 rounded-[24px] bg-[#f5ede0] animate-pulse" />
        )}
      </div>
    </div>
  );
}
