"use client";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { ChatInstallIcon, CopyIcon, TerminalIcon } from "@/components/icons";

export function HomeClient() {
  const t = useT("home_cli");
  const [mode, setMode] = useState<"chat" | "cli">("chat");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const installText = mode === "chat" ? t("chat_install_text") : t("cli_install_text");

  function copyInstallText() {
    const el = document.createElement("input");
    el.value = installText;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    setMode((m) => m); // nudge to re-render indicator (copied feedback omitted for brevity)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {}, 2000);
  }

  return (
    <section className="py-8 px-6" style={{ background: "#fefae0" }}>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setMode("chat")}
            aria-label={t("chat_mode")}
            aria-pressed={mode === "chat"}
            className={[
              "flex min-h-14 w-full max-w-[240px] items-center justify-center gap-3 rounded-full px-6 py-3 text-base font-semibold transition-all duration-200 font-heading sm:w-auto sm:min-w-[180px]",
              mode === "chat"
                ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0_6px_24px_rgba(162,63,0,0.2)]"
                : "bg-white/85 text-[#7a6a5a] border border-[#e8dfc8] hover:bg-white",
            ].join(" ")}
          >
            <ChatInstallIcon className="h-[22px] w-[22px] shrink-0 translate-y-[1px]" />
            <span>{t("chat_mode")}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("cli")}
            aria-label={t("cli_mode")}
            aria-pressed={mode === "cli"}
            className={[
              "flex min-h-14 w-full max-w-[240px] items-center justify-center gap-3 rounded-full px-6 py-3 text-base font-semibold transition-all duration-200 font-heading sm:w-auto sm:min-w-[180px]",
              mode === "cli"
                ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0_6px_24px_rgba(162,63,0,0.2)]"
                : "bg-white/85 text-[#7a6a5a] border border-[#e8dfc8] hover:bg-white",
            ].join(" ")}
          >
            <TerminalIcon className="h-5 w-5 shrink-0" />
            <span>{t("cli_mode")}</span>
          </button>
        </div>

        <div className="mx-auto flex w-fit max-w-full items-center rounded-[24px] bg-[#fffdf7] px-3 py-3 shadow-[0_8px_24px_rgba(86,67,55,0.05)] border border-[#e8dfc8] sm:min-w-[31rem]">
          <code
            className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[14px] bg-transparent pl-1 pr-0 py-0 text-sm sm:text-base leading-6 text-[#564337] tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {installText}
          </code>
          <button
            onClick={copyInstallText}
            aria-label="Copy installation command"
            className="inline-flex min-h-5 w-10 shrink-0 items-center justify-center rounded-md text-[#a23f00] transition-colors hover:text-[#fa7025] font-body"
          >
            <CopyIcon className="h-5 w-5" />
            <span className="sr-only">Copy installation command</span>
          </button>
        </div>
      </div>
    </section>
  );
}
