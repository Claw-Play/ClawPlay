"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { unixSecToDate, formatDate, formatTime } from "@/lib/timestamp";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

interface AuditEntry {
  id?: number;
  event: string;
  action: string;
  timestamp?: number | null;
  actorId?: number | string | null;
  userId?: number | string | null;
  targetId?: string | null;
  targetType?: string | null;
  metadata?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
}

type FilterTab = "all" | "skills";

const PAGE_SIZE = 20;

export default function AdminAuditPage() {
  const t = useT("admin_audit");
  const tCommon = useT("common");

  const ACTION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    "skill.submit": { bg: "#dbeafe", text: "#1e40af", label: t("submit_skill") },
    "skill.approve": { bg: "#dcfce7", text: "#166534", label: t("approve_skill") },
    "skill.reject": { bg: "#fee2e2", text: "#991b1b", label: t("reject_skill") },
    "skill.feature": { bg: "#ffedd5", text: "#9a3412", label: t("feature_skill") ?? t("approve_skill") },
    "skill.unfeature": { bg: "#edf4ff", text: "#52617d", label: t("unfeature_skill") ?? "Unfeature" },
    "user.login": { bg: "#edf4ff", text: "#2d67f7", label: t("login") },
    "user.register": { bg: "#edf4ff", text: "#2d67f7", label: t("register") },
  };

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<FilterTab>("skills");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setExpanded(null);
    const offset = (page - 1) * PAGE_SIZE;
    fetch(`/api/admin/audit-logs?limit=${PAGE_SIZE}&offset=${offset}&tab=${tab}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, tab]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startItem = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const endItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="max-w-6xl space-y-6 px-4 md:px-0">
      {/* Tabs */}
      <div className="flex items-start gap-2 md:items-center">
        <div className="bg-[#eef4ff] rounded-full p-1 flex w-full gap-1 md:w-auto">
          {(["all", "skills"] as FilterTab[]).map((tabItem) => (
            <button
              key={tabItem}
              onClick={() => { setTab(tabItem); setPage(1); }}
              className={`flex-1 px-5 py-2 rounded-full text-sm font-medium transition-all font-body md:flex-none ${
                tab === tabItem
                  ? "bg-white text-[#2d67f7] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
                  : "text-[#52617d] hover:text-[#15213b]"
              }`}
            >
              {tabItem === "all" ? t("all_logs") : t("tab_skills")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[8px] border border-[#dbe5f7] shadow-[0_12px_32px_rgba(25,43,87,0.04)] min-h-[980px] overflow-hidden">
        {/* Table header */}
        <div className="hidden bg-[#fbfdff] border-b border-[#dbe5f7] md:block">
          <div className="grid grid-cols-[170px_200px_1fr_180px_120px] gap-0">
            <div className="px-6 py-4 text-[12px] font-semibold text-[#6d7891] uppercase tracking-widest font-body">{t("time")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#6d7891] uppercase tracking-widest font-body">{t("action")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#6d7891] uppercase tracking-widest font-body">{t("actor")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#6d7891] uppercase tracking-widest font-body">{t("target")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#6d7891] uppercase tracking-widest font-body text-right">{t("activity")}</div>
          </div>
        </div>

        {/* Loading */}
        {loading && entries.length === 0 ? (
          <div className="py-12 text-center text-[#7c879f] animate-pulse font-body">{tCommon("loading")}</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-[#7c879f] font-body">{t("no_entries")}</div>
        ) : (
          <div className="relative">
            <div className="grid gap-3 px-4 py-4 md:hidden">
              {entries.map((entry, i) => {
                const style = ACTION_STYLES[entry.event] ?? { bg: "#edf4ff", text: "#2d67f7", label: entry.event };
                const ts = unixSecToDate(entry.timestamp ?? null);
                const actorId = entry.actorId ?? entry.userId ?? "";
                const actorStr = actorId !== "" && actorId !== null && actorId !== undefined ? String(actorId) : "";
                const initials = actorStr.length >= 2 ? actorStr.slice(0, 2).toUpperCase() : actorStr.toUpperCase();
                return (
                  <article key={entry.id ?? i} className="rounded-[12px] border border-[#dbe5f7] bg-white p-4 shadow-[0_8px_20px_rgba(25,43,87,0.04)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#15213b] font-body">
                          {formatDate(ts, "en-US")}
                        </p>
                        <p className="text-xs text-[#52617d] font-body">
                          {formatTime(ts)}
                        </p>
                      </div>
                      <span
                        className="inline-block rounded-full px-3 py-1 text-[10px] font-semibold uppercase font-body"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {style.label}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-[10px] bg-[#f7faff] px-3 py-2">
                        <p className="text-[#7c879f]">{t("actor")}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold font-body"
                            style={{ backgroundColor: style.bg, color: style.text }}
                          >
                            {initials || "?"}
                          </div>
                          <p className="truncate font-semibold text-[#15213b]">
                            {actorStr ? `User ${actorStr}` : t("system")}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-[10px] bg-[#f7faff] px-3 py-2">
                        <p className="text-[#7c879f]">{t("target")}</p>
                        <p className="mt-1 truncate font-semibold text-[#15213b]">
                          {entry.targetId ? entry.targetId.slice(0, 12) + (entry.targetId.length > 12 ? "..." : "") : "—"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpanded(expanded === i ? null : i)}
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-[#dbe5f7] bg-white px-4 text-sm font-semibold text-[#2d67f7] shadow-[0_8px_20px_rgba(25,43,87,0.06)]"
                    >
                      {t("details")}
                    </button>

                    {expanded === i && (
                      <div className="mt-4 rounded-[20px] bg-[#1a1a2e] px-4 py-4 text-left">
                        <div className="max-h-56 overflow-auto rounded-[16px] bg-[#1a1a2e] font-mono-custom text-xs text-[#f8faff] whitespace-pre-wrap">
                          {JSON.stringify(entry, null, 2)}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="hidden md:block">
            {entries.map((entry, i) => {
              const style = ACTION_STYLES[entry.event] ?? { bg: "#edf4ff", text: "#2d67f7", label: entry.event };
              const ts = unixSecToDate(entry.timestamp ?? null);
              const actorId = entry.actorId ?? entry.userId ?? "";
              const actorStr = actorId !== "" && actorId !== null && actorId !== undefined ? String(actorId) : "";
              const initials = actorStr.length >= 2 ? actorStr.slice(0, 2).toUpperCase() : actorStr.toUpperCase();
              const isExpanded = expanded === i;

              return (
                <div key={entry.id ?? i}>
                  <div
                    className={`grid grid-cols-[170px_200px_1fr_180px_120px] gap-0 items-center border-t border-[rgba(219,229,247,0.05)] ${
                      isExpanded ? "bg-[#f7faff]" : "hover:bg-[#f7faff]"
                    } transition-colors cursor-pointer`}
                    onClick={() => setExpanded(isExpanded ? null : i)}
                  >
                    {/* Timestamp */}
                    <div className="px-6 py-5">
                      <p className="text-sm font-medium text-[#15213b] font-body">
                        {formatDate(ts, "en-US")}
                      </p>
                      <p className="text-xs text-[#52617d] font-body">
                        {formatTime(ts)}
                      </p>
                    </div>

                    {/* Action */}
                    <div className="px-6 py-5">
                      <span
                        className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase font-body"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {style.label}
                      </span>
                    </div>

                    {/* Actor */}
                    <div className="px-6 py-5 flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-body flex-shrink-0"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {initials || "?"}
                      </div>
                      <span className="text-sm font-medium text-[#15213b] font-body truncate">
                        {actorStr ? `User ${actorStr}` : t("system")}
                      </span>
                    </div>

                    {/* Target */}
                    <div className="px-6 py-5">
                      <span className="inline-block bg-[#f0f6ff] text-[#15213b] px-2 py-0.5 rounded-[16px] text-xs font-mono-custom">
                        {entry.targetId ? entry.targetId.slice(0, 12) + (entry.targetId.length > 12 ? "..." : "") : "—"}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="px-6 py-5 text-right">
                      <span className="text-sm font-semibold text-[#2d67f7] hover:text-[#2457d4] transition-colors font-body">
                        {t("details")}
                      </span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[#dbe5f7] bg-[#1a1a2e] px-8 py-6">
                      <div className="bg-[#1a1a2e] rounded-[32px] p-6 font-mono-custom text-sm text-[#f8faff] whitespace-pre overflow-x-auto">
                        {JSON.stringify(entry, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-[#fbfdff] border-t border-[#dbe5f7] px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:px-6">
                <p className="text-xs text-[#52617d] font-body">
                  {t("showing_range", { startItem: String(startItem), endItem: String(endItem), total: String(total.toLocaleString()) })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    <ChevronLeftIcon className="w-3 h-3" />
                  </PageBtn>
                  {pageNumbers(page, totalPages).map((n, i) =>
                    n === "..." ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-[#6d7891] font-body">...</span>
                    ) : (
                      <PageBtn key={n} onClick={() => setPage(Number(n))} active={Number(n) === page}>{n}</PageBtn>
                    )
                  )}
                  <PageBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    <ChevronRightIcon className="w-3 h-3" />
                  </PageBtn>
                </div>
              </div>
            )}
            {loading && (
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.22),rgba(247,240,226,0.12))] backdrop-blur-[1px]">
                <div className="absolute inset-x-6 top-6 h-px bg-[linear-gradient(90deg,transparent,rgba(0,0,0,0.14),transparent)] animate-pulse" />
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

function PageBtn({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-full text-xs font-semibold transition-all font-body ${
        active
          ? "bg-[#2d67f7] text-white"
          : "bg-white text-[#15213b] hover:bg-[#eef4ff] shadow-sm"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function pageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}
