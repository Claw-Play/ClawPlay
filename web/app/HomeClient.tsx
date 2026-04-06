"use client";
import { useState, useRef } from "react";
import { useTranslations } from "next-intl";

export function HomeClient() {
  const t = useTranslations("home_cli");
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
    <section className="py-8 px-6 bg-[#fffdf7] border-y border-[#e8dfc8]">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <h2 className="text-lg font-semibold font-heading text-[#564337]">
          {t("title")}
        </h2>
        <p className="text-sm text-[#7a6a5a] font-body">
          {t("desc")}
        </p>
        <div className="flex items-center justify-center gap-3">
          <code className="bg-[#faf3d0] border border-[#e8dfc8] rounded-[16px] px-4 py-2 text-sm font-mono-custom text-[#564337]">
            npm install -g clawplay && clawplay setup
          </code>
          <button
            onClick={copySetup}
            className="px-4 py-2 bg-[#faf3d0] hover:bg-[#e8dfc0] text-[#564337] text-sm font-semibold rounded-full transition-colors font-body"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>
    </section>
  );
}
