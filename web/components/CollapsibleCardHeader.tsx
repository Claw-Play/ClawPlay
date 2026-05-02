"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

export const COLLAPSIBLE_CARD_OUTER_PADDING_CLASS = "px-5 pt-5 lg:px-6";
export const COLLAPSIBLE_CARD_COLLAPSED_BOTTOM_PADDING_CLASS = "pb-5";
export const COLLAPSIBLE_TOGGLE_BUTTON_CLASS = "flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8dde6] bg-white text-[#64748b] shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition hover:border-[#c8d5ef] hover:bg-[#f8fbff] hover:text-[#2f6fdd]";
export const COLLAPSIBLE_TOGGLE_ICON_CLASS = "h-4 w-4 transition-transform duration-200";

interface Props {
  title: ReactNode;
  description?: ReactNode;
  open: boolean;
  onToggle: () => void;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  outerPaddingClassName?: string;
  titleSize?: "sm" | "md" | "lg";
  titleClassName?: string;
  descriptionClassName?: string;
  iconWrapperClassName?: string;
  toggleLabel?: string;
  showToggle?: boolean;
}

const TITLE_SIZE_CLASS: Record<NonNullable<Props["titleSize"]>, string> = {
  sm: "font-heading text-xl font-bold text-[#111827]",
  md: "font-heading text-[22px] font-bold tracking-[-0.02em] text-[#102040]",
  lg: "font-heading text-2xl font-black tracking-tight text-[#111827]",
};

export default function CollapsibleCardHeader({
  title,
  description,
  open,
  onToggle,
  icon,
  actions,
  className = "",
  outerPaddingClassName = COLLAPSIBLE_CARD_OUTER_PADDING_CLASS,
  titleSize = "md",
  titleClassName,
  descriptionClassName = "mt-3 text-sm leading-6 text-[#64748b]",
  iconWrapperClassName = "",
  toggleLabel,
  showToggle = true,
}: Props) {
  const hasActions = Boolean(actions) || showToggle;
  return (
    <div
      className={`flex w-full items-start justify-between gap-3 text-left ${
        open ? "" : COLLAPSIBLE_CARD_COLLAPSED_BOTTOM_PADDING_CLASS
      } ${outerPaddingClassName} ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <span className={iconWrapperClassName}>{icon}</span>}
          <h2 className={titleClassName ?? TITLE_SIZE_CLASS[titleSize]}>{title}</h2>
        </div>
        {description && (
          <div
            className={`overflow-hidden transition-all duration-200 ease-out ${
              open ? "mt-3 max-h-20 translate-y-0 opacity-100" : "mt-0 max-h-0 -translate-y-1 opacity-0"
            }`}
          >
            <p className={descriptionClassName}>{description}</p>
          </div>
        )}
      </div>
      {hasActions ? (
        <div className="flex shrink-0 translate-x-2 items-center gap-3 pr-1">
          {actions}
          {showToggle ? (
            <button
              type="button"
              onClick={onToggle}
              className={COLLAPSIBLE_TOGGLE_BUTTON_CLASS}
              aria-label={toggleLabel ?? (open ? "Collapse section" : "Expand section")}
            >
              <ChevronDownIcon className={`${COLLAPSIBLE_TOGGLE_ICON_CLASS} text-[#64748b] ${open ? "" : "-rotate-90"}`} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
