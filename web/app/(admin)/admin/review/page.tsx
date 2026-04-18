"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

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

function SkillRow({
  skill,
  onApprove,
  onReject,
  actioningId,
  rejectId,
  rejectReason,
  onReasonChange,
  onConfirmReject,
  onCancelReject,
  t,
}: {
  skill: Skill;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  actioningId: string | null;
  rejectId: string | null;
  rejectReason: string;
  onReasonChange: (v: string) => void;
  onConfirmReject: () => void;
  onCancelReject: () => void;
  t: (key: string) => string;
}) {
  const isLoading = actioningId === skill.id;

  return (
    <div className="bg-[#f8f4db] flex gap-6 items-center px-6 py-6 rounded-[32px] transition-all">
      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h3
            className="font-bold text-[18px] text-[#1d1c0d] whitespace-nowrap"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            {skill.name}
          </h3>
          <span className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-[#ffdbcd] text-[#351000]">
            {t("status_new")}
          </span>
        </div>
        <p className="text-[14px] text-[#564337]" style={{ fontFamily: "var(--font-vietnam)" }}>
          {t("submitted_by")}{" "}
          <span className="font-semibold">
            {skill.authorName || skill.authorEmail?.split("@")[0] || t("unknown")}
          </span>{" "}
          • {timeAgo(skill.createdAt, t)}
        </p>
        {skill.summary && (
          <p className="text-[12px] text-[#586330] font-medium italic line-clamp-1 max-w-xs">
            {skill.summary}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {rejectId === skill.id ? (
          <div className="flex items-center gap-2">
            <textarea
              placeholder={t("reject_reason_placeholder")}
              value={rejectReason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={1}
              className="w-48 px-4 py-2 rounded-full border border-[#e8dfc8] text-sm text-[#564337] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30 resize-none bg-white"
              style={{ fontFamily: "var(--font-vietnam)" }}
            />
            <button
              onClick={onConfirmReject}
              disabled={isLoading}
              className="px-4 py-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white text-xs font-semibold rounded-full transition-colors disabled:opacity-50"
            >
              {isLoading ? "..." : t("confirm")}
            </button>
            <button
              onClick={onCancelReject}
              className="px-4 py-2 bg-[#f8f4db] text-[#7a6a5a] text-xs font-semibold rounded-full hover:bg-[#ede9cf] transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        ) : (
          <>
            <Link
              href={`/admin/review/${skill.id}`}
              className="bg-white border border-[rgba(220,193,177,0.1)] px-5 py-2.5 rounded-full text-[#a23f00] text-[14px] font-semibold hover:shadow-md transition-all whitespace-nowrap"
              style={{ fontFamily: "var(--font-vietnam)" }}
            >
              {t("view_details")}
            </Link>
            <button
              onClick={() => onReject(skill.id)}
              disabled={isLoading}
              className="w-10 h-10 flex items-center justify-center bg-[rgba(186,26,26,0.1)] rounded-full hover:bg-[rgba(186,26,26,0.2)] transition-colors disabled:opacity-50"
              title={t("reject")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <button
              onClick={() => onApprove(skill.id)}
              disabled={isLoading}
              className="w-10 h-10 flex items-center justify-center bg-[rgba(88,99,48,0.1)] rounded-full hover:bg-[rgba(88,99,48,0.2)] transition-colors disabled:opacity-50"
              title={t("approve")}
            >
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M1 6L5.5 10.5L15 1" stroke="#586330" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminReviewPage() {
  const t = useT("admin_review");
  const tCommon = useT("common");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const fetchPending = useCallback(async () => {
    const res = await fetch("/api/admin/skills");
    if (res.ok) {
      const data = await res.json();
      setSkills(data.skills ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const filtered = skills.filter((s) =>
    search
      ? s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.authorName || "").toLowerCase().includes(search.toLowerCase())
      : true
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function approve(skillId: string) {
    setActioningId(skillId);
    try {
      const res = await fetch(`/api/admin/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        setSkills((prev) => prev.filter((s) => s.id !== skillId));
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
        setSkills((prev) => prev.filter((s) => s.id !== rejectId));
        setRejectId(null);
        setRejectReason("");
      }
    } finally {
      setActioningId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-[#7a6a5a] animate-pulse font-body">{tCommon("loading")}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4">
      {/* Search bar */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t("search_placeholder")}
          className="w-full bg-[#e7e3ca] pl-12 pr-4 py-3 rounded-full text-[14px] text-[#1d1c0d] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30"
          style={{ fontFamily: "var(--font-vietnam)" }}
        />
      </div>

      {/* Skills List */}
      {paginated.length === 0 ? (
        <div className="bg-[#f8f4db] rounded-[48px] p-16 text-center space-y-4">
          <div className="text-5xl">🌿</div>
          <h3 className="text-xl font-bold text-[#564337]" style={{ fontFamily: "var(--font-jakarta)" }}>
            {t("all_clear")}
          </h3>
          <p className="text-sm text-[#7a6a5a] font-body">{t("no_pending")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginated.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              onApprove={approve}
              onReject={openReject}
              actioningId={actioningId}
              rejectId={rejectId}
              rejectReason={rejectReason}
              onReasonChange={setRejectReason}
              onConfirmReject={confirmReject}
              onCancelReject={() => { setRejectId(null); setRejectReason(""); }}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-[14px] text-[#564337]" style={{ fontFamily: "var(--font-vietnam)" }}>
            {t("paginate_showing", {
              start: String((page - 1) * PAGE_SIZE + 1),
              end: String(Math.min(page * PAGE_SIZE, filtered.length)),
              total: String(filtered.length),
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-10 h-10 flex items-center justify-center bg-[#ede9cf] rounded-[32px] disabled:opacity-40 transition-colors"
            >
              <svg width="7.4" height="12" viewBox="0 0 7.4 12" fill="none">
                <path d="M6 1L1 6L6 11" stroke="#586330" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-10 h-10 flex items-center justify-center rounded-[32px] text-[16px] font-semibold transition-colors ${
                  p === page
                    ? "bg-[#a23f00] text-white"
                    : "bg-[#ede9cf] text-[#a23f00]"
                }`}
                style={{ fontFamily: "var(--font-vietnam)" }}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-10 h-10 flex items-center justify-center bg-[#ede9cf] rounded-[32px] disabled:opacity-40 transition-colors"
            >
              <svg width="7.4" height="12" viewBox="0 0 7.4 12" fill="none">
                <path d="M1.4 1L6.4 6L1.4 11" stroke="#586330" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
