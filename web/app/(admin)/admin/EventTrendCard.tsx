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
    <div className="flex h-full min-h-[486px] flex-col rounded-[28px] border border-[#dbe5f7] bg-white p-5 shadow-[0_14px_32px_rgba(25,43,87,0.05)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-[#15213b]">{t("event_trend")}</h3>
        <div className="flex flex-wrap justify-end gap-1.5">
          {EVENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEventType(opt.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                eventType === opt.value
                  ? "bg-[#2d67f7] text-white shadow-[0_8px_16px_rgba(45,103,247,0.18)]"
                  : "border border-[#dbe5f7] text-[#5f6c86] hover:border-[#bfd0f4] hover:text-[#2d67f7]"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-5 flex-1 min-h-[360px]">
        <LineChart data={data} color="#2d67f7" height={390} />
        {loading && data.length > 0 && (
          <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[linear-gradient(180deg,rgba(247,250,255,0.24),rgba(231,238,252,0.18))] backdrop-blur-[1px]">
            <div className="absolute inset-x-6 top-6 h-px bg-[linear-gradient(90deg,transparent,rgba(45,103,247,0.2),transparent)] animate-pulse" />
          </div>
        )}
        {loading && data.length === 0 && (
          <div className="absolute inset-0 rounded-[24px] bg-[#f7faff] animate-pulse" />
        )}
      </div>
    </div>
  );
}
