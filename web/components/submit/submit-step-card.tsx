"use client";

import type { ReactNode } from "react";
import CollapsibleCardHeader from "@/components/CollapsibleCardHeader";

interface Props {
  title: ReactNode;
  stepNumber?: ReactNode;
  description?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  id?: string;
  tabIndex?: number;
}

export default function SubmitStepCard({
  title,
  stepNumber,
  description,
  open,
  onToggle,
  children,
  id,
  tabIndex,
}: Props) {
  return (
    <section
      id={id}
      tabIndex={tabIndex}
      className="scroll-mt-24 rounded-[6px] border border-[#dbe5f7] bg-white shadow-[0_8px_20px_rgba(25,43,87,0.06)]"
    >
      <CollapsibleCardHeader
        title={stepNumber != null ? <>{stepNumber}. {title}</> : title}
        description={description}
        open={open}
        onToggle={onToggle}
        outerPaddingClassName="px-6 pt-6 md:px-8"
        descriptionClassName="mt-3 text-sm leading-6 text-[#667391]"
      />

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-6 pb-6 pt-6 md:px-8">{children}</div>
      </div>
    </section>
  );
}
