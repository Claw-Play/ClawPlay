"use client";

import { startTransition, useEffect, useRef, useState, useCallback } from "react";
import { WarningIcon, CloseIcon } from "@/components/icons";
import { ModeToggleButton, SkillMdWorkspace } from "@/components/SkillWorkspace";

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
  onValidationResult?: (result: ValidationResult | null) => void;
  validationResult?: ValidationResult | null;
  draftStorageKey?: string;
}

export const SUBMIT_DRAFT_STORAGE_KEY = "clawplay_submit_draft";

export function clearSubmitDraft(draftStorageKey = SUBMIT_DRAFT_STORAGE_KEY): void {
  try {
    localStorage.removeItem(draftStorageKey);
  } catch {}
}

export default function SkillMdEditor({
  t,
  value,
  onChange,
  onSave,
  onSaveSuccess,
  onValidationResult,
  validationResult,
  draftStorageKey = SUBMIT_DRAFT_STORAGE_KEY,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftValue, setDraftValue] = useState(value);
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saveCheckState, setSaveCheckState] = useState<"idle" | "saving" | "passed" | "failed">("idle");
  const [dragOver, setDragOver] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showEmpty = !draftValue.trim() && !previewMode;
  const displayedValidationResult = validationResult ?? null;

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    if (draftValue.trim()) return;

    clearTimeout(timerRef.current);
    setDraftValue(value);
    setSaved(false);
    setValidating(false);
    setSaveCheckState("idle");
    setPreviewMode(false);
    setDragOver(false);
  }, [draftValue, value]);

  function handleSave() {
    clearTimeout(timerRef.current);
    setSaveCheckState("saving");
    try {
      localStorage.setItem(draftStorageKey, draftValue);
      setSaved(true);
    } catch {}

    if (!validating) {
      setValidating(true);
      setPreviewMode(true);
      fetch("/api/skills/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillMdContent: draftValue }),
      })
        .then((r) => r.json())
        .then((data) => {
          const result: ValidationResult = data.safe
            ? { ok: true, errors: [], warnings: data.warnings ?? [] }
            : { ok: false, errors: data.errors ?? [], warnings: data.warnings ?? [] };
          onValidationResult?.(result);
          if (result.ok) {
            onSaveSuccess?.();
          }
          setSaveCheckState(result.ok ? "passed" : "failed");
        })
        .catch(() => {
          onValidationResult?.(validationResult ?? null);
          setSaveCheckState("failed");
        })
        .finally(() => setValidating(false));
    } else {
      setPreviewMode(true);
      setSaveCheckState("passed");
    }

    onSave?.();
  }

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftStorageKey);
      if (savedDraft) onChange(savedDraft);
    } catch {}
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey, onChange]);

  const handleChange = useCallback(
    (content: string) => {
      setDraftValue(content);
      clearTimeout(timerRef.current);
      setSaved(false);
      setSaveCheckState("idle");
      startTransition(() => onChange(content));
      timerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(draftStorageKey, content);
          setSaved(true);
        } catch {}
    }, 800);
  },
    [draftStorageKey, onChange],
  );

  function loadFile(file: File) {
    if (!file.name.endsWith(".md")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        setDraftValue(text);
        startTransition(() => onChange(text));
        setSaveCheckState("idle");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  }

  const hasIssues = displayedValidationResult && !displayedValidationResult.ok;
  const liveStatusText = displayedValidationResult
    ? displayedValidationResult.ok
      ? t("wizard_live_validation_passed")
      : displayedValidationResult.errors.length > 0
        ? `${t("wizard_live_validation_errors_prefix")} ${displayedValidationResult.errors.length}`
        : `${t("wizard_live_validation_warnings_prefix")} ${displayedValidationResult.warnings.length}`
    : "";
  const saveCheckStatusText =
    saveCheckState === "passed"
      ? t("wizard_save_check_passed")
      : saveCheckState === "failed"
        ? t("wizard_save_check_failed")
        : t("wizard_save_checking");

  const actions = (
    <>
      {saved && <span className="text-xs font-semibold text-[#2563eb]">{t("wizard_autosaved")}</span>}
      {!showEmpty && (
        <ModeToggleButton
          mode={previewMode ? "preview" : "edit"}
          onClick={() => {
            startTransition(() => setPreviewMode((p) => !p));
          }}
          editLabel={t("wizard_edit") ?? "编辑"}
          previewLabel={t("wizard_preview") ?? "预览"}
        />
      )}
      {!showEmpty && (
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg border border-[#2f6fdd] bg-[#2f6fdd] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          {t("wizard_save") ?? "保存"}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept=".md" onChange={handleFileInput} className="hidden" />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-semibold text-[#334155] transition-colors hover:bg-[#f8fbff]"
      >
        {t("select_file")}
      </button>
    </>
  );

  const emptyState = showEmpty ? (
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
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
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
  ) : null;

  const workspaceContentProps = {
    className: showEmpty ? "border-0 bg-transparent p-0" : "",
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
  };

  const footer = (
    <>
      {draftValue.trim().length > 0 && displayedValidationResult && (
        <div className="mx-7 mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#d8dde6] bg-[#f8fafc] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
                displayedValidationResult.ok
                  ? "bg-emerald-500"
                  : displayedValidationResult.errors.length > 0
                    ? "bg-red-500"
                    : "bg-amber-500"
              }`}
            />
            <p className="truncate text-xs font-semibold text-[#334155]">{liveStatusText}</p>
          </div>
          <p className="shrink-0 text-[11px] text-[#64748b]">{t("wizard_live_validation_hint")}</p>
        </div>
      )}

      {validating && (
        <div className="mx-7 mb-6 flex items-center gap-3 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-4 py-2.5">
          <svg className="h-4 w-4 animate-spin text-[#1d4ed8]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-[#1e3a8a]">{t("wizard_save_checking")}</span>
        </div>
      )}

      {!validating && saveCheckState !== "idle" && (
        <div className="mx-7 mb-6 flex items-center justify-between gap-3 rounded-lg border border-[#d8dde6] bg-[#f8fafc] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
                saveCheckState === "passed" ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <p className="truncate text-xs font-semibold text-[#334155]">{saveCheckStatusText}</p>
          </div>
          <p className="shrink-0 text-[11px] text-[#64748b]">{t("wizard_save_check_hint")}</p>
        </div>
      )}

      {hasIssues && (
        <div className="mx-7 mb-6 space-y-1.5">
          {displayedValidationResult!.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-red-700">
                <CloseIcon className="h-3.5 w-3.5" /> {t("wizard_validation_errors")}
              </h4>
              <ul className="space-y-0.5">
                {displayedValidationResult!.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600">{err}</li>
                ))}
              </ul>
            </div>
          )}
          {displayedValidationResult!.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5">
              <h4 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-[#8a6d2b]">
                <WarningIcon className="h-3.5 w-3.5" /> {t("wizard_validation_warnings")}
              </h4>
              <ul className="space-y-0.5">
                {displayedValidationResult!.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-[#52617d]">{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <SkillMdWorkspace
      title="3. SKILL.md"
      description={t("skill_md_content")}
      value={draftValue}
      mode={previewMode ? "preview" : "edit"}
      onChange={handleChange}
      placeholder={t("skill_md_placeholder")}
      actions={actions}
      footer={footer}
      emptyState={emptyState}
      collapsible
      contentProps={workspaceContentProps}
    />
  );
}
