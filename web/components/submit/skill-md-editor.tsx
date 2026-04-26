"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CheckIcon, WarningIcon, CloseIcon, PencilIcon, EyeIcon } from "@/components/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import matter from "gray-matter";

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  emoji?: string;
  bins?: string[];
}

function parseFrontmatter(raw: string): { meta: ParsedFrontmatter; content: string } {
  try {
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const clawdbot = metadata?.clawdbot as Record<string, unknown> | undefined;
    const requires = clawdbot?.requires as Record<string, unknown> | undefined;
    return {
      meta: {
        name: data.name as string | undefined,
        description: data.description as string | undefined,
        emoji: clawdbot?.emoji as string | undefined,
        bins: requires?.bins as string[] | undefined,
      },
      content: parsed.content.trimStart(),
    };
  } catch {
    return { meta: {}, content: raw };
  }
}

function FrontmatterCard({ meta }: { meta: ParsedFrontmatter }) {
  if (!meta.name && !meta.description && !meta.emoji && !(meta.bins?.length ?? 0 > 0)) return null;
  return (
    <div className="mb-4 flex flex-wrap items-start gap-3 rounded-lg border border-[#d8dde6] bg-[#f8fafc] p-4">
      {meta.emoji && (
        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#d8dde6] bg-white text-2xl">{meta.emoji}</span>
      )}
      <div className="min-w-0 flex-1">
        {meta.name && (
          <p className="font-heading text-base font-extrabold text-[#0f172a]">{meta.name}</p>
        )}
        {meta.description && (
          <p className="mt-0.5 text-sm leading-6 text-[#5b6472]">{meta.description}</p>
        )}
        {meta.bins && meta.bins.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.bins.map((bin) => (
              <code key={bin} className="rounded border border-[#d8dde6] bg-white px-2 py-0.5 text-xs text-[#334155]">{bin}</code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

interface Props {
  t: (key: string) => string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onSaveSuccess?: () => void;
  onValidationResult?: (result: ValidationResult) => void;
}

const STORAGE_KEY = "clawplay_submit_draft";

export default function SkillMdEditor({ t, value, onChange, onSave, onSaveSuccess, onValidationResult }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Show empty state when there's no content and not in preview mode
  const showEmpty = !value.trim() && !previewMode;
  const parsed = parseFrontmatter(value);

  function handleSave() {
    clearTimeout(timerRef.current);
    try {
      localStorage.setItem(STORAGE_KEY, value);
      setSaved(true);
      onSaveSuccess?.();
    } catch {}

    if (!validating) {
      setValidating(true);
      setPreviewMode(true);
      fetch("/api/skills/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillMdContent: value }),
      })
        .then((r) => r.json())
        .then((data) => {
          const result: ValidationResult = data.safe
            ? { ok: true, errors: [], warnings: data.warnings ?? [] }
            : { ok: false, errors: data.errors ?? [], warnings: data.warnings ?? [] };
          setValidationResult(result);
          onValidationResult?.(result);
        })
        .catch(() => {
          setValidationResult(null);
        })
        .finally(() => setValidating(false));
    } else {
      setPreviewMode(true);
    }

    onSave?.();
  }

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) onChange(saved);
    } catch {}
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save with debounce
  const handleChange = useCallback(
    (content: string) => {
      onChange(content);
      clearTimeout(timerRef.current);
      setSaved(false);
      timerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, content);
          setSaved(true);
          onSaveSuccess?.();
        } catch {}
      }, 800);
    },
    [onChange, onSaveSuccess],
  );

  function loadFile(file: File) {
    if (!file.name.endsWith(".md")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") onChange(text);
    };
    reader.readAsText(file, "utf-8");
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  }

  const hasIssues = validationResult && !validationResult.ok;

  return (
    <section className="rounded-lg border border-[#d8dde6] bg-white">
      {/* Header */}
      <div className="flex flex-col gap-4 px-7 pt-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-bold text-[#111827]">2. SKILL.md</h2>
          <p className="mt-3 text-sm leading-6 text-[#64748b]">{t("skill_md_content")}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs font-semibold text-[#2563eb]">{t("wizard_autosaved")}</span>}
          <input ref={fileInputRef} type="file" accept=".md" onChange={handleFileInput} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-semibold text-[#334155] transition-colors hover:bg-[#f8fbff]"
          >
            {t("select_file")}
          </button>
          {!showEmpty && (
            <button
              onClick={handleSave}
              className="rounded-lg border border-[#2f6fdd] bg-[#2f6fdd] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t("wizard_save") ?? "保存"}
            </button>
          )}
          {!showEmpty && (
            <button
              onClick={() => setPreviewMode((p) => !p)}
              className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 ${
                previewMode
                  ? "border-[#2f6fdd] bg-[#2f6fdd] text-white"
                  : "border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fbff]"
              }`}
            >
              {previewMode ? (
                <>
                  <PencilIcon className="h-3.5 w-3.5" />
                  {t("wizard_edit") ?? "编辑"}
                </>
              ) : (
                <>
                  <EyeIcon className="h-3.5 w-3.5" />
                  {t("wizard_preview") ?? "预览"}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Editor / Preview */}
      <div
        className="relative mx-7 mb-6 mt-6 overflow-hidden rounded-lg border border-[#d8dde6]"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) loadFile(file);
        }}
      >
        {/* Empty state overlay */}
        {showEmpty && (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed transition-all duration-200 ${
              dragOver ? "border-[#1d4ed8] bg-[#f8fbff]" : "border-[#d8dde6] bg-white"
            }`}
            style={{ minHeight: 320 }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex items-center gap-3">
              <svg
                className={`shrink-0 transition-colors ${dragOver ? "text-[#1d4ed8]" : "text-[#cbd5e1]"}`}
                width="28" height="28" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              <div>
                <p className="font-heading text-base font-semibold text-[#0f172a]">{t("skill_md_empty_title")}</p>
                <p className="mt-0.5 text-xs text-[#64748b]">{t("skill_md_empty_hint")}</p>
              </div>
            </div>
          </div>
        )}

        {previewMode && value.trim() ? (
          <div
            className="overflow-y-auto px-5 py-5"
            style={{ maxHeight: 600 }}
          >
            <FrontmatterCard meta={parsed.meta} />
            <div className="markdown-preview text-base leading-[1.7] text-[#0f172a] [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[#1d4ed8] [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-[#e2e8f0] [&_h2]:pb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1d4ed8] [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#1d4ed8] [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-[#0f172a] [&_p]:mt-3 [&_p]:leading-[1.7] [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:leading-[1.7] [&_code]:rounded [&_code]:bg-[#f8fafc] [&_code]:px-[4px] [&_code]:py-px [&_code]:text-sm [&_code]:font-mono [&_code]:text-[#1f2328] [&_pre]:mt-3 [&_pre]:overflow-auto [&_pre]:rounded [&_pre]:border [&_pre]:border-[#d8dde6] [&_pre]:bg-[#f8fafc] [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-[#1f2328] [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[#1f2328] [&_a]:text-[#1d4ed8] [&_a]:underline [&_strong]:font-semibold [&_strong]:text-[#0f172a] [&_em]:italic [&_blockquote]:border-l-4 [&_blockquote]:border-[#cbd5e1] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#64748b] [&_hr]:my-5 [&_hr]:border-none [&_hr]:border-t [&_hr]:border-[#e2e8f0] [&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-[#d8dde6] [&_th]:bg-[#f8fafc] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[#0f172a] [&_td]:border [&_td]:border-[#d8dde6] [&_td]:px-3 [&_td]:py-2 [&_td]:text-[#0f172a] [&_tr]:border-b [&_tr]:border-[#d8dde6] [&_tr:nth-child(even)]:bg-[#f8fafc]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {parsed.content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={t("skill_md_placeholder")}
            className="min-h-[360px] w-full resize-y border-0 bg-white px-5 py-5 font-mono text-sm leading-6 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none"
            spellCheck={false}
          />
        )}
      </div>

      {/* Validation results */}
      {validating && (
        <div className="mx-7 mb-6 flex items-center gap-3 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-4 py-2.5">
          <svg className="h-4 w-4 animate-spin text-[#1d4ed8]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-[#1e3a8a]">{t("wizard_validating")}</span>
        </div>
      )}

      {hasIssues && (
        <div className="mx-7 mb-6 space-y-1.5">
          {validationResult!.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-red-700">
                <CloseIcon className="h-3.5 w-3.5" /> {t("wizard_validation_errors")}
              </h4>
              <ul className="space-y-0.5">
                {validationResult!.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600">{err}</li>
                ))}
              </ul>
            </div>
          )}
          {validationResult!.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5">
              <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-[#8a6d2b]">
                <WarningIcon className="h-3.5 w-3.5" /> {t("wizard_validation_warnings")}
              </h4>
              <ul className="space-y-0.5">
                {validationResult!.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-[#7a6a5a]">{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {validationResult && validationResult.ok && (
        <div className="mx-7 mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <CheckIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-900">{t("wizard_validation_passed")}</span>
        </div>
      )}
    </section>
  );
}
