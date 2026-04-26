"use client";

import { useT } from "@/lib/i18n/context";
import { CheckIcon } from "@/components/icons";

interface Props {
  abilitiesSelected: boolean;
  skillSaved: boolean;
  diagramDone: boolean;
  submitted: boolean;
}

const STEPS: Array<{ key: string; done: (p: Props) => boolean }> = [
  { key: "workflow_step1", done: (p) => p.abilitiesSelected },
  { key: "workflow_step2", done: (p) => p.skillSaved },
  { key: "workflow_step3", done: (p) => p.diagramDone },
  { key: "workflow_step4", done: (p) => p.submitted },
];

function Step({ done, index, label }: { done: boolean; index: number; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition-colors ${
          done
            ? "border-[#2f6fdd] bg-[#2f6fdd] text-white"
            : "border-[#d6dde8] bg-white text-[#64748b]"
        }`}
      >
        {done ? <CheckIcon className="h-4 w-4" strokeWidth={3} /> : index}
      </span>
      <span className={`text-sm font-medium ${done ? "text-[#111827]" : "text-[#64748b]"}`}>
        {label}
      </span>
    </div>
  );
}

export default function WorkflowIndicator({
  abilitiesSelected,
  skillSaved,
  diagramDone,
  submitted,
}: Props) {
  const t = useT("submit");
  const props: Props = { abilitiesSelected, skillSaved, diagramDone, submitted };

  return (
    <nav aria-label={t("workflow_label")} className="w-full overflow-x-auto">
      <ol className="flex min-w-max items-center gap-5">
        {STEPS.map((step, index) => {
          const done = step.done(props);
          return (
            <li key={step.key} className="flex items-center gap-5">
              <Step done={done} index={index + 1} label={t(step.key)} />
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`h-px w-20 rounded-full ${done ? "bg-[#b9cdf4]" : "bg-[#d6dde8]"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
