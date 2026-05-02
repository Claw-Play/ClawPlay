"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { ChatInstallIcon, CopyIcon, TerminalIcon } from "@/components/icons";

export function HomeClient() {
  const t = useT("home_cli");
  const [mode, setMode] = useState<"chat" | "cli">("chat");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const installText = mode === "chat" ? t("chat_install_text") : t("cli_install_text");

  async function copyInstallText() {
    try {
      await navigator.clipboard.writeText(installText);
    } catch {
      const el = document.createElement("input");
      el.value = installText;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }

    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="mx-auto max-w-[600px]">
      <div className="mx-auto flex w-full flex-col items-stretch justify-center gap-3 sm:max-w-[420px] sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setMode("chat")}
          aria-label={t("chat_mode")}
          aria-pressed={mode === "chat"}
          className={[
            "flex min-h-12 flex-1 items-center justify-center gap-3 rounded-xl border px-3 py-3 text-[14px] font-semibold transition-all duration-200",
            mode === "chat"
              ? "border-[#2d67f7] bg-[#2d67f7] text-white shadow-[0_12px_24px_rgba(45,103,247,0.24)]"
              : "border-[#c8d7f7] bg-white text-[#2d67f7] hover:bg-[#f7faff]",
          ].join(" ")}
        >
          <ChatInstallIcon className="h-[20px] w-[20px] shrink-0" />
          <span>{t("chat_mode")}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("cli")}
          aria-label={t("cli_mode")}
          aria-pressed={mode === "cli"}
          className={[
            "flex min-h-12 flex-1 items-center justify-center gap-3 rounded-xl border px-3 py-3 text-[14px] font-semibold transition-all duration-200",
            mode === "cli"
              ? "border-[#2d67f7] bg-[#2d67f7] text-white shadow-[0_12px_24px_rgba(45,103,247,0.24)]"
              : "border-[#c8d7f7] bg-white text-[#2d67f7] hover:bg-[#f7faff]",
          ].join(" ")}
        >
          <TerminalIcon className="h-[18px] w-[18px] shrink-0" />
          <span>{t("cli_mode")}</span>
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-[18px] border border-[#dbe5f7] bg-white/90 px-4 py-3 shadow-[0_12px_30px_rgba(25,43,87,0.05)] backdrop-blur-sm">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-left text-[14px] font-semibold leading-6 text-[#394766]">
          {installText}
        </code>
        <button
          onClick={copyInstallText}
          aria-label={copied ? t("skill_copied") : "Copy installation command"}
          className="shrink-0 rounded-md p-1.5 text-[#2d67f7] transition-colors hover:bg-[#dbe5ff]"
        >
          {copied ? (
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <CopyIcon className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </section>
  );
}
