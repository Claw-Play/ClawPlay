"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";

interface AuditEntry {
  event_id?: string;
  actor?: { id: string; role?: string; ip?: string };
  action: string;
  target?: { type: string; id: string; version?: string };
  changes?: Record<string, { from: string; to: string }>;
  timestamp: string;
  actorId?: number | string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}

type FilterTab = "all" | "skills" | "tokens" | "users";

const PAGE_SIZE = 20;

export default function AdminAuditPage() {
  const t = useT("admin_audit");
  const tCommon = useT("common");

  const ACTION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    approve_skill: { bg: "#dcfce7", text: "#166534", label: t("approve_skill") },
    reject_skill: { bg: "#fee2e2", text: "#991b1b", label: t("reject_skill") },
    generate_token: { bg: "#ffedd5", text: "#9a3412", label: t("generate_token") },
    revoke_token: { bg: "#f0e8d0", text: "#7a6a5a", label: t("revoke_token") },
    submit_skill: { bg: "#dbeafe", text: "#1e40af", label: t("submit_skill") },
    login: { bg: "#ede9cf", text: "#586330", label: t("login") },
  };

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<FilterTab>("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setExpanded(null);
    const offset = (page - 1) * PAGE_SIZE;
    fetch(`/api/admin/audit-logs?limit=${PAGE_SIZE}&offset=${offset}`)
      .then((r) => r.json())
      .then((data) => {
        let items: AuditEntry[] = data.entries ?? [];

        // Filter by tab
        if (tab === "skills") {
          items = items.filter((e) =>
            ["approve_skill", "reject_skill", "submit_skill"].includes(e.action)
          );
        } else if (tab === "tokens") {
          items = items.filter((e) =>
            ["generate_token", "revoke_token"].includes(e.action)
          );
        } else if (tab === "users") {
          items = items.filter((e) => ["login", "logout", "register"].includes(e.action));
        }

        setEntries(items);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, tab]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-extrabold font-heading text-[#1d1c0d] tracking-tight">
            {t('title')}
          </h2>
          <p className="text-[#564337] text-sm mt-2 font-body">
            {t('subtitle')}
          </p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-[#d8e6a6] text-[#5c6834] text-sm font-semibold rounded-full hover:bg-[#c8d696] transition-colors font-heading shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          <span>↓</span>
          {t("export_jsonl")}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#f8f4db] rounded-[48px] p-4 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-2">
          <div className="bg-[#ede9cf] rounded-full p-1 flex gap-1">
            {(["all", "skills", "tokens", "users"] as FilterTab[]).map((tabItem) => (
              <button
                key={tabItem}
                onClick={() => { setTab(tabItem); setPage(1); }}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all font-body ${
                  tab === tabItem
                    ? "bg-white text-[#a23f00] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
                    : "text-[#5c6834] hover:text-[#1d1c0d]"
                }`}
              >
                {tabItem === "all" ? t("all_logs") : t(`tab_${tabItem}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-3 px-2 flex-wrap">
          <button
            onClick={() => { setTab("all"); setPage(1); }}
            className="px-4 py-2 bg-[#e7e3ca] text-[#1d1c0d] text-sm font-semibold rounded-[32px] hover:bg-[#d8d3ba] transition-colors font-body"
          >
                        {t("clear_filters")}
          </button>
          <button className="h-[40px] px-4 bg-white rounded-[32px] text-sm font-medium text-[#1d1c0d] hover:bg-[#faf3d0] transition-colors font-body shadow-sm">
            {t("last_24_hours")} ▼
          </button>
          <button className="h-[40px] px-4 bg-white rounded-[32px] text-sm font-medium text-[#1d1c0d] hover:bg-[#faf3d0] transition-colors font-body shadow-sm">
            {t("all_action_types")} ▼
          </button>
          <div className="h-[40px] px-4 bg-white rounded-[32px] flex items-center gap-2 text-sm text-[#6b7280] font-body">
            <span>🔍</span>
            <span>{t("actor_user_id")}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[48px] card-shadow overflow-hidden">
        {/* Table header */}
        <div className="bg-[rgba(237,233,207,0.5)] border-b border-[rgba(220,193,177,0.1)]">
          <div className="grid grid-cols-[170px_200px_1fr_180px_120px] gap-0">
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body">{t("time")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body">{t("action")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body">{t("actor")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body">{t("target")}</div>
            <div className="px-6 py-4 text-[12px] font-semibold text-[#897365] uppercase tracking-widest font-body text-right">{t("activity")}</div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="py-12 text-center text-[#7a6a5a] animate-pulse font-body">{tCommon("loading")}</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-[#7a6a5a] font-body">{t("no_entries")}</div>
        ) : (
          <>
            {entries.map((entry, i) => {
              const style = ACTION_STYLES[entry.action] ?? { bg: "#ede9cf", text: "#586330", label: entry.action };
              const ts = entry.timestamp ? new Date(entry.timestamp) : null;
              const actorId = entry.actor?.id ?? String(entry.actorId ?? "");
              const initials = actorId.slice(0, 2).toUpperCase();
              const targetId = entry.target?.id ?? entry.targetId ?? "";
              const isExpanded = expanded === i;

              return (
                <div key={i}>
                  <div
                    className={`grid grid-cols-[170px_200px_1fr_180px_120px] gap-0 items-center border-t border-[rgba(220,193,177,0.05)] ${
                      isExpanded ? "bg-[#faf3d0]" : "hover:bg-[rgba(250,243,208,0.3)]"
                    } transition-colors cursor-pointer`}
                    onClick={() => setExpanded(isExpanded ? null : i)}
                  >
                    {/* Timestamp */}
                    <div className="px-6 py-5">
                      <p className="text-sm font-medium text-[#1d1c0d] font-body">
                        {ts ? ts.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </p>
                      <p className="text-xs text-[#564337] font-body">
                        {ts ? ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
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
                        {initials}
                      </div>
                      <span className="text-sm font-medium text-[#1d1c0d] font-body truncate">
                        {actorId || t("system")}
                      </span>
                    </div>

                    {/* Target */}
                    <div className="px-6 py-5">
                      <span className="inline-block bg-[#f8f4db] text-[#1d1c0d] px-2 py-0.5 rounded-[16px] text-xs font-mono-custom">
                        {targetId ? targetId.slice(0, 12) + (targetId.length > 12 ? "..." : "") : "—"}
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

            {/* Pagination */}
            <div className="bg-[rgba(237,233,207,0.3)] border-t border-[rgba(220,193,177,0.1)] px-6 py-4 flex items-center justify-between">
              <p className="text-xs text-[#564337] font-body">
                {t("showing_range", {startItem: String(startItem), endItem: String(endItem), total: String(total.toLocaleString())})}
              </p>
              <div className="flex items-center gap-2">
                <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  ‹
                </PageBtn>
                {pageNumbers(page, totalPages).map((n, i) =>
                  n === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-[#897365] font-body">...</span>
                  ) : (
                    <PageBtn
                      key={n}
                      onClick={() => setPage(Number(n))}
                      active={Number(n) === page}
                    >
                      {n}
                    </PageBtn>
                  )
                )}
                <PageBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  ›
                </PageBtn>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Expanded JSON view (when nothing expanded) */}
      {expanded === null && entries.length > 0 && (
        <div className="bg-[#f8f4db] rounded-[48px] p-8 border border-[rgba(220,193,177,0.2)] space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-[#a23f00] rounded-[48px] flex items-center justify-center">
              <span className="text-white text-lg">📄</span>
            </div>
            <div>
              <h3 className="font-bold font-heading text-[#1d1c0d] text-lg">{t("metadata_insight")}</h3>
              <p className="text-sm text-[#564337] font-body">{t("click_row_hint")}</p>
            </div>
          </div>
        </div>
      )}
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
