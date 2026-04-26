"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { ChevronDownIcon, CheckIcon } from "@/components/icons";

interface Props {
  t: (key: string) => string;
}

const STEPS = [
  { key: "instruction_1", descKey: "instruction_1_desc" },
  { key: "instruction_2", descKey: "instruction_2_desc" },
  { key: "instruction_3", descKey: "instruction_3_desc" },
  { key: "instruction_4", descKey: "instruction_4_desc" },
];

export default function AgentGuide({ t }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-[28px] border border-[#eadac0] bg-white shadow-[0_8px_20px_rgba(86,67,55,0.06)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="font-heading text-xl font-extrabold text-[#3d2a18]">
          {t("wizard_step2_title")}
        </h2>
        <ChevronDownIcon className={`h-5 w-5 text-[#8a755f] transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="space-y-4 px-6 pb-6">
          <p className="text-sm text-[#7a6a5a]">{t("wizard_step2_desc")}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {STEPS.map(({ key, descKey }, i) => (
              <div key={key} className="flex items-start gap-3 rounded-[20px] border border-[#eee3cf] bg-[#fffdf7] p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#a23f00] to-[#fa7025] text-white text-sm font-bold">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#3d2a18]">{t(`wizard_${key}`)}</p>
                  <p className="mt-0.5 text-xs text-[#7a6a5a]">{t(`wizard_${descKey}`)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[20px] border border-[#d4c5a8] bg-[#fffdf7] p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#7f8f45]">
              <CheckIcon className="h-3 w-3" />
              {t("wizard_step2_tips_title")}
            </h3>
            <ul className="space-y-1 text-sm text-[#564337]">
              <li>{t("wizard_step2_tip_1")}</li>
              <li>{t("wizard_step2_tip_2")}</li>
              <li>{t("wizard_step2_tip_3")}</li>
              <li>{t("wizard_step2_tip_4")}</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
