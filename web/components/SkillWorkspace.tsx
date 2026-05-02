"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import matter from "gray-matter";
import SkillDiagramPreview from "@/components/SkillDiagramPreview";
import { PencilIcon, EyeIcon } from "@/components/icons";
import CollapsibleCardHeader, {
  COLLAPSIBLE_CARD_OUTER_PADDING_CLASS,
} from "@/components/CollapsibleCardHeader";

export interface ParsedFrontmatter {
  name?: string;
  description?: string;
  emoji?: string;
  bins?: string[];
}

export function parseSkillFrontmatter(raw: string): { meta: ParsedFrontmatter; content: string } {
  try {
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const clawdbot = metadata?.clawdbot as Record<string, unknown> | undefined;
    const openclaw = metadata?.openclaw as Record<string, unknown> | undefined;
    const botMeta = clawdbot ?? openclaw;
    const requires = botMeta?.requires as Record<string, unknown> | undefined;
    return {
      meta: {
        name: data.name as string | undefined,
        description: data.description as string | undefined,
        emoji: botMeta?.emoji as string | undefined,
        bins: requires?.bins as string[] | undefined,
      },
      content: parsed.content.trimStart(),
    };
  } catch {
    return { meta: {}, content: raw };
  }
}

function FrontmatterCard({ meta }: { meta: ParsedFrontmatter }) {
  if (!meta.name && !meta.description && !meta.emoji && !(meta.bins?.length ?? 0 > 0)) return null;
  return (
    <div className="mb-4 flex flex-wrap items-start gap-3 rounded-[6px] border border-[#dbe5f7] bg-[#f7faff] p-4 shadow-[0_8px_20px_rgba(25,43,87,0.04)]">
      {meta.emoji && (
        <span className="flex h-12 w-12 items-center justify-center rounded-[6px] border border-[#d9e4f7] bg-white text-2xl shadow-sm">
          {meta.emoji}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {meta.name && (
          <p className="font-heading text-base font-extrabold text-[#0f172a]">{meta.name}</p>
        )}
        {meta.description && (
          <p className="mt-0.5 text-sm leading-6 text-[#5b6472]">{meta.description}</p>
        )}
        {meta.bins && meta.bins.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.bins.map((bin) => (
              <code key={bin} className="rounded-[4px] border border-[#d8dde6] bg-white px-2 py-0.5 text-xs text-[#334155]">
                {bin}
              </code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const markdownPreviewClassName =
  "markdown-preview text-base leading-[1.75] text-[#0f172a] " +
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:font-heading [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-[-0.02em] [&_h1]:text-[#1641c6] " +
  "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-[#e2eaf8] [&_h2]:pb-3 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_h2]:text-[#1641c6] " +
  "[&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#1641c6] " +
  "[&_h4]:mt-4 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-[#102040] " +
  "[&_p]:mt-3 [&_p]:leading-[1.75] [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:leading-[1.75] " +
  "[&_code]:rounded-[4px] [&_code]:bg-[#eef4ff] [&_code]:px-[4px] [&_code]:py-px [&_code]:font-mono [&_code]:text-sm [&_code]:text-[#1d2a4f] " +
  "[&_pre]:mt-3 [&_pre]:overflow-auto [&_pre]:rounded-[6px] [&_pre]:border [&_pre]:border-[#d9e4f7] [&_pre]:bg-[#f7faff] [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-[#1d2a4f] " +
  "[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[#1d2a4f] " +
  "[&_a]:text-[#1d4ed8] [&_a]:underline [&_strong]:font-semibold [&_strong]:text-[#0f172a] [&_em]:italic " +
  "[&_blockquote]:border-l-4 [&_blockquote]:border-[#bfd0f4] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#667391] " +
  "[&_hr]:my-5 [&_hr]:border-none [&_hr]:border-t [&_hr]:border-[#e2e8f0] " +
  "[&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-[#d9e4f7] [&_th]:bg-[#f7faff] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[#102040] " +
  "[&_td]:border [&_td]:border-[#d9e4f7] [&_td]:px-3 [&_td]:py-2 [&_td]:text-[#102040] [&_tr]:border-b [&_tr]:border-[#d9e4f7] [&_tr:nth-child(even)]:bg-[#fbfdff]";

interface SkillMdPreviewProps {
  value: string;
  className?: string;
  maxHeight?: number;
}

export function SkillMdPreview({ value, className = "", maxHeight = 600 }: SkillMdPreviewProps) {
  const parsed = parseSkillFrontmatter(value);
  return (
    <div className={`overflow-y-auto px-6 py-6 ${className}`} style={{ maxHeight }}>
      <FrontmatterCard meta={parsed.meta} />
      <div className={markdownPreviewClassName}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.content}</ReactMarkdown>
      </div>
    </div>
  );
}

interface WorkspaceShellProps {
  title: string;
  description?: string;
  descriptionClassName?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  outerPaddingClassName?: string;
  contentProps?: React.HTMLAttributes<HTMLDivElement>;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function WorkspaceShell({
  title,
  description,
  descriptionClassName = "",
  actions,
  children,
  footer,
  className = "",
  outerPaddingClassName = COLLAPSIBLE_CARD_OUTER_PADDING_CLASS,
  contentProps,
  collapsible = false,
  defaultCollapsed = false,
}: WorkspaceShellProps) {
  const { className: contentClassName = "", ...restContentProps } = contentProps ?? {};
  const [open, setOpen] = useState(!defaultCollapsed);
  const toggleOpen = collapsible ? () => setOpen((v) => !v) : undefined;
  return (
    <section className={`rounded-[6px] border border-[#dbe5f7] bg-white shadow-[0_8px_20px_rgba(25,43,87,0.06)] ${className}`}>
      {collapsible ? (
        <CollapsibleCardHeader
          title={title}
          description={description}
          open={open}
          onToggle={toggleOpen ?? (() => {})}
          actions={actions && <div className="flex flex-nowrap items-center gap-2">{actions}</div>}
          descriptionClassName={`mt-3 text-sm leading-6 text-[#667391] ${descriptionClassName}`}
        />
      ) : (
        <div className={outerPaddingClassName}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="font-heading text-[22px] font-bold tracking-[-0.02em] text-[#102040]">{title}</h2>
              {description && (
                <p className={`mt-3 text-sm leading-6 text-[#667391] ${descriptionClassName}`}>{description}</p>
              )}
            </div>
            {actions && <div className="flex shrink-0 flex-nowrap items-center gap-2">{actions}</div>}
          </div>
        </div>
      )}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          {...restContentProps}
          className={`relative mx-6 mb-6 mt-6 overflow-hidden rounded-[6px] border border-[#e2eaf8] bg-[#fbfdff] ${contentClassName}`}
        >
          {children}
        </div>
        {footer}
      </div>
    </section>
  );
}

interface SkillMdWorkspaceProps {
  title: string;
  description?: string;
  descriptionClassName?: string;
  value: string;
  mode: "edit" | "preview";
  onChange?: (value: string) => void;
  placeholder?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentProps?: React.HTMLAttributes<HTMLDivElement>;
  emptyState?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function SkillMdWorkspace({
  title,
  description,
  descriptionClassName,
  value,
  mode,
  onChange,
  placeholder,
  actions,
  footer,
  className,
  contentProps,
  emptyState,
  collapsible,
  defaultCollapsed,
}: SkillMdWorkspaceProps) {
  return (
    <WorkspaceShell
      title={title}
      description={description}
      descriptionClassName={descriptionClassName}
      actions={actions}
      footer={footer}
      className={className}
      contentProps={contentProps}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
    >
      {emptyState}
      {mode === "preview" && value.trim() ? (
        <SkillMdPreview value={value} />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="min-h-[360px] w-full resize-y border-0 bg-[#fbfdff] px-6 py-6 font-mono text-sm leading-6 text-[#102040] placeholder-[#94a3b8] focus:outline-none"
          spellCheck={false}
        />
      )}
    </WorkspaceShell>
  );
}

interface WorkflowDiagramWorkspaceProps {
  title: string;
  description?: string;
  descriptionClassName?: string;
  mermaid: string;
  mode: "edit" | "preview";
  onChange?: (value: string) => void;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  sourceTitle?: string;
  sourceHint?: string;
  emptyState?: React.ReactNode;
  hideContent?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function WorkflowDiagramWorkspace({
  title,
  description,
  descriptionClassName,
  mermaid,
  mode,
  onChange,
  actions,
  footer,
  className,
  sourceTitle,
  sourceHint,
  emptyState,
  hideContent = false,
  collapsible,
  defaultCollapsed,
}: WorkflowDiagramWorkspaceProps) {
  return (
    <WorkspaceShell
      title={title}
      description={description}
      descriptionClassName={descriptionClassName}
      actions={actions}
      footer={footer}
      className={className}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
    >
      {hideContent ? (
        emptyState ?? null
      ) : (
        <>
          {emptyState}
          {mode === "preview" ? (
            <div className="min-h-[360px] bg-white p-4 md:p-6">
              <SkillDiagramPreview initialMermaid={mermaid} framed={false} />
            </div>
          ) : (
              <div className="bg-white">
                {(sourceTitle || sourceHint) && (
                <div className="border-b border-[#d8dde6] px-5 py-4">
                  {sourceTitle && <h3 className="font-heading text-xl font-bold text-[#111827]">{sourceTitle}</h3>}
                  {sourceHint && <p className="mt-2 text-sm leading-6 text-[#64748b]">{sourceHint}</p>}
                </div>
              )}
              <textarea
                className="min-h-[360px] w-full resize-y border-0 bg-[#fbfdff] px-6 py-6 font-mono text-sm leading-6 text-[#102040] placeholder-[#94a3b8] focus:outline-none"
                value={mermaid}
                onChange={(e) => onChange?.(e.target.value)}
                rows={Math.max(10, mermaid.split("\n").length + 2)}
                spellCheck={false}
              />
            </div>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}

interface ModeToggleButtonProps {
  mode: "edit" | "preview";
  onClick: () => void;
  editLabel?: string;
  previewLabel?: string;
  className?: string;
}

export function ModeToggleButton({
  mode,
  onClick,
  editLabel = "编辑",
  previewLabel = "预览",
  className = "",
}: ModeToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 ${
        mode === "preview"
          ? "border-[#2f6fdd] bg-[#2f6fdd] text-white"
          : "border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fbff]"
      } ${className}`}
    >
      {mode === "preview" ? (
        <>
          <PencilIcon className="h-3.5 w-3.5" />
          {editLabel}
        </>
      ) : (
        <>
          <EyeIcon className="h-3.5 w-3.5" />
          {previewLabel}
        </>
      )}
    </button>
  );
}
