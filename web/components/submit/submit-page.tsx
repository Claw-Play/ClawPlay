"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import type { ComposeAbility, ComposeModule } from "@/lib/submit-wizard";

import CapabilitySelector from "@/components/submit/capability-selector";
import SkillMdEditor from "@/components/submit/skill-md-editor";
import SubmitSection from "@/components/submit/submit-section";
import WorkflowIndicator from "@/components/submit/workflow-indicator";
import { ChevronDownIcon } from "@/components/icons";

function HelpCard({
  title,
  description,
  items,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  items: string[];
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-lg border border-[#d8dde6] bg-white"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-5">
        <div className="min-w-0">
          <p className="text-base font-bold text-[#111827]">{title}</p>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">{description}</p>
        </div>
        <ChevronDownIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#94a3b8] transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">
        <ul className="space-y-2 border-t border-[#edf1f6] pt-3 text-sm leading-6 text-[#475569]">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#93c5fd]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export default function SubmitPage() {
  const router = useRouter();
  const t = useT("submit");
  const [abilities, setAbilities] = useState<ComposeAbility[]>(["llm"]);
  const [modules, setModules] = useState<ComposeModule[]>(["submission_notes"]);
  const [guideContent, setGuideContent] = useState("");
  const [skillMdContent, setSkillMdContent] = useState("");
  const [skillSaved, setSkillSaved] = useState(false);
  const [diagramDone, setDiagramDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    ok: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => {
        if (!r.ok) throw new Error();
      })
      .catch(() => router.push("/login"));
  }, [router]);

  function toggleAbility(a: ComposeAbility) {
    setAbilities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function toggleModule(m: ComposeModule) {
    setModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  const helpCards = [
    {
      title: t("help_writing_title"),
      description: t("help_writing_desc"),
      items: [t("help_writing_item_1"), t("help_writing_item_2"), t("help_writing_item_3")],
    },
    {
      title: t("help_practices_title"),
      description: t("help_practices_desc"),
      items: [t("help_practices_item_1"), t("help_practices_item_2"), t("help_practices_item_3")],
    },
    {
      title: t("help_errors_title"),
      description: t("help_errors_desc"),
      items: [t("help_errors_item_1"), t("help_errors_item_2"), t("help_errors_item_3")],
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbfcfe]">
      <div className="relative mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
          <WorkflowIndicator
            abilitiesSelected={abilities.length > 0}
            skillSaved={skillSaved}
            diagramDone={diagramDone}
            submitted={submitted}
          />
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-6">
            <CapabilitySelector
              t={t}
              selectedAbilities={abilities}
              selectedModules={modules}
              guideContent={guideContent}
              onToggleAbility={toggleAbility}
              onToggleModule={toggleModule}
              onGenerateGuide={setGuideContent}
            />

            <SkillMdEditor
              t={t}
              value={skillMdContent}
              onChange={setSkillMdContent}
              onValidationResult={setValidationResult}
              onSaveSuccess={() => setSkillSaved(true)}
            />

            <SubmitSection
              t={t}
              skillMdContent={skillMdContent}
              validationResult={validationResult}
              onDiagramSuccess={() => setDiagramDone(true)}
              onSubmitSuccess={() => setSubmitted(true)}
            />
          </main>

          <aside className="space-y-4 lg:pt-1">
            {helpCards.map((card, index) => (
              <HelpCard
                key={card.title}
                title={card.title}
                description={card.description}
                items={card.items}
                defaultOpen={index === 0}
              />
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
