"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "@/components/icons";
import { buildGuideContent } from "@/lib/submit-wizard";
import type { ComposeAbility, ComposeModule } from "@/lib/submit-wizard";

interface Props {
  t: (key: string) => string;
  selectedAbilities: ComposeAbility[];
  selectedModules: ComposeModule[];
  guideContent: string;
  onToggleAbility: (a: ComposeAbility) => void;
  onToggleModule: (m: ComposeModule) => void;
  onGenerateGuide: (content: string) => void;
}

const ABILITIES: ComposeAbility[] = ["image", "llm", "vision"];
const MODULES: ComposeModule[] = ["profile_pack", "starter_examples", "submission_notes"];

export default function CapabilitySelector({
  t,
  selectedAbilities,
  selectedModules,
  guideContent,
  onToggleAbility,
  onToggleModule,
  onGenerateGuide,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(guideContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleGenerate() {
    onGenerateGuide(buildGuideContent(selectedAbilities, selectedModules));
    setGenerated(true);
  }

  return (
    <section className="rounded-lg border border-[#d8dde6] bg-white">
      <div className="px-7 pt-6">
        <h2 className="font-heading text-xl font-bold text-[#111827]">
          1. {t("wizard_select_abilities")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#64748b]">{t("wizard_select_abilities_desc")}</p>
      </div>

      <div className="space-y-5 px-7 py-6">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {ABILITIES.map((ability) => {
              const active = selectedAbilities.includes(ability);
              return (
                <button
                  key={ability}
                  type="button"
                  onClick={() => onToggleAbility(ability)}
                  className={`flex min-h-[48px] items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-150 ${
                    active
                      ? "border-[#2f6fdd] bg-[#f3f7ff]"
                      : "border-[#d8dde6] bg-white hover:border-[#c7d2fe] hover:bg-[#f8fbff]"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      active ? "border-[#2f6fdd] bg-[#2f6fdd] shadow-[inset_0_0_0_3px_white]" : "border-[#cbd5e1] bg-white"
                    }`}
                    aria-hidden
                  />
                  <span className={`text-sm font-semibold ${active ? "text-[#2f6fdd]" : "text-[#334155]"}`}>
                    {t(`compose_ability_${ability}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold text-[#64748b]">
              {t("wizard_select_modules")}
            </h3>
            <span className="text-xs text-[#94a3b8]">{selectedModules.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MODULES.map((module) => {
              const active = selectedModules.includes(module);
              return (
                <button
                  key={module}
                  type="button"
                  onClick={() => onToggleModule(module)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                    active
                      ? "border-[#1d4ed8] bg-[#eff6ff] text-[#1d4ed8]"
                      : "border-[#d8dde6] bg-white text-[#334155] hover:border-[#c7d2fe] hover:bg-[#f8fbff]"
                  }`}
                >
                  {t(`compose_module_${module}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={selectedAbilities.length === 0}
            className="inline-flex items-center justify-center rounded-lg border border-[#2f6fdd] bg-[#2f6fdd] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t(generated ? "wizard_regenerate_guide" : "wizard_generate_guide")}
          </button>
          <span className="text-sm leading-6 text-[#64748b]">
            {selectedAbilities.length === 0 ? t("wizard_ability_required") : t("wizard_guide_desc")}
          </span>
        </div>

        {guideContent && (
          <div className="rounded-lg border border-[#d8dde6] bg-[#f8fafc] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#0f172a]">{t("wizard_guide_heading")}</h3>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#f8fbff]"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-[#1d4ed8]" />
                    {t("wizard_copied")}
                  </>
                ) : (
                  <>
                    <CopyIcon className="h-4 w-4" />
                    {t("wizard_copy_guide")}
                  </>
                )}
              </button>
            </div>
            <pre className="max-h-[340px] overflow-auto whitespace-pre-wrap rounded-lg border border-[#d8dde6] bg-white p-4 font-mono text-sm leading-6 text-[#1f2328]">
              {guideContent}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
