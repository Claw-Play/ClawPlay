"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useT } from "@/lib/i18n/context";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "@/components/icons";
import { formatTs } from "@/lib/timestamp";

const panelClassName =
  "rounded-xl border border-[#eadfc8] bg-[radial-gradient(circle_at_top,_rgba(250,244,228,0.92),_rgba(255,252,246,0.98)_38%,_rgba(250,246,237,0.98)_100%)] shadow-[0_18px_44px_rgba(86,67,55,0.08)]";
const headerCellClassName =
  "px-3 py-2 text-[15px] font-semibold uppercase text-black";
const bodyCellClassName = "px-3 py-2.5 align-middle";
const filterControlClassName =
  "rounded-full border border-[#eadfc8] bg-[#fffdf8] px-4 py-2.5 text-sm text-[#5f493a] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_20px_rgba(86,67,55,0.05)] transition-colors focus:border-[#d8b07d] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/15";
const menuClassName =
  "absolute left-0 top-full z-20 mt-2 min-w-[160px] rounded-[18px] border border-[#eadfc8] bg-[linear-gradient(180deg,#fffdf8_0%,#f7efe1_100%)] p-1 shadow-[0_16px_34px_rgba(86,67,55,0.16)] backdrop-blur-sm";
const menuItemClassName =
  "flex min-h-[30px] w-full items-center justify-between rounded-xl px-2.5 py-1 text-left text-xs font-semibold transition-colors";

const EVENT_OPTIONS = [
  { value: "", label: "all_events" },
  { value: "user.register", label: "user.register" },
  { value: "user.login", label: "user.login" },
  { value: "skill.view", label: "skill.view" },
  { value: "skill.submit", label: "skill.submit" },
  { value: "skill.approve", label: "skill.approve" },
  { value: "skill.reject", label: "skill.reject" },
  { value: "skill.download", label: "skill.download" },
  { value: "quota.check", label: "token.check" },
  { value: "quota.use", label: "token.use" },
  { value: "quota.exceeded", label: "token.exceeded" },
  { value: "quota.error", label: "token.error" },
  { value: "token.generate", label: "token.generate" },
  { value: "token.revoke", label: "token.revoke" },
];

const TARGET_TYPE_OPTIONS = [
  { value: "", label: "all_types" },
  { value: "skill", label: "skill" },
  { value: "user", label: "user" },
  { value: "token", label: "token" },
  { value: "quota", label: "quota" },
  { value: "ability", label: "ability" },
];

interface EventRecord {
  id: number;
  event: string;
  user_id: number | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: number;
}

function datetimeLocalToTimestamp(value: string): string {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? "" : String(timestamp);
}

export default function EventsClient() {
  const t = useT("admin");
  const eventMenuRef = useRef<HTMLDivElement | null>(null);
  const targetTypeMenuRef = useRef<HTMLDivElement | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventFilter, setEventFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [targetIdFilter, setTargetIdFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [isEventMenuOpen, setIsEventMenuOpen] = useState(false);
  const [isTargetTypeMenuOpen, setIsTargetTypeMenuOpen] = useState(false);
  const limit = 50;

  const fetchEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (eventFilter) params.set("event", eventFilter);
    if (userIdFilter) params.set("user_id", userIdFilter);
    if (targetTypeFilter) params.set("target_type", targetTypeFilter);
    if (targetIdFilter) params.set("target_id", targetIdFilter);
    const fromTimestamp = datetimeLocalToTimestamp(fromFilter);
    const toTimestamp = datetimeLocalToTimestamp(toFilter);
    if (fromTimestamp) params.set("from", fromTimestamp);
    if (toTimestamp) params.set("to", toTimestamp);
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    fetch(`/api/admin/analytics/events?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setEvents(d.events ?? []);
        setTotal(d.pagination?.total ?? 0);
      })
      .catch(() => setError(t("events_load_err")))
      .finally(() => setLoading(false));
  }, [eventFilter, userIdFilter, targetTypeFilter, targetIdFilter, fromFilter, toFilter, offset, t]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (!isEventMenuOpen && !isTargetTypeMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!eventMenuRef.current?.contains(target)) setIsEventMenuOpen(false);
      if (!targetTypeMenuRef.current?.contains(target)) setIsTargetTypeMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsEventMenuOpen(false);
        setIsTargetTypeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isEventMenuOpen, isTargetTypeMenuOpen]);

  function resetFilters() {
    setEventFilter("");
    setUserIdFilter("");
    setTargetTypeFilter("");
    setTargetIdFilter("");
    setFromFilter("");
    setToFilter("");
    setOffset(0);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const currentEventLabel =
    t(EVENT_OPTIONS.find((option) => option.value === eventFilter)?.label ?? "all_events");
  const currentTargetTypeLabel =
    t(TARGET_TYPE_OPTIONS.find((option) => option.value === targetTypeFilter)?.label ?? "all_types");

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className={panelClassName}>
        <div className="flex flex-col items-stretch gap-3 px-4 py-3 md:flex-row md:flex-wrap md:items-center">
          <div ref={eventMenuRef} className="relative">
            <button
              type="button"
              onClick={() => { setIsEventMenuOpen((prev) => !prev); setIsTargetTypeMenuOpen(false); }}
              className={`${filterControlClassName} inline-flex w-full min-w-0 items-center justify-between gap-3 md:min-w-[140px]`}
              style={{ fontFamily: "var(--font-vietnam)" }}
              aria-haspopup="menu"
              aria-expanded={isEventMenuOpen}
            >
              <span className="truncate">{currentEventLabel}</span>
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#f3e6d0] text-[#a23f00] transition-transform ${isEventMenuOpen ? "rotate-180" : ""}`}>
                <ChevronDownIcon className="w-3 h-3" />
              </span>
            </button>
            {isEventMenuOpen && (
              <div className={menuClassName}>
                {EVENT_OPTIONS.map((option) => {
                  const selected = option.value === eventFilter;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => { setEventFilter(option.value); setOffset(0); setIsEventMenuOpen(false); }}
                      className={`${menuItemClassName} ${selected ? "bg-[#eee0c9] text-[#75563f]" : "text-[#8d745e] hover:bg-[#f5ede0] hover:text-[#a23f00]"}`}
                      style={{ fontFamily: "var(--font-vietnam)" }}
                      role="menuitemradio"
                      aria-checked={selected}
                    >
                      <span className="truncate">{t(option.label)}</span>
                      <span className={`ml-3 inline-flex h-4 w-4 items-center justify-center ${selected ? "text-[#a23f00]" : "text-transparent"}`}>
                        <CheckIcon className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <input
            type="text"
            inputMode="numeric"
            placeholder={t("user_id")}
            value={userIdFilter}
            onChange={(e) => { setUserIdFilter(e.target.value); setOffset(0); }}
            className={`${filterControlClassName} w-full md:w-28`}
            style={{ fontFamily: "var(--font-vietnam)" }}
          />

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#ae9a7d] sm:flex-row sm:items-center">
            {t("col_time_from")}
            <input
              type="datetime-local"
              value={fromFilter}
              onChange={(e) => { setFromFilter(e.target.value); setOffset(0); }}
              max={toFilter || undefined}
              className={`${filterControlClassName} w-full sm:w-[180px]`}
              style={{ fontFamily: "var(--font-vietnam)" }}
              aria-label="From date and time"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#ae9a7d] sm:flex-row sm:items-center">
            {t("col_time_to")}
            <input
              type="datetime-local"
              value={toFilter}
              onChange={(e) => { setToFilter(e.target.value); setOffset(0); }}
              min={fromFilter || undefined}
              className={`${filterControlClassName} w-full sm:w-[180px]`}
              style={{ fontFamily: "var(--font-vietnam)" }}
              aria-label="To date and time"
            />
          </label>

          <div ref={targetTypeMenuRef} className="relative">
            <button
              type="button"
              onClick={() => { setIsTargetTypeMenuOpen((prev) => !prev); setIsEventMenuOpen(false); }}
              className={`${filterControlClassName} inline-flex w-full min-w-0 items-center justify-between gap-3 md:min-w-[120px]`}
              style={{ fontFamily: "var(--font-vietnam)" }}
              aria-haspopup="menu"
              aria-expanded={isTargetTypeMenuOpen}
            >
              <span className="truncate">{currentTargetTypeLabel}</span>
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#f3e6d0] text-[#a23f00] transition-transform ${isTargetTypeMenuOpen ? "rotate-180" : ""}`}>
                <ChevronDownIcon className="w-3 h-3" />
              </span>
            </button>
            {isTargetTypeMenuOpen && (
              <div className={menuClassName}>
                {TARGET_TYPE_OPTIONS.map((option) => {
                  const selected = option.value === targetTypeFilter;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => { setTargetTypeFilter(option.value); setOffset(0); setIsTargetTypeMenuOpen(false); }}
                      className={`${menuItemClassName} ${selected ? "bg-[#eee0c9] text-[#75563f]" : "text-[#8d745e] hover:bg-[#f5ede0] hover:text-[#a23f00]"}`}
                      style={{ fontFamily: "var(--font-vietnam)" }}
                      role="menuitemradio"
                      aria-checked={selected}
                    >
                      <span className="truncate">{t(option.label)}</span>
                      <span className={`ml-3 inline-flex h-4 w-4 items-center justify-center ${selected ? "text-[#a23f00]" : "text-transparent"}`}>
                        <CheckIcon className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <input
            type="text"
            inputMode="numeric"
            placeholder={t("filter_target_id")}
            value={targetIdFilter}
            onChange={(e) => { setTargetIdFilter(e.target.value); setOffset(0); }}
            className={`${filterControlClassName} w-full md:w-28`}
            style={{ fontFamily: "var(--font-vietnam)" }}
          />

          <button
            onClick={resetFilters}
            className="rounded-full border border-[#eadfc8] bg-[#fffdf8] px-4 py-2.5 text-sm text-[#8c745e] shadow-[0_8px_20px_rgba(86,67,55,0.05)] transition-colors hover:bg-[#f7f0e3] sm:self-start"
            style={{ fontFamily: "var(--font-vietnam)" }}
          >
            {t("pagination_reset")}
          </button>

          <span className="ml-auto text-[11px] font-semibold uppercase text-black/40">
            {t("events_total", { count: total.toLocaleString() })}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className={`${panelClassName} min-h-[1500px] overflow-hidden`}>
        {loading && events.length === 0 ? (
          <div className="p-10 text-center font-body text-black/40 animate-pulse">{t("loading")}</div>
        ) : error && events.length === 0 ? (
          <div className="p-10 text-center font-body text-red-600">{error}</div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center font-body text-black/40">{t("no_events")}</div>
        ) : (
          <>
            <div className="grid gap-3 px-4 py-4 md:hidden">
              {events.map((e, i) => (
                <article key={e.id} className="rounded-[24px] border border-[#eadfc8] bg-white/90 p-4 shadow-[0_8px_20px_rgba(86,67,55,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/35">
                        {(offset + i + 1).toLocaleString()}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-black [font-variant-numeric:tabular-nums]">
                        {formatTs(e.created_at)}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black">
                      {e.event}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl bg-[#faf3d0] px-3 py-2">
                      <p className="text-black/40">{t("col_user")}</p>
                      <p className="mt-1 font-semibold text-black [font-variant-numeric:tabular-nums]">
                        {e.user_id ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#faf3d0] px-3 py-2">
                      <p className="text-black/40">{t("col_type")}</p>
                      <p className="mt-1 font-semibold text-black">
                        {e.target_type ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#faf3d0] px-3 py-2">
                      <p className="text-black/40">{t("col_target")}</p>
                      <p className="mt-1 truncate font-semibold text-black">
                        {e.target_id ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#faf3d0] px-3 py-2">
                      <p className="text-black/40">{t("col_metadata")}</p>
                      <p className="mt-1 truncate font-semibold text-black/70">
                        {JSON.stringify(e.metadata).slice(0, 24)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="relative hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] table-fixed text-sm font-body">
              <colgroup>
                <col className="w-[72px]" />
                <col className="w-[176px]" />
                <col className="w-[180px]" />
                <col className="w-[112px]" />
                <col className="w-[112px]" />
                <col className="w-[144px]" />
                <col className="w-[184px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[#e6dac2] bg-[linear-gradient(180deg,rgba(255,252,246,0.96),rgba(249,243,232,0.96))] text-left">
                  <th className="pl-5 pr-3 py-2 text-[15px] font-semibold uppercase text-black">ID</th>
                  <th className={headerCellClassName}>{t("col_time")}</th>
                  <th className={headerCellClassName}>{t("col_event")}</th>
                  <th className={headerCellClassName}>{t("col_user")}</th>
                  <th className={headerCellClassName}>{t("col_type")}</th>
                  <th className={headerCellClassName}>{t("col_target")}</th>
                  <th className={headerCellClassName}>{t("col_metadata")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e.id} className="border-b border-[#efe4cf] transition-colors hover:bg-[linear-gradient(90deg,rgba(248,241,226,0.75),rgba(255,252,246,0.15))]">
                    <td className="pl-5 pr-3 py-2.5 whitespace-nowrap text-[14px] font-semibold text-black [font-variant-numeric:tabular-nums]">
                      {(offset + i + 1).toLocaleString()}
                    </td>
                    <td className={`${bodyCellClassName} whitespace-nowrap text-[14px] font-semibold text-black [font-variant-numeric:tabular-nums]`}>
                      {formatTs(e.created_at)}
                    </td>
                    <td className={bodyCellClassName}>
                      <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-black">
                        {e.event}
                      </span>
                    </td>
                    <td className={`${bodyCellClassName} text-[14px] font-semibold text-black`}>
                      {e.user_id ?? <span className="text-black/40">—</span>}
                    </td>
                    <td className={`${bodyCellClassName} text-[14px] font-semibold text-black`}>
                      {e.target_type ?? <span className="text-black/40">—</span>}
                    </td>
                    <td className={`${bodyCellClassName} max-w-[120px] truncate text-[14px] font-semibold text-black`}>
                      {e.target_id ?? <span className="text-black/40">—</span>}
                    </td>
                    <td
                      className={`${bodyCellClassName} max-w-[200px] truncate text-[14px] font-semibold text-black/60`}
                      title={JSON.stringify(e.metadata, null, 2)}
                    >
                      {JSON.stringify(e.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && (
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.24),rgba(247,240,226,0.14))] backdrop-blur-[1px]">
                <div className="absolute inset-x-6 top-6 h-px bg-[linear-gradient(90deg,transparent,rgba(0,0,0,0.18),transparent)] animate-pulse" />
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-body text-black shadow-[0_8px_20px_rgba(86,67,55,0.06)] transition-colors hover:bg-black/5 disabled:opacity-40"
          >
            <ChevronLeftIcon className="w-3 h-3" /> {t("pagination_prev")}
          </button>
          <span className="px-4 text-[11px] font-semibold uppercase text-black/40">
            {t("pagination_status", { current: String(currentPage), total: String(totalPages) })}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-body text-black shadow-[0_8px_20px_rgba(86,67,55,0.06)] transition-colors hover:bg-black/5 disabled:opacity-40"
          >
            {t("pagination_next")} <ChevronRightIcon className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
