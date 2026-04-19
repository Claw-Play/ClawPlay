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
    "skill.unfeature": { bg: "#f0e8d0", text: "#7a6a5a", label: t("unfeature_skill") ?? "Unfeature" },
    "user.login": { bg: "#ede9cf", text: "#586330", label: t("login") },
    "user.register": { bg: "#ede9cf", text: "#586330", label: t("register") },
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
        <div className="bg-[#ede9cf] rounded-full p-1 flex w-full gap-1 md:w-auto">
          {(["all", "skills"] as FilterTab[]).map((tabItem) => (
            <button
              key={tabItem}
              onClick={() => { setTab(tabItem); setPage(1); }}
              className={`flex-1 px-5 py-2 rounded-full text-sm font-medium transition-all font-body md:flex-none ${
                tab === tabItem
                  ? "bg-white text-[#a23f00] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
                  : "text-[#5c6834] hover:text-[#1d1c0d]"
              }`}
            >
              {tabItem === "all" ? t("all_logs") : t("tab_skills")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[32px] md:rounded-[48px] card-shadow min-h-[980px] overflow-hidden">
        {/* Table header */}
        <div className="hidden bg-[rgba(237,233,207,0.5)] border-b border-[rgba(220,193,177,0.1)] md:block">
          <div className="grid grid-cols-[170px_200px_1fr_180px_120px] gap-0">
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body">{t("time")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body">{t("action")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body">{t("actor")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body">{t("target")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body text-right">{t("activity")}</div>
          </div>
        </div>

        {/* Loading */}
        {loading && entries.length === 0 ? (
          <div className="py-12 text-center text-[#7a6a5a] animate-pulse font-body">{tCommon("loading")}</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-[#7a6a5a] font-body">{t("no_entries")}</div>
        ) : (
          <div className="relative">
            <div className="grid gap-3 px-4 py-4 md:hidden">
              {entries.map((entry, i) => {
                const style = ACTION_STYLES[entry.event] ?? { bg: "#ede9cf", text: "#586330", label: entry.event };
                const ts = unixSecToDate(entry.timestamp ?? null);
                const actorId = entry.actorId ?? entry.userId ?? "";
                const actorStr = actorId !== "" && actorId !== null && actorId !== undefined ? String(actorId) : "";
                const initials = actorStr.length >= 2 ? actorStr.slice(0, 2).toUpperCase() : actorStr.toUpperCase();
                return (
                  <article key={entry.id ?? i} className="rounded-[24px] border border-[#eadfc8] bg-white/90 p-4 shadow-[0_8px_20px_rgba(86,67,55,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1d1c0d] font-body">
                          {formatDate(ts, "en-US")}
                        </p>
                        <p className="text-xs text-[#564337] font-body">
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
                      <div className="rounded-2xl bg-[#faf3d0] px-3 py-2">
                        <p className="text-black/40">{t("actor")}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold font-body"
                            style={{ backgroundColor: style.bg, color: style.text }}
                          >
                            {initials || "?"}
                          </div>
                          <p className="truncate font-semibold text-black">
                            {actorStr ? `User ${actorStr}` : t("system")}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#faf3d0] px-3 py-2">
                        <p className="text-black/40">{t("target")}</p>
                        <p className="mt-1 truncate font-semibold text-black">
                          {entry.targetId ? entry.targetId.slice(0, 12) + (entry.targetId.length > 12 ? "..." : "") : "—"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpanded(expanded === i ? null : i)}
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-[#eadfc8] bg-white px-4 text-sm font-semibold text-[#a23f00] shadow-[0_8px_20px_rgba(86,67,55,0.06)]"
                    >
                      {t("details")}
                    </button>

                    {expanded === i && (
                      <div className="mt-4 rounded-[20px] bg-[#1d1c0d] px-4 py-4 text-left">
                        <div className="max-h-56 overflow-auto rounded-[16px] bg-[#1d1c0d] font-mono-custom text-xs text-[#fefae0] whitespace-pre-wrap">
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
              const style = ACTION_STYLES[entry.event] ?? { bg: "#ede9cf", text: "#586330", label: entry.event };
              const ts = unixSecToDate(entry.timestamp ?? null);
              const actorId = entry.actorId ?? entry.userId ?? "";
              const actorStr = actorId !== "" && actorId !== null && actorId !== undefined ? String(actorId) : "";
              const initials = actorStr.length >= 2 ? actorStr.slice(0, 2).toUpperCase() : actorStr.toUpperCase();
              const isExpanded = expanded === i;

              return (
                <div key={entry.id ?? i}>
                  <div
                    className={`grid grid-cols-[170px_200px_1fr_180px_120px] gap-0 items-center border-t border-[rgba(220,193,177,0.05)] ${
                      isExpanded ? "bg-[#faf3d0]" : "hover:bg-[rgba(250,243,208,0.3)]"
                    } transition-colors cursor-pointer`}
                    onClick={() => setExpanded(isExpanded ? null : i)}
                  >
                    {/* Timestamp */}
                    <div className="px-6 py-5">
                      <p className="text-sm font-medium text-[#1d1c0d] font-body">
                        {formatDate(ts, "en-US")}
                      </p>
                      <p className="text-xs text-[#564337] font-body">
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
                      <span className="text-sm font-medium text-[#1d1c0d] font-body truncate">
                        {actorStr ? `User ${actorStr}` : t("system")}
                      </span>
                    </div>

                    {/* Target */}
                    <div className="px-6 py-5">
                      <span className="inline-block bg-[#f8f4db] text-[#1d1c0d] px-2 py-0.5 rounded-[16px] text-xs font-mono-custom">
                        {entry.targetId ? entry.targetId.slice(0, 12) + (entry.targetId.length > 12 ? "..." : "") : "—"}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="px-6 py-5 text-right">
                      <span className="text-sm font-semibold text-[#a23f00] hover:text-[#c45000] transition-colors font-body">
                        {t("details")}
                      </span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[rgba(220,193,177,0.1)] bg-[#1d1c0d] px-8 py-6">
                      <div className="bg-[#1d1c0d] rounded-[32px] p-6 font-mono-custom text-sm text-[#fefae0] whitespace-pre overflow-x-auto">
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
              <div className="bg-[rgba(237,233,207,0.3)] border-t border-[rgba(220,193,177,0.1)] px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:px-6">
                <p className="text-xs text-[#564337] font-body">
                  {t("showing_range", { startItem: String(startItem), endItem: String(endItem), total: String(total.toLocaleString()) })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    <ChevronLeftIcon className="w-3 h-3" />
                  </PageBtn>
                  {pageNumbers(page, totalPages).map((n, i) =>
                    n === "..." ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-[#897365] font-body">...</span>
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
          ? "bg-[#a23f00] text-white"
          : "bg-white text-[#1d1c0d] hover:bg-[#ede9cf] shadow-sm"
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
