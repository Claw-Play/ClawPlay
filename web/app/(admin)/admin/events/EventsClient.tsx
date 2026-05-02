"use client";
import { useState, useEffect, useRef } from "react";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { CustomProvider, DateRangePicker, type DateRange } from "rsuite";
import enUS from "rsuite/locales/en_US";
import zhCN from "rsuite/locales/zh_CN";
import { useLocale, useT } from "@/lib/i18n/context";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "@/components/icons";
import { formatTs, toUnixSec } from "@/lib/timestamp";

const panelClassName =
  "rounded-[8px] border border-[#dbe5f7] bg-white shadow-[0_12px_32px_rgba(25,43,87,0.04)]";
const headerCellClassName =
  "px-3 py-3 text-[13px] font-semibold text-[#15213b]";
const bodyCellClassName = "px-3 py-2.5 align-middle";
const filterControlClassName =
  "flex h-12 items-center rounded-[10px] border border-[#dbe5f7] bg-white px-4 text-[14px] font-medium text-[#15213b] shadow-[0_8px_20px_rgba(25,43,87,0.03)] transition-colors focus:border-[#2d67f7] focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/15 placeholder:text-[#7c879f]";
const menuClassName =
  "absolute left-0 top-full z-20 mt-2 min-w-[160px] rounded-[10px] border border-[#dbe5f7] bg-white p-1 shadow-[0_16px_34px_rgba(25,43,87,0.12)] backdrop-blur-sm";
const menuItemClassName =
  "flex min-h-[30px] w-full items-center justify-between rounded-[8px] px-2.5 py-1 text-left text-xs font-semibold transition-colors";

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

function buildRangeQuery(value: DateRange | null) {
  if (!value) return null;

  const [start, end] = value;
  return [toUnixSec(startOfDay(start).getTime()), toUnixSec(endOfDay(end).getTime())] as const;
}

function buildPresetRanges(locale: string) {
  const isZh = locale === "zh";
  const nowLabel = isZh ? "今天" : "Today";
  const lastDaysLabel = (days: number) => (isZh ? `近${days}天` : `Last ${days} days`);

  const buildDayRange = (days: number): DateRange => {
    const anchor = new Date();
    const start = days <= 1 ? startOfDay(anchor) : startOfDay(subDays(anchor, days - 1));
    return [start, endOfDay(anchor)];
  };

  return [
    { label: nowLabel, value: () => buildDayRange(1), closeOverlay: true },
    { label: lastDaysLabel(2), value: () => buildDayRange(2), closeOverlay: true },
    { label: lastDaysLabel(7), value: () => buildDayRange(7), closeOverlay: true },
    { label: lastDaysLabel(14), value: () => buildDayRange(14), closeOverlay: true },
    { label: lastDaysLabel(30), value: () => buildDayRange(30), closeOverlay: true },
  ];
}

export default function EventsClient() {
  const t = useT("admin");
  const { locale } = useLocale();
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
  const [timeRange, setTimeRange] = useState<DateRange | null>(() => {
    const now = new Date();
    return [startOfDay(now), endOfDay(now)];
  });
  const [offset, setOffset] = useState(0);
  const [isEventMenuOpen, setIsEventMenuOpen] = useState(false);
  const [isTargetTypeMenuOpen, setIsTargetTypeMenuOpen] = useState(false);
  const limit = 50;
  const loadErrorText = t("events_load_err");
  const rsuiteLocale = locale === "zh" ? zhCN.DateRangePicker : enUS.DateRangePicker;
  const rangePresets = buildPresetRanges(locale);
  const rangeFormat = "yyyy-MM-dd";
  const rangePlaceholder = locale === "zh" ? "请选择时间范围" : "Select date range";

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (eventFilter) params.set("event", eventFilter);
    if (userIdFilter) params.set("user_id", userIdFilter);
    if (targetTypeFilter) params.set("target_type", targetTypeFilter);
    if (targetIdFilter) params.set("target_id", targetIdFilter);
    const rangeQuery = buildRangeQuery(timeRange);
    if (rangeQuery) {
      params.set("from", String(rangeQuery[0]));
      params.set("to", String(rangeQuery[1]));
    }
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    fetch(`/api/admin/analytics/events?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (controller.signal.aborted) return;
        if (d.error) {
          setError(d.error);
          return;
        }
        setEvents(d.events ?? []);
        setTotal(d.pagination?.total ?? 0);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err?.name !== "AbortError") setError(loadErrorText);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [eventFilter, userIdFilter, targetTypeFilter, targetIdFilter, timeRange, offset, limit, loadErrorText]);

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
    const now = new Date();
    setTimeRange([startOfDay(now), endOfDay(now)]);
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
        <div className="flex flex-col items-stretch gap-3 px-4 py-3 md:flex-row md:flex-nowrap md:items-center">
          <div ref={eventMenuRef} className="relative">
            <button
              type="button"
              onClick={() => { setIsEventMenuOpen((prev) => !prev); setIsTargetTypeMenuOpen(false); }}
              className={`${filterControlClassName} w-full min-w-0 justify-between gap-3 md:w-[160px] lg:w-[170px] ${
                eventFilter ? "text-[#15213b]" : "text-[#7c879f]"
              }`}
              style={{ fontFamily: "var(--font-vietnam)" }}
              aria-haspopup="menu"
              aria-expanded={isEventMenuOpen}
            >
              <span className="truncate">{currentEventLabel}</span>
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#edf4ff] text-[#2d67f7] transition-transform ${isEventMenuOpen ? "rotate-180" : ""}`}>
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
                      className={`${menuItemClassName} ${selected ? "bg-[#edf4ff] text-[#2d67f7]" : "text-[#52617d] hover:bg-[#f7faff] hover:text-[#2d67f7]"}`}
                      style={{ fontFamily: "var(--font-vietnam)" }}
                      role="menuitemradio"
                      aria-checked={selected}
                    >
                      <span className="truncate">{t(option.label)}</span>
                      <span className={`ml-3 inline-flex h-4 w-4 items-center justify-center ${selected ? "text-[#2d67f7]" : "text-transparent"}`}>
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
            className={`${filterControlClassName} w-full min-w-0 md:w-[120px]`}
            style={{ fontFamily: "var(--font-vietnam)" }}
          />

          <div className="flex w-full min-w-0 flex-col gap-2 md:w-[220px] lg:w-[240px] xl:w-[260px] md:flex-none">
            <div className="min-w-0 w-full">
              <CustomProvider locale={locale === "zh" ? zhCN : enUS}>
                <DateRangePicker
                  block
                  className="events-range-picker"
                  popupClassName="events-range-picker-popup"
                  cleanable
                  size="lg"
                  editable={false}
                  format={rangeFormat}
                  locale={rsuiteLocale}
                  placeholder={rangePlaceholder}
                  character=" - "
                  ranges={rangePresets}
                  showHeader={false}
                  showMeridiem={false}
                  showOneCalendar={false}
                  placement="bottomStart"
                  value={timeRange}
                  onChange={(nextValue) => {
                    setTimeRange(nextValue ?? null);
                    setOffset(0);
                  }}
                  onClean={() => {
                    setTimeRange(null);
                    setOffset(0);
                  }}
                  style={{ fontFamily: "var(--font-vietnam)" }}
                />
              </CustomProvider>
            </div>
          </div>

          <div ref={targetTypeMenuRef} className="relative">
            <button
              type="button"
              onClick={() => { setIsTargetTypeMenuOpen((prev) => !prev); setIsEventMenuOpen(false); }}
              className={`${filterControlClassName} w-full min-w-0 justify-between gap-3 md:w-[130px] lg:w-[140px] ${
                targetTypeFilter ? "text-[#15213b]" : "text-[#7c879f]"
              }`}
              style={{ fontFamily: "var(--font-vietnam)" }}
              aria-haspopup="menu"
              aria-expanded={isTargetTypeMenuOpen}
            >
              <span className="truncate">{currentTargetTypeLabel}</span>
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#edf4ff] text-[#2d67f7] transition-transform ${isTargetTypeMenuOpen ? "rotate-180" : ""}`}>
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
                      className={`${menuItemClassName} ${selected ? "bg-[#edf4ff] text-[#2d67f7]" : "text-[#52617d] hover:bg-[#f7faff] hover:text-[#2d67f7]"}`}
                      style={{ fontFamily: "var(--font-vietnam)" }}
                      role="menuitemradio"
                      aria-checked={selected}
                    >
                      <span className="truncate">{t(option.label)}</span>
                      <span className={`ml-3 inline-flex h-4 w-4 items-center justify-center ${selected ? "text-[#2d67f7]" : "text-transparent"}`}>
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
            className={`${filterControlClassName} w-full min-w-0 md:w-[120px]`}
            style={{ fontFamily: "var(--font-vietnam)" }}
          />

          <button
            onClick={resetFilters}
            className="inline-flex h-12 w-full shrink-0 items-center rounded-[10px] border border-[#dbe5f7] bg-white px-4 text-[14px] font-medium text-[#52617d] shadow-[0_8px_20px_rgba(25,43,87,0.03)] transition-colors hover:bg-[#f7faff] md:w-auto md:self-auto"
            style={{ fontFamily: "var(--font-vietnam)" }}
          >
            {t("pagination_reset")}
          </button>

          <span className="ml-auto shrink-0 whitespace-nowrap text-[12px] font-medium text-[#6d7891]">
            {t("events_total", { count: total.toLocaleString() })}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className={`${panelClassName} min-h-[1500px] overflow-hidden`}>
        {loading && events.length === 0 ? (
          <div className="p-10 text-center font-body text-[#7c879f] animate-pulse">{t("loading")}</div>
        ) : error && events.length === 0 ? (
          <div className="p-10 text-center font-body text-red-600">{error}</div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center font-body text-[#7c879f]">{t("no_events")}</div>
        ) : (
          <>
            <div className="grid gap-3 px-4 py-4 md:hidden">
              {events.map((e, i) => (
                <article key={e.id} className="rounded-[12px] border border-[#dbe5f7] bg-white p-4 shadow-[0_8px_20px_rgba(25,43,87,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7c879f]">
                        {(offset + i + 1).toLocaleString()}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#15213b] [font-variant-numeric:tabular-nums]">
                        {formatTs(e.created_at)}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-[#dbe5f7] bg-[#edf4ff] px-2.5 py-1 text-[11px] font-semibold text-[#2d67f7]">
                      {e.event}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-[10px] bg-[#f7faff] px-3 py-2">
                      <p className="text-[#7c879f]">{t("col_user")}</p>
                      <p className="mt-1 font-semibold text-[#15213b] [font-variant-numeric:tabular-nums]">
                        {e.user_id ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-[10px] bg-[#f7faff] px-3 py-2">
                      <p className="text-[#7c879f]">{t("col_type")}</p>
                      <p className="mt-1 font-semibold text-[#2d67f7]">
                        {e.target_type ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-[10px] bg-[#f7faff] px-3 py-2">
                      <p className="text-[#7c879f]">{t("col_target")}</p>
                      <p className="mt-1 truncate font-semibold text-[#2d67f7]">
                        {e.target_id ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-[10px] bg-[#f7faff] px-3 py-2">
                      <p className="text-[#7c879f]">{t("col_metadata")}</p>
                      <p className="mt-1 truncate font-semibold text-[#52617d]">
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
                <tr className="border-b border-[#dbe5f7] bg-[#fbfdff] text-left">
                  <th className="pl-5 pr-3 py-3 text-[13px] font-semibold text-[#15213b]">ID</th>
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
                  <tr key={e.id} className="border-b border-[#e8eef8] transition-colors hover:bg-[#f7faff]">
                    <td className="pl-5 pr-3 py-2.5 whitespace-nowrap text-[14px] font-semibold text-[#15213b] [font-variant-numeric:tabular-nums]">
                      {(offset + i + 1).toLocaleString()}
                    </td>
                    <td className={`${bodyCellClassName} whitespace-nowrap text-[14px] font-semibold text-[#15213b] [font-variant-numeric:tabular-nums]`}>
                      {formatTs(e.created_at)}
                    </td>
                    <td className={bodyCellClassName}>
                      <span className="inline-flex items-center rounded-full border border-[#dbe5f7] bg-[#edf4ff] px-2.5 py-1 text-[11px] font-semibold text-[#2d67f7]">
                        {e.event}
                      </span>
                    </td>
                    <td className={`${bodyCellClassName} text-[14px] font-semibold text-[#15213b]`}>
                      {e.user_id ?? <span className="text-[#7c879f]">—</span>}
                    </td>
                    <td className={`${bodyCellClassName} text-[14px] font-semibold text-[#15213b]`}>
                      {e.target_type ?? <span className="text-[#7c879f]">—</span>}
                    </td>
                    <td className={`${bodyCellClassName} max-w-[120px] truncate text-[14px] font-semibold text-[#15213b]`}>
                      {e.target_id ?? <span className="text-[#7c879f]">—</span>}
                    </td>
                    <td
                      className={`${bodyCellClassName} max-w-[200px] truncate text-[14px] font-semibold text-[#52617d]`}
                      title={JSON.stringify(e.metadata, null, 2)}
                    >
                      {JSON.stringify(e.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && (
              <div className="pointer-events-none absolute inset-0 bg-white/45 backdrop-blur-[1px]">
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
            className="inline-flex items-center gap-1 rounded-[8px] border border-[#dbe5f7] bg-white px-4 py-2 text-sm font-body text-[#52617d] shadow-[0_8px_20px_rgba(25,43,87,0.04)] transition-colors hover:bg-[#f7faff] disabled:opacity-40"
          >
            <ChevronLeftIcon className="w-3 h-3" /> {t("pagination_prev")}
          </button>
          <span className="px-4 text-[12px] font-medium text-[#6d7891]">
            {t("pagination_status", { current: String(currentPage), total: String(totalPages) })}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            className="inline-flex items-center gap-1 rounded-[8px] border border-[#dbe5f7] bg-white px-4 py-2 text-sm font-body text-[#52617d] shadow-[0_8px_20px_rgba(25,43,87,0.04)] transition-colors hover:bg-[#f7faff] disabled:opacity-40"
          >
            {t("pagination_next")} <ChevronRightIcon className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
