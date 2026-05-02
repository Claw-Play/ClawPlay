"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useCountUp } from "@/app/hooks/useCountUp";

export interface Stats {
  installs: number;
  creators: number;
  skills: number;
  activeThisWeek: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toLocaleString();
}

const STAT_KEYS = [
  { key: "installs" as const, labelKey: "stats_installs", unitKey: "stats_installs_unit" },
  { key: "creators" as const, labelKey: "stats_creators", unitKey: "stats_creators_unit" },
  { key: "skills" as const, labelKey: "stats_skills", unitKey: "stats_skills_unit" },
  { key: "activeThisWeek" as const, labelKey: "stats_active", unitKey: "stats_active_unit" },
];

interface StatItemProps {
  value: number;
  label: string;
  unit: string;
  entered: boolean;
  delay: number;
  isLast: boolean;
}

function StatItem({ value, label, unit, entered, delay, isLast }: StatItemProps) {
  const count = useCountUp(value, entered, 1000 + delay);
  const formatted = formatNumber(count);

  return (
    <div
      className="flex flex-col items-center justify-center flex-1 py-5 transition-all duration-500"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(8px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {/* Number + unit row */}
      <div className="flex items-baseline gap-1">
        <span
          className="font-heading font-extrabold leading-none text-[#1f2b45]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}
          aria-live="polite"
        >
          {formatted}
        </span>
        <span className="text-[10px] font-semibold text-[#4f82f7] font-body leading-tight">
          {unit}
        </span>
      </div>
      {/* Label */}
      <span className="text-[10px] font-semibold text-[#897365] uppercase tracking-wider font-body leading-tight mt-0.5">
        {label}
      </span>

      {/* Vertical divider (not after last) */}
      {!isLast && (
        <div
          className="absolute right-0 top-1/4 bottom-1/4 w-px bg-[#dbe5f7]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function StatsSectionClient({ stats }: { stats: Stats }) {
  const t = useT("home");
  const [entered, setEntered] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const items = STAT_KEYS.map((s) => ({
    ...s,
    value: stats[s.key],
    label: t(s.labelKey),
    unit: t(s.unitKey),
  }));

  return (
    <section ref={ref} className="px-6" style={{ background: "#f8faff" }}>
      <div className="max-w-4xl mx-auto">
        {/* White card container — creates clear contrast against #f8faff page bg */}
        <div className="flex items-stretch rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(25,43,87,0.08)]" style={{ background: "#ffffff" }}>
          {items.map((item, i) => (
            <div key={item.key} className="flex items-stretch flex-1 relative">
              <StatItem
                value={item.value}
                label={item.label}
                unit={item.unit}
                entered={entered}
                delay={i * 80}
                isLast={i === items.length - 1}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
