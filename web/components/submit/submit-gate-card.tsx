"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShieldIcon } from "@/components/icons";
import SubmitGateCardShell, {
  type SubmitGateStep,
} from "@/components/submit/submit-gate-card-shell";
import {
  buildFallbackWorkflow,
  getSubmitGateReason,
  type ValidationResult,
} from "@/components/submit/submit-section";

interface Props {
  t: (key: string, values?: Record<string, string | number>) => string;
  basicInfoDone: boolean;
  abilitiesSelected: boolean;
  skillSaved: boolean;
  diagramDone: boolean;
  name: string;
  summary: string;
  repoUrl: string;
  iconEmoji: string;
  skillMdContent: string;
  diagramMermaid: string;
  validationResult?: ValidationResult | null;
  onSubmitSuccess?: () => void;
  onNavigateStep?: (targetId: string) => void;
}

function submitStepKey(reason: ReturnType<typeof getSubmitGateReason>): string {
  switch (reason) {
    case "basic_info":
      return "workflow_step0";
    case "abilities":
      return "workflow_step1";
    case "save_required":
    case "skill_md":
      return "workflow_step2";
    case "diagram":
    case "ready":
    default:
      return "workflow_step3";
  }
}

function getStatusHint(t: Props["t"], reason: ReturnType<typeof getSubmitGateReason>): string {
  const stepLabel = t(submitStepKey(reason));
  switch (reason) {
    case "basic_info":
      return t("gate_hint_basic_info", { step: stepLabel });
    case "abilities":
      return t("gate_hint_abilities", { step: stepLabel });
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

export default function SubmitGateCard({
  t,
  basicInfoDone,
  abilitiesSelected,
  skillSaved,
  diagramDone,
  name,
  summary,
  repoUrl,
  iconEmoji,
  skillMdContent,
  diagramMermaid,
  validationResult,
  onSubmitSuccess,
  onNavigateStep,
}: Props) {
  const router = useRouter();
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [submitError, setSubmitError] = useState("");

  const submitGateReason = getSubmitGateReason({
    basicInfoDone,
    abilitiesSelected,
    skillSaved,
    diagramDone,
    skillMdContent,
    validationResult,
  });
  const canSubmit = submitGateReason === "ready";
  const stepKey = submitStepKey(submitGateReason);
  const titleText = canSubmit ? t("wizard_submit_ready") : t("wizard_submit_blocked", { step: t(stepKey) });
  const hintText = getStatusHint(t, submitGateReason);
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
      const workflowMd = diagramMermaid.trim() || buildFallbackWorkflow(skillMdContent);
      const res = await fetch("/api/skills/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          summary: summary.trim(),
          repoUrl: repoUrl.trim(),
          iconEmoji,
          skillMdContent,
          workflowMd,
        }),
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
  }, [canSubmit, diagramMermaid, iconEmoji, name, onSubmitSuccess, repoUrl, router, skillMdContent, summary, t]);

  const steps: SubmitGateStep[] = [
    {
      label: t("workflow_step0"),
      targetId: "submit-basic-info",
      done: basicInfoDone,
      current: submitGateReason === "basic_info",
      statusText: t(
        basicInfoDone ? "workflow_done" : submitGateReason === "basic_info" ? "workflow_pending" : "workflow_todo",
      ),
    },
    {
      label: t("workflow_step1"),
      targetId: "submit-abilities",
      done: abilitiesSelected,
      current: submitGateReason === "abilities",
      statusText: t(
        abilitiesSelected ? "workflow_done" : submitGateReason === "abilities" ? "workflow_pending" : "workflow_todo",
      ),
    },
    {
      label: t("workflow_step2"),
      targetId: "submit-skill-md",
      done: skillSaved,
      current: submitGateReason === "save_required" || submitGateReason === "skill_md",
      statusText: t(
        skillSaved
          ? "workflow_done"
          : submitGateReason === "save_required" || submitGateReason === "skill_md"
            ? "workflow_pending"
            : "workflow_todo",
      ),
    },
    {
      label: t("workflow_step3"),
      targetId: "submit-diagram",
      done: diagramDone,
      current: submitGateReason === "diagram",
      statusText: t(diagramDone ? "workflow_done" : submitGateReason === "diagram" ? "workflow_pending" : "workflow_todo"),
    },
  ];

  return (
    <SubmitGateCardShell
      title={t("wizard_submit_gate_title")}
      titleIcon={<AdminShieldIcon className="h-5 w-5" />}
      titleIconWrapperClassName="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8e1f4] bg-[#f6f8fe] text-[#5b7ce7]"
      statusTone={canSubmit ? "success" : "warning"}
      statusTitle={titleText}
      statusHint={hintText}
      steps={steps}
      note={noteText}
      submitStatus={submitStatus}
      submitError={submitError}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      submitButtonLabel={t("wizard_submit")}
      submittingLabel={t("wizard_submitting")}
      submittedLabel={t("wizard_submitted")}
      retryLabel={t("wizard_submit")}
      onNavigateStep={onNavigateStep}
    />
  );
}
