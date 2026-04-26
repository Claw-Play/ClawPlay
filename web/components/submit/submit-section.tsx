"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ButtonHTMLAttributes } from "react";
import { CheckIcon } from "@/components/icons";
import SkillDiagramPreview from "@/components/SkillDiagramPreview";
import { parseSkillNameFromMd } from "@/lib/submit-wizard";

interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

interface Props {
  t: (key: string) => string;
  skillMdContent: string;
  validationResult?: ValidationResult | null;
  onDiagramSuccess?: () => void;
  onSubmitSuccess?: () => void;
}

function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg border border-[#2f6fdd] bg-[#2f6fdd] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg border border-[#cbd5e1] bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export default function SubmitSection({ t, skillMdContent, validationResult, onDiagramSuccess, onSubmitSuccess }: Props) {
  const router = useRouter();
  const [diagramStatus, setDiagramStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [diagramMermaid, setDiagramMermaid] = useState("");
  const [diagramError, setDiagramError] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [submitError, setSubmitError] = useState("");

  const handleGenerateDiagram = useCallback(async () => {
    if (!skillMdContent) return;
    setDiagramStatus("loading");
    setDiagramError("");
    try {
      const res = await fetch("/api/skills/diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillMdContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDiagramMermaid(data.mermaid);
      setDiagramStatus("success");
      onDiagramSuccess?.();
    } catch (err) {
      setDiagramError(err instanceof Error ? err.message : String(err));
      setDiagramStatus("error");
    }
  }, [skillMdContent, onDiagramSuccess]);

  const handleSubmit = useCallback(async () => {
    setSubmitStatus("submitting");
    setSubmitError("");
    const name = parseSkillNameFromMd(skillMdContent) || "New Skill";
    try {
      const res = await fetch("/api/skills/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, skillMdContent, workflowMd: diagramMermaid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSubmitStatus("submitted");
      onSubmitSuccess?.();
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      setSubmitStatus("error");
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }, [skillMdContent, diagramMermaid, router, onSubmitSuccess]);

  const canSubmit = skillMdContent.trim().length > 0;
  const validationOkay = Boolean(validationResult?.ok);

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-[#d8dde6] bg-white px-7 py-6">
        <h2 className="font-heading text-xl font-bold text-[#111827]">
          3. {t("wizard_step4_title")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#64748b]">{t("wizard_step4_desc")}</p>

        <div className="mt-5 rounded-lg border border-[#d8dde6] bg-[#f8fafc] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#111827]">{t("diagram_preview_label")}</p>
            {diagramStatus === "success" && (
              <SecondaryButton onClick={handleGenerateDiagram}>{t("wizard_regenerate_diagram")}</SecondaryButton>
            )}
          </div>

          {diagramStatus === "idle" && (
            <PrimaryButton onClick={handleGenerateDiagram} disabled={!canSubmit}>
              {t("wizard_generate_diagram")}
            </PrimaryButton>
          )}

          {diagramStatus === "loading" && (
            <div className="flex items-center gap-3 rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-4">
              <svg className="h-5 w-5 animate-spin text-[#1d4ed8]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-[#1e3a8a]">{t("diagram_loading")}</span>
            </div>
          )}

          {diagramStatus === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">{diagramError}</p>
              <SecondaryButton className="mt-3" onClick={handleGenerateDiagram}>
                {t("wizard_regenerate_diagram")}
              </SecondaryButton>
            </div>
          )}

          {diagramStatus === "success" && (
            <div className="rounded-lg border border-[#d8dde6] bg-white p-4">
              <SkillDiagramPreview skillMdContent={skillMdContent} initialMermaid={diagramMermaid} compact />
            </div>
          )}
        </div>

        {validationResult && validationOkay && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-900">{t("wizard_validation_passed")}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[#d8dde6] bg-white px-7 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold text-[#111827]">4. {t("wizard_submit")}</h2>
            <p className="mt-3 text-sm leading-6 text-[#64748b]">{t("wizard_step5_desc")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {submitStatus === "idle" && (
              <PrimaryButton onClick={handleSubmit} disabled={!canSubmit}>
                {t("wizard_submit")}
              </PrimaryButton>
            )}

            {submitStatus === "submitting" && (
              <div className="flex items-center gap-3 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-4 py-3">
                <svg className="h-5 w-5 animate-spin text-[#1d4ed8]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-[#1e3a8a]">{t("wizard_submitting")}</span>
              </div>
            )}

            {submitStatus === "error" && (
              <SecondaryButton onClick={handleSubmit}>{t("wizard_retry")}</SecondaryButton>
            )}

            {submitStatus === "submitted" && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckIcon className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-900">{t("wizard_submitted")}</span>
              </div>
            )}
          </div>
        </div>
        {submitStatus === "error" && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{submitError}</p>
          </div>
        )}
      </div>
    </section>
  );
}
