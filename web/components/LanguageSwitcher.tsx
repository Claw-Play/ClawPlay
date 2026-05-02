"use client";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import { useT } from "@/lib/i18n/context";

interface LanguageSwitcherProps {
  variant?: "default" | "dark" | "home";
}

export default function LanguageSwitcher({ variant = "default" }: LanguageSwitcherProps) {
  const { locale } = useLocale();
  const t = useT("common");
  const [hovered, setHovered] = useState(false);

  const isZh = locale === "zh";
  const targetLocale = isZh ? "en" : "zh";
  const label =
    targetLocale === "en"
      ? (t("switch_to_en") || "English / 切换到 English")
      : (t("switch_to_zh") || "中文 / 切换到中文");

  function handleSwitch() {
    // Write cookie and reload
    document.cookie = `clawplay_locale=${targetLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  }

  const isDark = variant === "dark";
  const isHome = variant === "home";

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleSwitch}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={
          isDark
            ? "w-9 h-9 rounded-xl bg-transparent hover:bg-white/10 border border-white/40 hover:border-white flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
            : isHome
            ? "w-9 h-9 rounded-xl bg-white border border-[#d8e2f7] hover:border-[#2d67f7] hover:bg-[#f7faff] flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2d67f7]/30 shadow-[0_6px_16px_rgba(25,43,87,0.04)]"
            : "w-9 h-9 rounded-xl bg-white/80 backdrop-blur-sm border border-[#dbe5f7] hover:border-[#2d67f7] hover:bg-white flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2d67f7]"
        }
        title={label}
        aria-label={label}
      >
        {/* Globe SVG icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDark ? "#ffffff" : isHome ? "#2d67f7" : "#2d67f7"}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </button>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className={
            isDark
              ? "absolute right-0 top-full mt-2 whitespace-nowrap rounded-xl bg-white px-4 py-2 shadow-lg z-50"
              : isHome
              ? "absolute right-0 top-full mt-2 whitespace-nowrap rounded-xl bg-[#2d67f7] px-4 py-2 shadow-lg z-50"
              : "absolute right-0 top-full mt-2 whitespace-nowrap rounded-xl bg-[#2d67f7] px-4 py-2 shadow-lg z-50"
          }
        >
          <span
            className={`text-sm font-medium font-body leading-none ${
              isDark ? "text-[#1a1a2e]" : "text-white"
            }`}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
