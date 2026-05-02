"use client";

import type { ReactNode } from "react";
import { CheckIcon, ChevronRightIcon, WarningIcon } from "@/components/icons";
import CollapsibleCardHeader from "@/components/CollapsibleCardHeader";

export type SubmitGateStatusTone = "success" | "warning";
export type SubmitGateSubmitStatus = "idle" | "submitting" | "submitted" | "error";

export interface SubmitGateStep {
  label: ReactNode;
  done: boolean;
  current: boolean;
  targetId: string;
  statusText: ReactNode;
}

interface Props {
  title: ReactNode;
  titleIcon: ReactNode;
  titleIconWrapperClassName?: string;
  statusTone: SubmitGateStatusTone;
  statusTitle: ReactNode;
  statusHint: ReactNode;
  identity?: ReactNode;
  steps: SubmitGateStep[];
  note: ReactNode;
  submitStatus: SubmitGateSubmitStatus;
  submitError?: ReactNode;
  canSubmit: boolean;
  onSubmit: () => void;
  submitButtonLabel: ReactNode;
  submittingLabel: ReactNode;
  submittedLabel: ReactNode;
  retryLabel: ReactNode;
  onNavigateStep?: (targetId: string) => void;
}

function StepIcon({ done, current }: { done: boolean; current: boolean }) {
  if (done) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#28a745] text-white">
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }

  if (current) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f6c75f] text-white">
        <WarningIcon className="h-3.5 w-3.5" />
      </span>
    );
  }

  return <span className="h-5 w-5 rounded-full border border-[#d8dde6] bg-white" aria-hidden />;
}

function StepRow({
  label,
  done,
  current,
  targetId,
  onNavigateStep,
  statusText,
}: {
  label: ReactNode;
  done: boolean;
  current: boolean;
  targetId: string;
  onNavigateStep: (targetId: string) => void;
  statusText: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigateStep(targetId)}
      className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f8fbff] focus:outline-none focus:ring-2 focus:ring-[#2f6fdd]/20"
      aria-label={typeof label === "string" ? label : undefined}
    >
      <div className="flex min-w-0 items-center gap-3">
        <StepIcon done={done} current={current} />
        <span className="truncate text-sm font-medium text-[#111827]">{label}</span>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
          current
            ? "border-[#f2d38f] bg-[#fffaf0] text-[#b7791f] group-hover:bg-[#fff6e4]"
            : done
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[#d8dde6] bg-white text-[#8f98aa]"
        }`}
      >
        <span>{statusText}</span>
        {current && <ChevronRightIcon className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

function LightbulbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M9 18h6m-5 2h4m-6-8a5 5 0 1 1 8.2 3.9c-.8.6-1.2 1.2-1.4 2.1H9.2c-.2-.9-.6-1.5-1.4-2.1A4.98 4.98 0 0 1 7 12c0-2.8 2.2-5 5-5s5 2.2 5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SubmitGateCardShell({
  title,
  titleIcon,
  titleIconWrapperClassName,
  statusTone,
  statusTitle,
  statusHint,
  identity,
  steps,
  note,
  submitStatus,
  submitError,
  canSubmit,
  onSubmit,
  submitButtonLabel,
  submittingLabel,
  submittedLabel,
  retryLabel,
  onNavigateStep,
}: Props) {
  const statusClass =
    statusTone === "warning" ? "border-[#f2d38f] bg-[#fffaf0]" : "border-emerald-200 bg-[#f7fbf8]";
  const badgeClass =
    statusTone === "warning" ? "bg-[#fff0cd] text-[#e3a43b]" : "bg-emerald-100 text-emerald-600";

  return (
    <section className="rounded-lg border border-[#d8dde6] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <CollapsibleCardHeader
        outerPaddingClassName=""
        showToggle={false}
        title={title}
        open={true}
        onToggle={() => {}}
        icon={titleIcon}
        iconWrapperClassName={titleIconWrapperClassName}
      />

      <div className={`mt-4 rounded-lg border px-4 py-4 ${statusClass}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${badgeClass}`}>
            {statusTone === "success" ? <CheckIcon className="h-4 w-4" /> : <WarningIcon className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className={`text-[17px] font-extrabold ${statusTone === "success" ? "text-emerald-950" : "text-[#7a4b00]"}`}>
              {statusTitle}
            </p>
            <p className={`mt-1 text-sm leading-6 ${statusTone === "success" ? "text-emerald-800" : "text-[#8b5e18]"}`}>
              {statusHint}
            </p>
          </div>
        </div>
      </div>

      {identity}

      <div className="mt-5 space-y-1.5">
        {steps.map((step) => (
          <StepRow
            key={String(step.targetId)}
            label={step.label}
            done={step.done}
            current={step.current}
            targetId={step.targetId}
            onNavigateStep={onNavigateStep ?? (() => {})}
            statusText={step.statusText}
          />
        ))}
      </div>

      <div className="my-5 border-t border-[#e5e9f1]" />

      <div className="flex items-start gap-2 text-sm leading-6 text-[#6b7280]">
        <span className="mt-1 text-[#8ea0c7]">
          <LightbulbIcon />
        </span>
        <p>{note}</p>
      </div>

      <div className="mt-4">
        {submitStatus === "idle" && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="flex h-14 w-full items-center justify-center rounded-lg bg-[#5f7ce5] text-base font-semibold text-white shadow-[0_10px_20px_rgba(95,124,229,0.22)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitButtonLabel}
          </button>
        )}

        {submitStatus === "submitting" && (
          <div className="flex h-14 items-center justify-center gap-3 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-4">
            <svg className="h-5 w-5 animate-spin text-[#1d4ed8]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium text-[#1e3a8a]">{submittingLabel}</span>
          </div>
        )}

        {submitStatus === "submitted" && (
          <div className="flex h-14 items-center justify-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4">
            <CheckIcon className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-900">{submittedLabel}</span>
          </div>
        )}

        {submitStatus === "error" && (
          <>
            <button
              type="button"
              onClick={onSubmit}
              className="flex h-14 w-full items-center justify-center rounded-lg bg-[#5f7ce5] text-base font-semibold text-white shadow-[0_10px_20px_rgba(95,124,229,0.22)] transition-opacity hover:opacity-95"
            >
              {retryLabel}
            </button>
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
