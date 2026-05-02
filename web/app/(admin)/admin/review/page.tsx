"use client";

import { useCallback, useDeferredValue, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import { usePendingCount } from "@/lib/context/PendingCountContext";
import { CheckIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "@/components/icons";

interface Skill {
  id: string;
  slug: string;
  name: string;
  summary: string;
  authorName: string;
  authorEmail: string;
  iconEmoji: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

function timeAgo(dateStr: string, t: (key: string, values?: Record<string, string | number>) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return t("minutes_ago", { n: String(minutes) });
  if (hours < 24) return t("hours_ago", { n: String(hours) });
  if (days === 1) return t("yesterday");
  if (days < 7) return t("days_ago", { n: String(days) });
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function LoadingState({ tCommon }: { tCommon: (key: string) => string }) {
  return (
    <div className="mx-auto max-w-[1240px] space-y-5 px-4 sm:px-6">
      <div className="h-12 w-full animate-pulse rounded-full border border-[#dbe5f7] bg-white" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[24px] border border-[#dbe5f7] bg-white px-4 py-5 shadow-[0_12px_28px_rgba(25,43,87,0.04)]"
          >
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-[#edf4ff]" />
            <div className="mt-3 h-3 w-2/3 animate-pulse rounded-full bg-[#f0f6ff]" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-[#f0f6ff]" />
          </div>
        ))}
      </div>
      <div className="text-center text-sm text-[#7c879f]">{tCommon("loading")}</div>
    </div>
  );
}

export default function AdminReviewPage() {
  const t = useT("admin_review");
  const tCommon = useT("common");
  const { decrement } = usePendingCount();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refreshPending = useCallback(async (targetPage: number, targetSearch: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((targetPage - 1) * PAGE_SIZE),
    });
    if (targetSearch.trim()) params.set("search", targetSearch.trim());

    const res = await fetch(`/api/admin/skills?${params}`, signal ? { signal } : undefined);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(data.error ?? "Failed to load pending skills.");
    }

    setSkills(Array.isArray(data.skills) ? data.skills : []);
    setTotal(typeof data.pagination?.total === "number" ? data.pagination.total : 0);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    refreshPending(page, deferredSearch, controller.signal)
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load pending skills.");
          setSkills([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [deferredSearch, page, refreshPending]);

  useEffect(() => {
    if (loading) return;
    if (total === 0 && page !== 1) {
      setPage(1);
      return;
    }
    if (total > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, page, total, totalPages]);

  async function approve(skillId: string) {
    setActioningId(skillId);
    try {
      const res = await fetch(`/api/admin/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        decrement();
        await refreshPending(page, deferredSearch);
      }
    } finally {
      setActioningId(null);
    }
  }

  function openReject(skillId: string) {
    setRejectId(skillId);
    setRejectReason("");
  }

  async function confirmReject() {
    if (!rejectId) return;
    setActioningId(rejectId);
    try {
      const res = await fetch(`/api/admin/skills/${rejectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason }),
      });
      if (res.ok) {
        decrement();
        setRejectId(null);
        setRejectReason("");
        await refreshPending(page, deferredSearch);
      }
    } finally {
      setActioningId(null);
    }
  }

  if (loading && skills.length === 0) {
    return <LoadingState tCommon={tCommon} />;
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-5 px-4 sm:px-6">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8aa0cb]">
          <SearchIcon className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("search_placeholder")}
          className="h-12 w-full rounded-full border border-[#dbe5f7] bg-white pl-12 pr-4 text-[14px] text-[#15213b] placeholder:text-[#98a3bc] outline-none transition focus:border-[#2d67f7] focus:ring-2 focus:ring-[#2d67f7]/15"
        />
      </div>

      {error && (
        <div className="rounded-[20px] border border-[#f2c6c6] bg-[#fff5f5] px-4 py-3 text-sm text-[#b42318]">
          {error}
        </div>
      )}

      {skills.length === 0 ? (
        <div className="rounded-[28px] border border-[#dbe5f7] bg-white px-6 py-12 text-center shadow-[0_14px_32px_rgba(25,43,87,0.05)]">
          <div className="text-5xl">🌿</div>
          <h3 className="mt-4 text-[18px] font-semibold text-[#1f2b45]">{t("all_clear")}</h3>
          <p className="mt-2 text-[14px] text-[#7c879f]">{t("no_pending")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => {
            const isLoading = actioningId === skill.id;
            return (
              <article
                key={skill.id}
                className="rounded-[24px] border border-[#dbe5f7] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(25,43,87,0.04)] sm:px-5 sm:py-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-[16px] font-semibold text-[#15213b]">{skill.name}</h3>
                      <span className="rounded-full bg-[#edf4ff] px-2.5 py-1 text-[11px] font-semibold text-[#2d67f7]">
                        {t("status_new")}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-[#6d7891]">
                      {t("submitted_by")}{" "}
                      <span className="font-medium text-[#394766]">
                        {skill.authorName || skill.authorEmail?.split("@")[0] || t("unknown")}
                      </span>{" "}
                      · {timeAgo(skill.createdAt, t)}
                    </p>
                    {skill.summary && (
                      <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#7c879f] line-clamp-2">
                        {skill.summary}
                      </p>
                    )}
                  </div>

                  {rejectId !== skill.id ? (
                    <div className="flex items-center gap-2 self-start md:self-center">
                      <Link
                        href={`/admin/review/${skill.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-[#bfd0f4] bg-white px-4 text-[13px] font-medium text-[#2d67f7] transition-colors hover:bg-[#f7faff]"
                      >
                        {t("view_details")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => openReject(skill.id)}
                        disabled={isLoading}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe5f7] bg-white text-[#7c879f] transition-colors hover:border-[#ffd2d2] hover:bg-[#fff5f5] hover:text-[#ef4444] disabled:opacity-50"
                        title={t("reject")}
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => approve(skill.id)}
                        disabled={isLoading}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe5f7] bg-[#edf4ff] text-[#2d67f7] transition-colors hover:bg-[#dbe9ff] disabled:opacity-50"
                        title={t("approve")}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[340px]">
                      <textarea
                        placeholder={t("reject_reason_placeholder")}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        className="w-full rounded-[18px] border border-[#dbe5f7] bg-[#f7faff] px-4 py-3 text-[14px] text-[#15213b] placeholder:text-[#98a3bc] outline-none transition focus:border-[#2d67f7] focus:ring-2 focus:ring-[#2d67f7]/15"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectId(null);
                            setRejectReason("");
                          }}
                          className="h-10 rounded-full border border-[#dbe5f7] bg-white px-4 text-[13px] font-medium text-[#5f6c86] transition-colors hover:bg-[#f7faff]"
                        >
                          {tCommon("cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={confirmReject}
                          disabled={isLoading || !rejectReason.trim()}
                          className="h-10 rounded-full bg-[#ef4444] px-4 text-[13px] font-medium text-white shadow-[0_10px_20px_rgba(239,68,68,0.18)] transition-colors hover:bg-[#dc2626] disabled:opacity-50"
                        >
                          {isLoading ? "..." : tCommon("confirm")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[#7c879f]">
            {t("paginate_showing", {
              start: String((page - 1) * PAGE_SIZE + 1),
              end: String(Math.min(page * PAGE_SIZE, total)),
              total: String(total),
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe5f7] bg-white text-[#2d67f7] transition-colors hover:bg-[#f7faff] disabled:opacity-40"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>

            <span className="px-2 text-[13px] text-[#7c879f]">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe5f7] bg-white text-[#2d67f7] transition-colors hover:bg-[#f7faff] disabled:opacity-40"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
