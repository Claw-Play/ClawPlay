"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

interface Skill {
  id: string;
  slug: string;
  name: string;
  summary: string;
  authorName: string;
  authorEmail: string;
  repoUrl: string;
  iconEmoji: string;
  createdAt: string;
}

export default function AdminReviewPage() {
  const t = useT("admin_review");
  const tCommon = useT("common");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [showReject, setShowReject] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetchPending();
  }, []);

  async function fetchPending() {
    const res = await fetch("/api/admin/skills");
    if (res.ok) {
      const data = await res.json();
      setSkills(data.skills ?? []);
    }
    setLoading(false);
  }

  async function approve(skillId: string) {
    setActioning(skillId);
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
      setActioning(null);
    }
  }

  async function reject(skillId: string) {
    if (!showReject) {
      setShowReject(skillId);
      return;
    }
    setActioning(skillId);
    try {
      const res = await fetch(`/api/admin/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });
      if (res.ok) {
        setSkills((prev) => prev.filter((s) => s.id !== skillId));
        setShowReject(null);
        setReason("");
      }
    } finally {
      setActioning(null);
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
    <div className="max-w-5xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-heading text-[#564337]">
            {t("pending_reviews")}
          </h2>
          <p className="text-[#7a6a5a] text-sm mt-1 font-body">
            {t("submissions_count", { count: String(skills.length) })}
          </p>
        </div>
        <span className="px-3 py-1 bg-[#fa7025]/10 text-[#fa7025] text-xs font-semibold rounded-full font-body">
          {skills.length} {t("pending")}
        </span>
      </div>

      {/* Skills grid */}
      {skills.length === 0 ? (
        <div className="bg-[#fffdf7] rounded-[48px] p-12 text-center card-shadow space-y-4">
          <div className="text-5xl">🌿</div>
          <div>
            <h3 className="text-xl font-bold font-heading text-[#564337]">{t("all_clear")}</h3>
            <p className="text-[#7a6a5a] mt-1 font-body">{t("no_pending")}</p>
          </div>
          <Link
            href="/admin/audit"
            className="inline-block px-5 py-2.5 bg-[#f8f4db] text-[#a23f00] text-sm font-semibold rounded-full hover:bg-[#ede9cf] transition-colors font-heading"
          >
            {t("view_audit")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="bg-[#fffdf7] rounded-[48px] p-6 border border-[#e8dfc8] card-shadow space-y-4 relative overflow-hidden"
            >
              {/* Priority stripe */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#586330]" />

              <div className="flex items-start gap-4 pl-2">
                {/* Icon */}
                <div className="w-[64px] h-[64px] bg-white rounded-[48px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex items-center justify-center flex-shrink-0">
                  <span className="text-4xl">{skill.iconEmoji}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold font-heading text-[#564337] text-base leading-tight">
                      {skill.name}
                    </h3>
                    <span className="px-2 py-0.5 bg-[rgba(162,63,0,0.1)] text-[#a23f00] text-[10px] font-semibold rounded-full font-body flex-shrink-0">
                      ⏳ {t("pending_label").replace("⏳ ", "")}
                    </span>
                  </div>
                  <p className="text-xs text-[#586330] mt-1 font-body">
                    {t("by")} {skill.authorName || skill.authorEmail}
                  </p>
                  <p className="text-xs text-[#7a6a5a] mt-1 font-body">
                    {new Date(skill.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <p className="text-sm text-[#7a6a5a] line-clamp-2 font-body pl-2">
                {skill.summary || t("no_summary")}
              </p>

              {/* Install command */}
              {skill.repoUrl && (
                <div className="bg-[#f8f4db] rounded-[16px] p-3 font-mono-custom text-xs text-[#564337] break-all pl-2">
                  git clone {skill.repoUrl}
                </div>
              )}

              {/* Reject reason */}
              {showReject === skill.id && (
                <div className="space-y-2 pl-2">
                  <textarea
                    placeholder={t("reject_reason_placeholder")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 rounded-[24px] border border-[#e8dfc8] text-sm text-[#564337] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30 focus:border-[#a23f00] resize-none font-body"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(skill.id)}
                      disabled={actioning !== null}
                      className="px-4 py-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white text-xs font-semibold rounded-full transition-colors font-body disabled:opacity-50"
                    >
                      {actioning === skill.id ? t("rejecting") : t("confirm_reject")}
                    </button>
                    <button
                      onClick={() => { setShowReject(null); setReason(""); }}
                      className="px-4 py-2 bg-[#f8f4db] text-[#7a6a5a] text-xs font-semibold rounded-full hover:bg-[#ede9cf] transition-colors font-body"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pl-2 pt-2 border-t border-[rgba(220,193,177,0.3)]">
                <Link
                  href={`/admin/review/${skill.id}`}
                  className="flex-1 text-center px-4 py-2.5 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-xs font-semibold rounded-full shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
                >
                  {t("review_details")}
                </Link>
                <button
                  onClick={() => approve(skill.id)}
                  disabled={actioning !== null}
                  className="px-4 py-2.5 bg-[#586330] hover:bg-[#4a5528] text-white text-xs font-semibold rounded-full transition-colors font-body disabled:opacity-50"
                >
                  ✅
                </button>
                <button
                  onClick={() => reject(skill.id)}
                  disabled={actioning !== null}
                  className="px-4 py-2.5 border-2 border-[rgba(186,26,26,0.2)] text-[#ba1a1a] text-xs font-semibold rounded-full transition-colors font-body hover:bg-red-50 disabled:opacity-50"
                >
                  ❌
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Audit Log */}
      <AuditLogSection />
    </div>
  );
}

function AuditLogSection() {
  const t = useT("admin_review");
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  function load() {
    if (entries.length > 0) return;
    setLoading(true);
    fetch("/api/admin/audit-logs?limit=10")
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (visible) load();
  }, [visible]);

  const ACTION_LABELS: Record<string, { icon: string; bg: string; text: string }> = {
    approve_skill: { icon: "✅", bg: "#dcfce7", text: "#166534" },
    reject_skill: { icon: "❌", bg: "#fee2e2", text: "#991b1b" },
    generate_token: { icon: "🔑", bg: "#ffedd5", text: "#9a3412" },
    submit_skill: { icon: "📤", bg: "#dbeafe", text: "#1e40af" },
  };

  return (
    <div className="bg-[#1d1c0d] rounded-[48px] p-8 card-shadow space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">📋</span>
        <h3 className="font-bold font-heading text-[#586330] text-base">{t("recent_audit")}</h3>
      </div>

      {!visible ? (
        <button
          onClick={() => setVisible(true)}
          className="text-sm text-[#fa7025] hover:text-[#ff8f4a] transition-colors font-body"
        >
          {t("show_activity")}
        </button>
      ) : loading ? (
        <p className="text-[#fefae0]/50 text-sm animate-pulse font-body">{t("loading")}</p>
      ) : entries.length === 0 ? (
        <p className="text-[#fefae0]/50 text-sm font-body">{t("no_entries")}</p>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 5).map((entry: Record<string, unknown>, i: number) => {
            const action = (entry.action as string) ?? "unknown";
            const style = ACTION_LABELS[action] ?? { icon: "📌", bg: "#ede9cf", text: "#586330" };
            const ts = entry.ts as string | undefined;
            const targetId = entry.targetId as string | undefined;
            return (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-base flex-shrink-0">{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase font-body"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {action}
                    </span>
                    <span className="text-[#fefae0]/60 text-xs font-mono-custom">
                      actor:{entry.actorId as string}
                    </span>
                    {targetId && (
                      <span className="text-[#fefae0]/40 text-xs truncate font-body">
                        → {targetId.slice(0, 12)}...
                      </span>
                    )}
                  </div>
                  <p className="text-[#fefae0]/40 text-xs mt-0.5 font-body">
                    {ts ? new Date(ts).toLocaleString() : ""}
                  </p>
                </div>
              </div>
            );
          })}
          <Link
            href="/admin/audit"
            className="inline-block text-sm text-[#fa7025] hover:text-[#ff8f4a] transition-colors font-body pt-2"
          >
            {t("full_audit")}
          </Link>
        </div>
      )}
    </div>
  );
}
