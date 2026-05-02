"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";
import { usePendingCount } from "@/lib/context/PendingCountContext";
import { SkillMdWorkspace, WorkflowDiagramWorkspace } from "@/components/SkillWorkspace";
import { CalendarIcon, CheckIcon, LinkIcon } from "@/components/icons";

interface SkillDetail {
  id: string;
  slug: string;
  name: string;
  summary: string;
  authorName: string;
  authorEmail: string;
  repoUrl: string;
  iconEmoji: string;
  skillMdContent?: string;
  workflowMd?: string;
  createdAt: string;
}

const ChecklistItem = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div
    onClick={() => onChange(!checked)}
    className={`flex cursor-pointer items-center gap-3 rounded-[6px] border px-4 py-3 transition-all ${
      checked
        ? "border-[#dbe5f7] bg-[#f7faff]"
        : "border-dashed border-[#dbe5f7] bg-white"
    }`}
  >
    <div
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
        checked ? "bg-[#2d67f7] shadow-sm" : "border-2 border-[#dbe5f7] bg-white"
      }`}
    >
      {checked && <CheckIcon className="w-3 h-3 text-white" />}
    </div>
    <span className={`text-sm font-medium font-body ${checked ? "text-[#102040]" : "text-[#667391]"}`}>
      {label}
    </span>
  </div>
);

export default function AdminReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params.id as string;
  const t = useT("admin_review_detail");
  const tCommon = useT("common");

  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const { decrement } = usePendingCount();
  const [feedback, setFeedback] = useState("");
  const [checklist, setChecklist] = useState({
    iconMatches: false,
    licenseOk: false,
    manualLinkCheck: false,
  });

  /* eslint-disable react-hooks/exhaustive-deps -- router and fetchSkill are stable */
  useEffect(() => {
    if (!skillId) {
      router.push("/admin/review");
      return;
    }
    const controller = new AbortController();
    fetchSkill(controller.signal);
    return () => controller.abort();
  }, [skillId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function fetchSkill(signal?: AbortSignal) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/skills/${skillId}`, signal ? { signal } : undefined);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.skill) {
        router.push("/admin/review");
        return;
      }
      setSkill(data.skill as SkillDetail);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        router.push("/admin/review");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  async function approve() {
    if (!skill) return;
    setActioning(true);
    try {
      const res = await fetch(`/api/admin/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) {
        decrement();
        router.push("/admin/review");
      }
    } finally {
      setActioning(false);
    }
  }

  async function reject() {
    if (!skill) return;
    setActioning(true);
    try {
      const res = await fetch(`/api/admin/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: feedback }),
      });
      if (res.ok) {
        decrement();
        router.push("/admin/review");
      }
    } finally {
      setActioning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-[#52617d] animate-pulse font-body">{tCommon("loading")}</div>
      </div>
    );
  }

  if (!skill) return null;

  const repoDomain = skill.repoUrl
    ? skill.repoUrl.replace(/^https?:\/\//, "").split("/")[0]
    : null;

  return (
    <div className="relative min-h-screen bg-[#fbfdff]">
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-[#667391]">
          <Link href="/admin/review" className="font-medium text-[#2d67f7] transition-colors hover:text-[#2457d4]">
            {t("breadcrumb")}
          </Link>
          <span className="text-[#b3c0dd]">/</span>
          <span className="min-w-0 truncate font-medium text-[#102040]">{skill.name}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-6 shadow-[0_8px_20px_rgba(25,43,87,0.06)]">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="break-words font-heading text-[32px] font-bold tracking-[-0.03em] text-[#102040]">
                      {skill.name}
                    </h1>
                    <p className="mt-2 font-body text-sm text-[#667391]">
                      {tCommon("submitted")}{" "}
                      <span className="font-semibold text-[#102040]">{skill.authorEmail || tCommon("anonymous")}</span>
                      <span className="mx-2 text-[#b3c0dd]">•</span>
                      <span className="font-medium text-[#2d67f7]">
                        {new Date(skill.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8f8] bg-[#f7faff] px-3 py-1 text-xs font-semibold text-[#2d67f7]">
                      <CalendarIcon className="h-3.5 w-3.5" /> {t("pending_review")}
                    </span>
                    {repoDomain && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8f8] bg-[#f7faff] px-3 py-1 text-xs font-medium text-[#667391]">
                        <LinkIcon className="h-3.5 w-3.5 text-[#2d67f7]" /> {repoDomain}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-6 shadow-[0_8px_20px_rgba(25,43,87,0.06)] space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#2d67f7] font-body">
                  {t("bio_description")}
                </p>
                <p className="text-sm leading-7 text-[#52617d] font-body">
                  {skill.summary ? skill.summary : t("no_description")}
                </p>
              </div>

              <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-6 shadow-[0_8px_20px_rgba(25,43,87,0.06)] space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#2d67f7] font-body">
                  {t("author_details")}
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[#667391] font-body">{t("email_label")}</span>
                    <span className="text-sm font-medium text-[#102040] font-body">{skill.authorEmail || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-[#667391] font-body">{t("author_id")}</span>
                    <span className="text-sm font-bold font-mono-custom text-[#102040]">
                      USR-{String(skill.id).padStart(4, "0")}
                    </span>
                  </div>
                  {skill.repoUrl && (
                    <a
                      href={skill.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-semibold text-[#2d67f7] transition-colors hover:text-[#2457d4] font-body"
                    >
                      <LinkIcon className="h-4 w-4" />
                      <span>{repoDomain}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {skill.skillMdContent && (
              <SkillMdWorkspace
                title="SKILL.md"
                description={t("skill_md_preview")}
                value={skill.skillMdContent}
                mode="preview"
              />
            )}

            {skill.workflowMd && (
              <WorkflowDiagramWorkspace
                title={t("diagram_preview_label")}
                description={t("diagram_preview_desc")}
                mermaid={skill.workflowMd}
                mode="preview"
              />
            )}

            <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-6 shadow-[0_8px_20px_rgba(25,43,87,0.06)] space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#2d67f7] font-body">
                {t("submission_timeline")}
              </p>
              <div className="space-y-4">
                <TimelineItem
                  dot="#2d67f7"
                  title={t("security_scan_passed")}
                  time={new Date(skill.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                />
                <TimelineItem dot="#2d67f7" title={t("assigned_moderator")} time={t("today")} />
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-5 shadow-[0_8px_20px_rgba(25,43,87,0.06)] space-y-2.5">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-[#2d67f7]" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#102040] font-body">
                  {t("moderator_checklist")}
                </p>
              </div>
              <div className="space-y-2">
                <ChecklistItem
                  label={t("icon_matches_bio")}
                  checked={checklist.iconMatches}
                  onChange={(v) => setChecklist((c) => ({ ...c, iconMatches: v }))}
                />
                <ChecklistItem
                  label={t("license_cc0_mit")}
                  checked={checklist.licenseOk}
                  onChange={(v) => setChecklist((c) => ({ ...c, licenseOk: v }))}
                />
                <ChecklistItem
                  label={t("manual_link_check")}
                  checked={checklist.manualLinkCheck}
                  onChange={(v) => setChecklist((c) => ({ ...c, manualLinkCheck: v }))}
                />
              </div>
              <p className="text-[10px] italic text-[#667391] font-body">{t("complete_checklist")}</p>
            </div>

            <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-5 shadow-[0_8px_20px_rgba(25,43,87,0.06)] space-y-4">
              <div>
                <h3 className="font-heading text-[18px] font-bold tracking-[-0.02em] text-[#102040]">
                  {t("final_decision")}
                </h3>
              </div>

              <div className="space-y-1.5">
                <textarea
                  placeholder={t("feedback_placeholder")}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-[6px] border border-[#d9e4f7] bg-[#fbfdff] p-4 text-sm text-[#102040] placeholder:text-[#98a3bc] transition-colors focus:border-[#2d67f7] focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/10 font-body"
                />
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={approve}
                  disabled={actioning}
                  className="w-full rounded-[6px] bg-[#2d67f7] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2457d4] disabled:cursor-not-allowed disabled:opacity-50 font-heading"
                >
                  {actioning ? t("processing") : t("approve_publish")}
                </button>
                <button
                  onClick={reject}
                  disabled={actioning || !feedback.trim()}
                  className="w-full rounded-[6px] border border-[#f2c6c6] bg-white px-5 py-2.5 text-sm font-semibold text-[#c44] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 font-heading"
                >
                  {t("reject_submission")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ dot, title, time }: { dot: string; title: string; time: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dot }} />
        <div className="w-[2px] flex-1 bg-[rgba(219,229,247,0.3)] min-h-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#102040] font-body">{title}</p>
        <p className="text-xs text-[#667391] font-body">{time}</p>
      </div>
    </div>
  );
}
