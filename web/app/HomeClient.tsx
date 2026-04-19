"use client";
import { useState, useRef } from "react";
import { useT } from "@/lib/i18n/context";

export function HomeClient() {
  const t = useT("home_cli");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function copySetup() {
    const el = document.createElement("input");
    el.value = "npm install -g clawplay && clawplay setup";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="py-8 px-6" style={{ background: "#fefae0" }}>
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <h2 className="text-lg font-semibold font-heading text-[#564337]">
          {t("title")}
        </h2>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
          <code className="bg-[#fffdf7] border border-[#e8dfc8] rounded-[16px] px-4 py-2 text-sm font-mono-custom text-[#564337]">
            npm install -g clawplay && clawplay setup
          </code>
          <button
            onClick={copySetup}
            className="px-4 py-2 min-h-11 min-w-[80px] bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold rounded-full transition-all shadow-[0_4px_12px_rgba(162,63,0,0.2)] font-body"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>
    </section>
  );
}
