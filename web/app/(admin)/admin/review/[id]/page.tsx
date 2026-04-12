"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

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
    className={`flex items-center gap-3 p-3 rounded-full transition-all cursor-pointer ${
      checked
        ? "bg-white border border-white"
        : "border border-dashed border-[#dcc1b1]"
    }`}
  >
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
        checked ? "bg-[#a23f00] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" : "border-2 border-[#dcc1b1]"
      }`}
    >
      {checked && <span className="text-white text-xs">✓</span>}
    </div>
    <span className={`text-sm font-medium font-body ${checked ? "text-[#1d1c0d]" : "text-[#586330]"}`}>
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
    fetchSkill();
  }, [skillId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function fetchSkill() {
    const res = await fetch("/api/admin/skills");
    if (res.ok) {
      const data = await res.json();
      const found = (data.skills ?? []).find((s: SkillDetail) => s.id === skillId);
      if (!found) {
        router.push("/admin/review");
        return;
      }
      setSkill(found);
    }
    setLoading(false);
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
        router.push("/admin/review");
      }
    } finally {
      setActioning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-[#7a6a5a] animate-pulse font-body">{tCommon("loading")}</div>
      </div>
    );
  }

  if (!skill) return null;

  const repoDomain = skill.repoUrl
    ? skill.repoUrl.replace(/^https?:\/\//, "").split("/")[0]
    : null;

  return (
    <div className="max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#7a6a5a] font-body">
        <Link href="/admin/review" className="hover:text-[#a23f00]">{t("breadcrumb")}</Link>
        <span>/</span>
        <span className="font-semibold text-[#564337]">{skill.name}</span>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main content - 8 cols */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Hero Header Card */}
          <div className="bg-[#f8f4db] rounded-[48px] p-8 flex items-center gap-6">
            <div className="w-[96px] h-[96px] bg-white rounded-[48px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex items-center justify-center flex-shrink-0">
              <span className="text-5xl">{skill.iconEmoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold font-heading text-[#1d1c0d] tracking-tight">
                  {skill.name}
                </h1>
                <span className="px-3 py-1 bg-[rgba(162,63,0,0.1)] border border-[rgba(162,63,0,0.2)] text-[#a23f00] text-[10px] font-semibold uppercase tracking-wider rounded-full font-body">
                  {t("pending_review")}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-[#586330] font-body flex-wrap">
                <span className="flex items-center gap-1">
                  <span>📅</span>
                  <span>{t("submitted")} {new Date(skill.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </span>
                {skill.authorEmail && (
                  <span className="flex items-center gap-1">
                    <span>📧</span>
                    <span>{skill.authorEmail}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-5">
            {/* Bio & Description */}
            <div className="bg-white rounded-[48px] p-6 border border-[rgba(220,193,177,0.1)] card-shadow space-y-3">
              <p className="text-[10px] font-bold text-[#a23f00] uppercase tracking-widest font-body">
                {t("bio_description")}
              </p>
              <p className="text-base italic text-[rgba(29,28,13,0.8)] leading-relaxed font-body">
                {skill.summary
                  ? `"${skill.summary}"`
                  : t("no_description")}
              </p>
            </div>

            {/* Author Details */}
            <div className="bg-white rounded-[48px] p-6 border border-[rgba(220,193,177,0.1)] card-shadow space-y-4">
              <p className="text-[10px] font-bold text-[#a23f00] uppercase tracking-widest font-body">
                {t('author_details')}
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#586330] font-body">{t("author_id")}</span>
                  <span className="text-sm font-bold font-mono-custom text-[#1d1c0d]">
                    USR-{String(skill.id).padStart(4, "0")}-X
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#586330] font-body">{t("email_label")}</span>
                  <span className="text-sm font-medium text-[#1d1c0d] font-body">
                    {skill.authorEmail || "—"}
                  </span>
                </div>
                {skill.repoUrl && (
                  <a
                    href={skill.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-semibold text-[#a23f00] hover:text-[#c45000] transition-colors font-body"
                  >
                    <span>🔗</span>
                    <span>{repoDomain}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* SKILL.md Preview */}
          {skill.skillMdContent && (
            <div className="bg-white rounded-[48px] border border-[rgba(220,193,177,0.1)] card-shadow overflow-hidden">
              <div className="bg-[#ede9cf] px-6 py-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-[#586330] uppercase tracking-widest font-body">
                  <span>📄</span> {t("skill_md_preview")}
                </span>
                <span className="text-[10px] text-[rgba(88,99,48,0.6)] font-mono-custom">
                  UTF-8 • {(skill.skillMdContent?.length ?? 0)} chars
                </span>
              </div>
              <div className="p-8 max-h-[500px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono-custom text-[#1d1c0d] leading-relaxed">
                  {skill.skillMdContent}
                </pre>
              </div>
            </div>
          )}

          {/* Submission Timeline */}
          <div className="bg-[#f8f4db] rounded-[48px] p-6 space-y-4">
            <p className="text-[10px] font-bold text-[#a23f00] uppercase tracking-widest font-body">
              {t("submission_timeline")}
            </p>
            <div className="space-y-4">
              <TimelineItem
                dot="#586330"
                title={t("security_scan_passed")}
                time={new Date(skill.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
              <TimelineItem
                dot="#a23f00"
                title={t("assigned_moderator")}
                time={t("today")}
              />
            </div>
          </div>
        </div>

        {/* Right sidebar - 4 cols */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Moderator Checklist */}
          <div className="bg-[#ede9cf] border border-[rgba(220,193,177,0.3)] rounded-[16px] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <p className="text-xs font-bold text-[#1d1c0d] uppercase tracking-widest font-body">
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
            <p className="text-[10px] italic text-[rgba(88,99,48,0.7)] font-body">
              {t("complete_checklist")}
            </p>
          </div>

          {/* Review Decision Card */}
          <div className="bg-white rounded-[24px] p-8 border border-[rgba(162,63,0,0.05)] card-shadow shadow-[0px_20px_50px_0px_rgba(86,67,55,0.12)] space-y-5">
            <div>
              <h3 className="text-xl font-extrabold font-heading text-[#a23f00]">{t("final_decision")}</h3>
              <p className="text-[10px] text-[#586330]/60 uppercase tracking-widest font-body mt-0.5">
                {t("admin_verification")}
              </p>
            </div>

            {/* Rejection feedback */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#1d1c0d] font-body">
                  {t("rejection_feedback")}
                </p>
                <p className="text-[10px] italic text-[#ba1a1a] font-body lowercase">
                  {t("rejection_required")}
                </p>
              </div>
              <textarea
                placeholder={t("feedback_placeholder")}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                className="w-full border-2 border-[#ede9cf] rounded-[16px] p-4 text-sm text-[#1d1c0d] focus:outline-none focus:border-[#a23f00] resize-none font-body placeholder:text-[rgba(88,99,48,0.3)]"
              />
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={approve}
                disabled={actioning}
                className="w-full flex items-center justify-center gap-3 h-[56px] bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white font-semibold rounded-full shadow-[0px_10px_15px_-3px_rgba(162,63,0,0.2),0px_4px_6px_-4px_rgba(162,63,0,0.2)] hover:opacity-90 transition-all font-heading disabled:opacity-50"
              >
                {actioning ? t("processing") : t("approve_publish")}
              </button>
              <button
                onClick={reject}
                disabled={actioning}
                className="w-full flex items-center justify-center gap-3 h-[56px] border-2 border-[rgba(186,26,26,0.2)] text-[#ba1a1a] font-semibold rounded-full hover:bg-red-50 transition-colors font-heading disabled:opacity-50"
              >
                ✕ {t("reject_submission")}
              </button>
            </div>

            {/* Disclaimer */}
            <div className="border-t border-[#ede9cf] pt-6">
              <p className="text-[11px] text-[#586330] leading-relaxed font-body">
                &ldquo;{t("approve_disclaimer")}&rdquo;
              </p>
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
        <div className="w-[2px] flex-1 bg-[rgba(220,193,177,0.3)] min-h-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#1d1c0d] font-body">{title}</p>
        <p className="text-xs text-[#586330] font-body">{time}</p>
      </div>
    </div>
  );
}
