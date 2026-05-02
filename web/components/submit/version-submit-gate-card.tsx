"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import SubmitGateCardShell, {
  type SubmitGateStep,
} from "@/components/submit/submit-gate-card-shell";
import type { ValidationResult } from "@/components/submit/submit-section";

interface Props {
  t: (key: string, values?: Record<string, string | number>) => string;
  slug: string;
  name: string;
  version: string;
  basicInfoDone: boolean;
  versionInfoDone: boolean;
  skillSaved: boolean;
  diagramDone: boolean;
  changelog: string;
  skillMdContent: string;
  validationResult?: ValidationResult | null;
  onSubmitSuccess?: () => void;
  onNavigateStep?: (targetId: string) => void;
}

type GateReason = "basic_info" | "version_info" | "save_required" | "skill_md" | "diagram" | "ready";

function getGateReason({
  basicInfoDone,
  versionInfoDone,
  skillSaved,
  diagramDone,
  validationResult,
}: Pick<Props, "basicInfoDone" | "versionInfoDone" | "skillSaved" | "diagramDone" | "validationResult">): GateReason {
  if (!basicInfoDone) return "basic_info";
  if (!versionInfoDone) return "version_info";
  if (!skillSaved) return "save_required";
  if (validationResult && !validationResult.ok) return "skill_md";
  if (!diagramDone) return "diagram";
  return "ready";
}

function submitStepKey(reason: GateReason): string {
  switch (reason) {
    case "basic_info":
      return "workflow_step0";
    case "version_info":
      return "workflow_step1";
    case "save_required":
    case "skill_md":
      return "workflow_step2";
    case "diagram":
      return "workflow_step3";
    case "ready":
    default:
      return "workflow_step4";
  }
}

function getStatusHint(t: Props["t"], reason: GateReason): string {
  const stepLabel = t(submitStepKey(reason));
  switch (reason) {
    case "basic_info":
      return t("gate_hint_basic_info", { step: stepLabel });
    case "version_info":
      return t("gate_hint_version_info", { step: stepLabel });
    case "save_required":
      return t("gate_hint_save_required");
    case "skill_md":
      return t("gate_hint_skill_md");
    case "diagram":
      return t("gate_hint_diagram");
    case "ready":
    default:
      return t("gate_hint_ready");
  }
}

export default function VersionSubmitGateCard({
  t,
  slug,
  name,
  version,
  basicInfoDone,
  versionInfoDone,
  skillSaved,
  diagramDone,
  changelog,
  skillMdContent,
  validationResult,
  onSubmitSuccess,
  onNavigateStep,
}: Props) {
  const router = useRouter();
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [submitError, setSubmitError] = useState("");

  const versionInfoComplete = versionInfoDone && changelog.trim().length > 0;
  const gateReason = getGateReason({
    basicInfoDone,
    versionInfoDone: versionInfoComplete,
    skillSaved,
    diagramDone,
    validationResult,
  });
  const canSubmit = gateReason === "ready";
  const stepKey = submitStepKey(gateReason);
  const titleText = canSubmit ? t("wizard_submit_ready") : t("wizard_submit_blocked", { step: t(stepKey) });
  const hintText = getStatusHint(t, gateReason);
  const noteText = t("wizard_submit_gate_note");

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      setSubmitStatus("error");
      setSubmitError(t("submission_failed"));
      return;
    }

    setSubmitStatus("submitting");
    setSubmitError("");
    try {
      const res = await fetch(`/api/skills/${slug}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: version.trim(),
          changelog: changelog.trim(),
          skillMdContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("submission_failed"));
      setSubmitStatus("submitted");
      onSubmitSuccess?.();
      setTimeout(() => router.push(`/skills/${slug}/versions`), 1800);
    } catch (err) {
      setSubmitStatus("error");
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }, [canSubmit, changelog, router, skillMdContent, slug, t, version, onSubmitSuccess]);

  const steps: SubmitGateStep[] = [
    {
      label: t("workflow_step0"),
      targetId: "version-basic-info",
      done: basicInfoDone,
      current: gateReason === "basic_info",
      statusText: t(basicInfoDone ? "workflow_done" : gateReason === "basic_info" ? "workflow_pending" : "workflow_todo"),
    },
    {
      label: t("workflow_step1"),
      targetId: "version-info",
      done: versionInfoComplete,
      current: gateReason === "version_info",
      statusText: t(versionInfoComplete ? "workflow_done" : gateReason === "version_info" ? "workflow_pending" : "workflow_todo"),
    },
    {
      label: t("workflow_step2"),
      targetId: "version-skill-md",
      done: skillSaved,
      current: gateReason === "save_required" || gateReason === "skill_md",
      statusText: t(
        skillSaved
          ? "workflow_done"
          : gateReason === "save_required" || gateReason === "skill_md"
            ? "workflow_pending"
            : "workflow_todo",
      ),
    },
    {
      label: t("workflow_step3"),
      targetId: "version-diagram",
      done: diagramDone,
      current: gateReason === "diagram",
      statusText: t(diagramDone ? "workflow_done" : gateReason === "diagram" ? "workflow_pending" : "workflow_todo"),
    },
  ];

  const identity = (
    <div className="mt-4 rounded-lg border border-[#d8dde6] bg-[#f8fafc] px-4 py-3 text-sm text-[#334155]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#111827]">{name}</p>
          <p className="truncate text-xs text-[#64748b]">{slug}</p>
        </div>
        <span className="rounded-full border border-[#dbe5f7] bg-white px-2.5 py-1 text-xs font-semibold text-[#2f6fdd]">
          v{version.trim() || "—"}
        </span>
      </div>
    </div>
  );

  return (
    <SubmitGateCardShell
      title={t("wizard_submit_gate_title")}
      titleIcon={
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M12 2 4 5.5v5.7c0 4.8 3.2 9.2 8 10.8 4.8-1.6 8-6 8-10.8V5.5L12 2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M9.2 12.1 11 13.9l3.9-4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
      titleIconWrapperClassName="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8e1f4] bg-[#f6f8fe] text-[#5b7ce7]"
      statusTone={canSubmit ? "success" : "warning"}
      statusTitle={titleText}
      statusHint={hintText}
      identity={identity}
      steps={steps}
      note={noteText}
      submitStatus={submitStatus}
      submitError={submitError}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      submitButtonLabel={t("submit_btn")}
      submittingLabel={t("wizard_submitting")}
      submittedLabel={t("wizard_submitted")}
      retryLabel={t("submit_btn")}
      onNavigateStep={onNavigateStep}
    />
  );
}
