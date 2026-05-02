"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { validateSkillMdFormat } from "@/lib/submit-wizard";
import type { ComposeAbility, ComposeModule } from "@/lib/submit-wizard";

import CapabilitySelector from "@/components/submit/capability-selector";
import SkillMdEditor, { clearSubmitDraft } from "@/components/submit/skill-md-editor";
import SubmitGateCard from "@/components/submit/submit-gate-card";
import SubmitSection from "@/components/submit/submit-section";
import WorkflowIndicator from "@/components/submit/workflow-indicator";
import CollapsibleCardHeader from "@/components/CollapsibleCardHeader";
import { CheckIcon, WarningIcon } from "@/components/icons";

const BASIC_INFO_DRAFT_KEY = "clawplay_submit_basic_info";
const ABILITY_GUIDE_COPY_KEY = "clawplay_submit_guide_copied";
const DIAGRAM_DRAFT_KEY = "clawplay_submit_diagram";
const ICON_CHOICES = ["🦐", "🎨", "🤖", "✨", "🎯", "🎵", "📸", "🌍"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function RequiredBadge({ t }: { t: (key: string) => string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold leading-none text-rose-700">
      {t("field_required")}
    </span>
  );
}

function NameStatusCard({
  loading,
  exists,
  baseSlug,
  suggestedSlug,
  t,
}: {
  loading: boolean;
  exists: boolean;
  baseSlug: string;
  suggestedSlug: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const tone = loading ? "neutral" : exists ? "warning" : "success";
  const styles =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div
      aria-live="polite"
      title={
        loading
          ? t("skill_name_slug_checking_hint")
          : exists
            ? t("skill_name_slug_conflict_hint")
            : t("skill_name_slug_ready_hint")
      }
      className={`flex h-12 items-center gap-3 rounded-lg border px-3 text-sm leading-none shadow-sm ${styles}`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          tone === "warning"
            ? "bg-amber-100 text-amber-600"
            : tone === "success"
              ? "bg-emerald-100 text-emerald-600"
              : "bg-slate-100 text-slate-500"
        }`}
      >
        {tone === "warning" ? (
          <WarningIcon className="h-3.5 w-3.5" />
        ) : tone === "success" ? (
          <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
        ) : (
          <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium leading-5">
          {loading
            ? t("skill_name_slug_checking")
            : exists
              ? t("skill_name_slug_conflict", { slug: suggestedSlug })
              : t("skill_name_slug_ready", { slug: baseSlug })}
        </p>
      </div>
    </div>
  );
}

export default function SubmitPage() {
  const router = useRouter();
  const t = useT("submit");
  const [abilities, setAbilities] = useState<ComposeAbility[]>(["llm"]);
  const [modules, setModules] = useState<ComposeModule[]>(["submission_notes"]);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [iconEmoji, setIconEmoji] = useState("🦐");
  const [guideContent, setGuideContent] = useState("");
  const [skillMdContent, setSkillMdContent] = useState("");
  const [skillSaved, setSkillSaved] = useState(false);
  const [savedSkillMdContent, setSavedSkillMdContent] = useState("");
  const [validatedSkillMdContent, setValidatedSkillMdContent] = useState("");
  const [diagramDone, setDiagramDone] = useState(false);
  const [diagramMermaid, setDiagramMermaid] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [basicInfoDraftReady, setBasicInfoDraftReady] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const [sectionsOpen, setSectionsOpen] = useState({
    basicInfo: true,
    abilities: true,
    skillMd: true,
    diagram: true,
  });
  const toggleSection = (key: keyof typeof sectionsOpen) =>
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const [guideCopied, setGuideCopied] = useState(false);
  const [slugCheckState, setSlugCheckState] = useState<{
    loading: boolean;
    exists: boolean;
    baseSlug: string;
    suggestedSlug: string;
  }>({
    loading: false,
    exists: false,
    baseSlug: "",
    suggestedSlug: "",
  });
  const [serverValidationResult, setServerValidationResult] = useState<{
    ok: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [liveValidationResult, setLiveValidationResult] = useState<{
    ok: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const liveValidationTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const validationResult =
    validatedSkillMdContent && validatedSkillMdContent === skillMdContent
      ? serverValidationResult ?? liveValidationResult
      : liveValidationResult;
  const skillMdUpToDate = skillSaved && skillMdContent === savedSkillMdContent;
  const diagramUpToDate = diagramDone && skillMdUpToDate;

  const scrollToStep = useCallback((targetId: string) => {
    const element = document.getElementById(targetId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    if (element instanceof HTMLElement) {
      element.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => {
        if (!r.ok) throw new Error();
      })
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BASIC_INFO_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<{
          name: string;
          summary: string;
          repoUrl: string;
          iconEmoji: string;
        }>;
        setName(parsed.name ?? "");
        setSummary(parsed.summary ?? "");
        setRepoUrl(parsed.repoUrl ?? "");
        setIconEmoji(parsed.iconEmoji ?? "🦐");
      }
    } catch {
      // Ignore bad drafts and start from a clean state.
    } finally {
      setBasicInfoDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!basicInfoDraftReady) return;
    try {
      localStorage.setItem(BASIC_INFO_DRAFT_KEY, JSON.stringify({ name, summary, repoUrl, iconEmoji }));
    } catch {
      // Draft persistence is best-effort.
    }
  }, [basicInfoDraftReady, iconEmoji, name, repoUrl, summary]);

  useEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [summary]);

  useEffect(() => {
    try {
      setGuideCopied(localStorage.getItem(ABILITY_GUIDE_COPY_KEY) === "1");
    } catch {
      // Ignore storage failures and start from an uncopied state.
    }
  }, []);

  useEffect(() => {
    const normalizedName = name.trim();
    const baseSlug = slugify(normalizedName);

    if (!normalizedName || !baseSlug) {
      setSlugCheckState({ loading: false, exists: false, baseSlug: "", suggestedSlug: "" });
      return;
    }

    let cancelled = false;
    setSlugCheckState((prev) => ({
      ...prev,
      loading: true,
      baseSlug,
      suggestedSlug: baseSlug,
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/skills/slug-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as { slug?: string; exists?: boolean; suggestedSlug?: string };
        })
        .then((result) => {
          if (cancelled || !result) return;
          setSlugCheckState({
            loading: false,
            exists: Boolean(result.exists),
            baseSlug,
            suggestedSlug: result.suggestedSlug ?? baseSlug,
          });
        })
        .catch(() => {
          if (cancelled || controller.signal.aborted) return;
          setSlugCheckState({
            loading: false,
            exists: false,
            baseSlug,
            suggestedSlug: baseSlug,
          });
        });
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [name]);

  useEffect(() => {
    clearTimeout(liveValidationTimerRef.current);

    if (!skillMdContent.trim()) {
      setLiveValidationResult(null);
      return;
    }

    liveValidationTimerRef.current = setTimeout(() => {
      const result = validateSkillMdFormat(skillMdContent);
      setLiveValidationResult({
        ok: result.errors.length === 0,
        errors: result.errors,
        warnings: result.warnings,
      });
    }, 200);

    return () => clearTimeout(liveValidationTimerRef.current);
  }, [skillMdContent]);

  useEffect(() => {
    if (!skillMdContent.trim()) return;

    try {
      const saved = localStorage.getItem(DIAGRAM_DRAFT_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as Partial<{
        skillMdContent: string;
        diagramMermaid: string;
      }>;

      if (
        parsed.skillMdContent === skillMdContent &&
        parsed.diagramMermaid?.trim()
      ) {
        setSkillSaved(true);
        setDiagramDone(true);
        setDiagramMermaid(parsed.diagramMermaid);
        setSavedSkillMdContent(parsed.skillMdContent);
      }
    } catch {
      // Ignore bad diagram drafts and let the user regenerate.
    }
  }, [skillMdContent]);

  useEffect(() => {
    if (!skillMdContent.trim() || !skillMdUpToDate || !diagramUpToDate || !diagramMermaid.trim()) return;

    try {
      localStorage.setItem(
        DIAGRAM_DRAFT_KEY,
        JSON.stringify({
          skillMdContent,
          diagramMermaid,
        }),
      );
    } catch {
      // Diagram recovery is best-effort.
    }
  }, [diagramMermaid, diagramUpToDate, skillMdContent, skillMdUpToDate]);

  function toggleAbility(a: ComposeAbility) {
    setAbilities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function toggleModule(m: ComposeModule) {
    setModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  function handleGuideCopied() {
    setGuideCopied(true);
    try {
      localStorage.setItem(ABILITY_GUIDE_COPY_KEY, "1");
    } catch {
      // Ignore storage failures; the UI state still updates for this session.
    }
  }

  function handleSubmitSuccess() {
    clearSubmitDraft();
    try {
      localStorage.removeItem(BASIC_INFO_DRAFT_KEY);
      localStorage.removeItem(ABILITY_GUIDE_COPY_KEY);
      localStorage.removeItem(DIAGRAM_DRAFT_KEY);
    } catch {
      // Ignore storage failures on cleanup.
    }
    setName("");
    setSummary("");
    setRepoUrl("");
    setIconEmoji("🦐");
    setGuideCopied(false);
    setSkillMdContent("");
    setSkillSaved(false);
    setSavedSkillMdContent("");
    setDiagramDone(false);
    setDiagramMermaid("");
    setServerValidationResult(null);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-[#fbfcfe]">
      <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 space-y-6">
          <div className="flex items-center gap-2 text-sm text-[#64748b]">
            <Link href="/dashboard" className="transition-colors hover:text-[#1d4ed8]">
              {t("breadcrumb_dashboard")}
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#334155]">{t("breadcrumb_submit")}</span>
          </div>
          <div className="max-w-3xl">
            <h1 className="font-heading text-3xl font-black tracking-tight text-[#0f172a] sm:text-4xl">
              {t("breadcrumb_submit")}
            </h1>
            <p className="mt-2 text-sm leading-7 text-[#5b6472]">{t("submit_helper")}</p>
          </div>
        </header>

        <div className="mb-8">
          <WorkflowIndicator
            basicInfoDone={Boolean(name.trim() && summary.trim())}
            abilitiesSelected={abilities.length > 0 && guideCopied}
            skillSaved={skillMdUpToDate}
            diagramDone={diagramUpToDate}
            submitted={submitted}
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <main className="min-w-0 space-y-6">
            <section
              id="submit-basic-info"
              tabIndex={-1}
              className="scroll-mt-24 rounded-lg border border-[#d8dde6] bg-white outline-none"
            >
              <CollapsibleCardHeader
                title={`1. ${t("wizard_basic_info_title")}`}
                description={t("wizard_basic_info_desc")}
                open={sectionsOpen.basicInfo}
                onToggle={() => toggleSection("basicInfo")}
              />
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${sectionsOpen.basicInfo ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="mt-6 grid gap-4 px-7 pb-6 md:grid-cols-2">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#111827]" htmlFor="submit-name">
                    <span>{t("skill_name")}</span>
                    <RequiredBadge t={t} />
                  </label>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start">
                    <input
                      id="submit-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("skill_name_placeholder")}
                      className="h-12 w-full rounded-lg border border-[#d8dde6] bg-[#fbfcfe] px-4 text-sm text-[#111827] placeholder-[#94a3b8] transition-colors focus:border-[#2f6fdd] focus:outline-none focus:ring-2 focus:ring-[#2f6fdd]/20 md:w-[260px] lg:w-[240px]"
                    />
                    {name.trim() && (
                      <div className="flex-1 min-w-0">
                        <NameStatusCard
                          loading={slugCheckState.loading}
                          exists={slugCheckState.exists}
                          baseSlug={slugCheckState.baseSlug}
                          suggestedSlug={slugCheckState.suggestedSlug}
                          t={t}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#111827]" htmlFor="submit-summary">
                    <span>{t("one_line_summary")}</span>
                    <RequiredBadge t={t} />
                  </label>
                  <textarea
                    ref={summaryRef}
                    id="submit-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder={t("summary_placeholder")}
                    rows={1}
                    className="min-h-[48px] w-full resize-none overflow-hidden rounded-lg border border-[#d8dde6] bg-[#fbfcfe] px-4 py-3 text-sm text-[#111827] placeholder-[#94a3b8] transition-colors focus:border-[#2f6fdd] focus:outline-none focus:ring-2 focus:ring-[#2f6fdd]/20"
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-sm font-semibold text-[#111827]" htmlFor="submit-repo-url">
                    {t("github_url")}
                  </label>
                  <input
                    id="submit-repo-url"
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder={t("github_placeholder")}
                    className="w-full rounded-lg border border-[#d8dde6] bg-[#fbfcfe] px-4 py-3 text-sm text-[#111827] placeholder-[#94a3b8] transition-colors focus:border-[#2f6fdd] focus:outline-none focus:ring-2 focus:ring-[#2f6fdd]/20"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-[#111827]">
                    {t("icon_emoji")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_CHOICES.map((emoji) => {
                      const active = iconEmoji === emoji;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setIconEmoji(emoji)}
                          className={`flex h-11 w-11 items-center justify-center rounded-lg border text-lg transition-colors ${
                            active
                              ? "border-[#2f6fdd] bg-[#eff6ff] text-[#1d4ed8]"
                              : "border-[#d8dde6] bg-[#fbfcfe] text-[#111827] hover:border-[#cbd5e1] hover:bg-white"
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
              </div>
            </section>

            <div id="submit-abilities" tabIndex={-1} className="scroll-mt-24 outline-none">
              <CapabilitySelector
                t={t}
                selectedAbilities={abilities}
                selectedModules={modules}
                guideContent={guideContent}
                onToggleAbility={toggleAbility}
                onToggleModule={toggleModule}
                onGenerateGuide={setGuideContent}
                onCopyGuide={handleGuideCopied}
              />
            </div>

            <div id="submit-skill-md" tabIndex={-1} className="scroll-mt-24 outline-none">
              <SkillMdEditor
                t={t}
                value={skillMdContent}
                onChange={setSkillMdContent}
                validationResult={validationResult}
                onValidationResult={(result) => {
                  setServerValidationResult(result);
                  setValidatedSkillMdContent(skillMdContent);
                }}
                onSaveSuccess={() => {
                  setSkillSaved(true);
                  setSavedSkillMdContent(skillMdContent);
                }}
              />
            </div>

            <div id="submit-diagram" tabIndex={-1} className="scroll-mt-24 outline-none">
              <SubmitSection
                t={t}
                skillSaved={skillMdUpToDate}
                skillMdContent={skillMdContent}
                initialDiagramMermaid={diagramMermaid}
                onDiagramSuccess={() => setDiagramDone(true)}
                onDiagramGenerated={setDiagramMermaid}
              />
            </div>
          </main>

          <aside className="hidden lg:sticky lg:top-[102px] lg:flex lg:max-h-[calc(100vh-126px)] lg:self-start lg:justify-center lg:overflow-y-auto">
            <div className="w-full max-w-[360px]">
              <SubmitGateCard
                t={t}
                basicInfoDone={Boolean(name.trim() && summary.trim())}
                abilitiesSelected={abilities.length > 0 && guideCopied}
                skillSaved={skillMdUpToDate}
                diagramDone={diagramUpToDate}
                name={name}
                summary={summary}
                repoUrl={repoUrl}
                iconEmoji={iconEmoji}
                skillMdContent={skillMdContent}
                diagramMermaid={diagramMermaid}
                validationResult={validationResult}
                onSubmitSuccess={handleSubmitSuccess}
                onNavigateStep={scrollToStep}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
