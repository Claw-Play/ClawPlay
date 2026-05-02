"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import WorkflowIndicator from "@/components/submit/workflow-indicator";
import SkillMdEditor, { clearSubmitDraft } from "@/components/submit/skill-md-editor";
import SubmitSection from "@/components/submit/submit-section";
import SubmitStepCard from "@/components/submit/submit-step-card";
import VersionSubmitGateCard from "@/components/submit/version-submit-gate-card";

interface SkillDetail {
  slug: string;
  name: string;
  iconEmoji: string;
  moderationStatus: string;
  summary: string;
  repoUrl: string;
}

interface LatestVersion {
  version: string;
  changelog: string;
  moderationStatus: string;
}

const ICON_CHOICES = ["🧩", "✨", "🎯", "🎮", "🪄", "⚡", "🧠", "🎨"];

function suggestNextVersion(current: string, type: "patch" | "minor" | "major"): string {
  const parts = current.split(".").map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return current;
  const [major, minor, patch] = parts;
  if (type === "patch") return `${major}.${minor}.${patch + 1}`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major + 1}.0.0`;
}

function scrollToStep(targetId: string) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  if ("focus" in el) {
    (el as HTMLElement).focus({ preventScroll: true });
  }
}

export default function SubmitNewVersionPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const t = useT("submit_version");
  const tSubmit = useT("submit");

  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [latestVersion, setLatestVersion] = useState<LatestVersion | null>(null);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [iconEmoji, setIconEmoji] = useState("🧩");
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [skillMdContent, setSkillMdContent] = useState("");
  const [skillSaved, setSkillSaved] = useState(false);
  const [diagramMermaid, setDiagramMermaid] = useState("");
  const [diagramDone, setDiagramDone] = useState(false);
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [versionInfoOpen, setVersionInfoOpen] = useState(true);
  const [validationResult, setValidationResult] = useState<{
    ok: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const versionTypeLabels = {
    patch: t("version_type_patch"),
    minor: t("version_type_minor"),
    major: t("version_type_major"),
  } as const;

  const draftStorageKey = useMemo(() => `clawplay_version_draft:${slug}`, [slug]);

  useEffect(() => {
    let active = true;

    fetch("/api/user/me")
      .then((r) => {
        if (!r.ok) throw new Error("not authed");
      })
      .catch(() => router.push("/login"));

    Promise.all([
      fetch(`/api/skills/${slug}`).then((r) => r.json()),
      fetch(`/api/skills/${slug}/versions`).then((r) => r.json()),
    ])
      .then(([skillData, versionsData]) => {
        if (!active) return;

        if (skillData.error) {
          setError(skillData.error);
          return;
        }

        const loadedSkill = skillData.skill as SkillDetail;
        setSkill(loadedSkill);
        setName(loadedSkill.name ?? "");
        setSummary(loadedSkill.summary ?? "");
        setRepoUrl(loadedSkill.repoUrl ?? "");
        setIconEmoji(loadedSkill.iconEmoji || "🧩");

        const latest = versionsData.versions?.[0] as LatestVersion | undefined;
        if (latest) {
          setLatestVersion(latest);
          setVersion(suggestNextVersion(latest.version, "patch"));
        } else {
          setVersion("1.0.0");
        }
      })
      .catch(() => {
        if (active) setError("Failed to load skill.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, slug]);

  const basicInfoDone = Boolean(skill) || Boolean(name.trim() && summary.trim() && repoUrl.trim() && iconEmoji.trim());
  const versionInfoDone = Boolean(version.trim() && changelog.trim());

  const adjustSummaryHeight = useCallback(() => {
    const el = summaryRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    adjustSummaryHeight();
  }, [adjustSummaryHeight, summary]);

  const workflowSteps = [
    { label: t("workflow_step0"), done: basicInfoDone },
    { label: t("workflow_step1"), done: versionInfoDone },
    { label: t("workflow_step2"), done: skillSaved },
    { label: t("workflow_step3"), done: diagramDone },
    { label: t("workflow_step4"), done: false },
  ];

  return (
    <div className="min-h-screen bg-[#fbfcfe]">

      <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-[#667391]">
          <Link href="/dashboard" className="font-medium text-[#2d67f7] transition-colors hover:text-[#2457d4]">
            {t("breadcrumb_dashboard")}
          </Link>
          <span className="text-[#b3c0dd]">/</span>
          <Link href={`/skills/${slug}`} className="font-medium text-[#2d67f7] transition-colors hover:text-[#2457d4]">
            {skill?.name ?? slug}
          </Link>
          <span className="text-[#b3c0dd]">/</span>
          <span className="min-w-0 truncate font-medium text-[#102040]">{t("breadcrumb_new_version")}</span>
        </div>

        <div className="mb-8 max-w-3xl">
          <h1 className="font-heading text-[32px] font-bold tracking-[-0.03em] text-[#102040] leading-none md:text-[44px]">
            {t("title")}
          </h1>
        </div>

        {skill && (
          <div
            className={`mb-6 rounded-[6px] border px-5 py-3.5 text-sm font-body ${
              skill.moderationStatus === "approved"
                ? "border-[#586330]/20 bg-[#586330]/10 text-[#586330]"
                : "border-[#2d67f7]/20 bg-[#2d67f7]/10 text-[#2d67f7]"
            }`}
          >
            {skill.moderationStatus === "approved" ? t("auto_approved_notice") : t("pending_notice")}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-[6px] border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-body text-red-700">
            {error}
          </div>
        )}

        <div className="mb-8">
          <WorkflowIndicator
            steps={workflowSteps}
            ariaLabel={t("workflow_label")}
            basicInfoDone={basicInfoDone}
            abilitiesSelected={false}
            skillSaved={skillSaved}
            diagramDone={diagramDone}
            submitted={false}
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <main className="min-w-0 space-y-6">
            <SubmitStepCard
              id="version-basic-info"
              tabIndex={-1}
              stepNumber={1}
              open={basicInfoOpen}
              onToggle={() => setBasicInfoOpen((v) => !v)}
              title={t("wizard_basic_info_title")}
              description={t("wizard_basic_info_desc")}
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#102040]">{tSubmit("skill_name")}</label>
                  <div className="rounded-[6px] border border-[#dbe5f7] bg-[#f7faff] px-4 py-3 text-sm text-[#102040]">
                    {name || "—"}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#102040]">Slug</label>
                  <div className="rounded-[6px] border border-[#dbe5f7] bg-[#f7faff] px-4 py-3 text-sm text-[#102040]">
                    {slug}
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-sm font-semibold text-[#102040]" htmlFor="version-summary">
                    {tSubmit("one_line_summary")}
                  </label>
                  <textarea
                    id="version-summary"
                    ref={summaryRef}
                    value={summary}
                    onChange={(e) => {
                      setSummary(e.target.value);
                      requestAnimationFrame(adjustSummaryHeight);
                    }}
                    rows={1}
                    className="min-h-[48px] w-full resize-none overflow-hidden rounded-[6px] border border-[#dbe5f7] bg-[#f7faff] px-4 py-3 text-sm leading-6 text-[#102040] placeholder-[#94a3b8] transition-colors focus:border-[#2d67f7] focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/20"
                    placeholder={tSubmit("summary_placeholder")}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-sm font-semibold text-[#102040]" htmlFor="version-repo-url">
                    {tSubmit("github_url")}
                  </label>
                  <input
                    id="version-repo-url"
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="w-full rounded-[6px] border border-[#dbe5f7] bg-[#f7faff] px-4 py-3 text-sm text-[#102040] placeholder-[#94a3b8] transition-colors focus:border-[#2d67f7] focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/20"
                    placeholder={tSubmit("github_placeholder")}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-[#102040]">{tSubmit("icon_emoji")}</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_CHOICES.map((emoji) => {
                      const active = iconEmoji === emoji;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setIconEmoji(emoji)}
                          className={`flex h-11 w-11 items-center justify-center rounded-[6px] border text-lg transition-colors ${
                            active
                              ? "border-[#2d67f7] bg-[#eff6ff] text-[#1d4ed8]"
                              : "border-[#dbe5f7] bg-[#f7faff] text-[#102040] hover:border-[#cbd5e1] hover:bg-white"
                          }`}
                          aria-pressed={active}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </SubmitStepCard>

            <SubmitStepCard
              id="version-info"
              tabIndex={-1}
              stepNumber={2}
              open={versionInfoOpen}
              onToggle={() => setVersionInfoOpen((v) => !v)}
              title={t("version_number")}
              description={t("semver_hint")}
            >
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#102040]" htmlFor="version-number">
                    {t("version_number")}
                  </label>
                  <input
                    id="version-number"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="e.g. 1.1.0"
                    required
                    pattern="^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$"
                    className="w-full rounded-[6px] border border-[#dbe5f7] bg-[#f7faff] px-4 py-3 text-sm text-[#102040] placeholder-[#94a3b8] transition-colors focus:border-[#2d67f7] focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/20"
                  />
                </div>

                {latestVersion && (
                  <div className="flex flex-wrap gap-2">
                    {(["patch", "minor", "major"] as const).map((type) => {
                      const suggested = suggestNextVersion(latestVersion.version, type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setVersion(suggested)}
                          className="rounded-[6px] border border-[#dbe5f7] bg-white px-3 py-1 text-xs font-semibold text-[#52617d] transition-colors hover:border-[#2d67f7] hover:text-[#2d67f7]"
                        >
                          {t("suggest")} {suggested}
                          <span className="ml-1 opacity-60">({versionTypeLabels[type]})</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#102040]" htmlFor="version-changelog">
                    {t("changelog")}
                  </label>
                  <textarea
                    id="version-changelog"
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    rows={4}
                    placeholder={t("changelog_placeholder")}
                    className="w-full rounded-[6px] border border-[#dbe5f7] bg-[#f7faff] px-4 py-3 text-sm text-[#102040] placeholder-[#94a3b8] transition-colors focus:border-[#2d67f7] focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/20"
                  />
                  <p className="text-right text-xs text-[#667391]">{changelog.length}/1000</p>
                </div>
              </div>
            </SubmitStepCard>

            <div id="version-skill-md" tabIndex={-1} className="scroll-mt-24 outline-none">
              <SkillMdEditor
                t={tSubmit}
                value={skillMdContent}
                onChange={(value) => {
                  setSkillMdContent(value);
                  setSkillSaved(false);
                  setDiagramDone(false);
                  setDiagramMermaid("");
                  setValidationResult(null);
                }}
                validationResult={validationResult}
                draftStorageKey={draftStorageKey}
                onValidationResult={setValidationResult}
                onSaveSuccess={() => {
                  setSkillSaved(true);
                }}
              />
            </div>

            <div id="version-diagram" tabIndex={-1} className="scroll-mt-24 outline-none">
              <SubmitSection
                t={tSubmit}
                skillSaved={skillSaved}
                skillMdContent={skillMdContent}
                initialDiagramMermaid={diagramMermaid}
                onDiagramSuccess={() => setDiagramDone(true)}
                onDiagramGenerated={setDiagramMermaid}
              />
            </div>
          </main>

          <aside className="hidden lg:sticky lg:top-[102px] lg:flex lg:max-h-[calc(100vh-126px)] lg:self-start lg:justify-center lg:overflow-y-auto">
            <div className="w-full max-w-[360px]">
              <VersionSubmitGateCard
                t={t}
                slug={slug}
                name={name}
                version={version}
                basicInfoDone={basicInfoDone}
                versionInfoDone={versionInfoDone}
                skillSaved={skillSaved}
                diagramDone={diagramDone}
                changelog={changelog}
                skillMdContent={skillMdContent}
                diagramMermaid={diagramMermaid}
                validationResult={validationResult}
              onSubmitSuccess={() => {
                clearSubmitDraft(draftStorageKey);
              }}
              onNavigateStep={scrollToStep}
              />
            </div>
          </aside>
        </div>
      </div>
      {loading && !skill && !error && (
        <div className="fixed inset-0 pointer-events-none flex items-start justify-center pt-24">
          <div className="rounded-[6px] border border-[#dbe5f7] bg-white px-4 py-2 text-sm text-[#667391] shadow-[0_8px_20px_rgba(25,43,87,0.06)]">
            {tSubmit("loading")}
          </div>
        </div>
      )}
    </div>
  );
}
