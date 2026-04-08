"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT("error");

  useEffect(() => {
    console.error("[ClawPlay] Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fefae0] via-[#faf3d0] to-[#f5ecb8] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-6xl">😔</div>
        <h1 className="text-3xl font-bold font-heading text-[#564337]">{t("title")}</h1>
        <p className="text-[#7a6a5a] font-body">
          {t("desc")}
        </p>
        {error.digest && (
          <p className="text-xs text-[#a89888] font-mono-custom">
            {t("error_id")}{error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white font-semibold rounded-[40px] shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
          >
            {t("try_again")}
          </button>
          <Link
            href="/"
            className="px-6 py-3 bg-[#fffdf7] hover:bg-[#faf3d0] text-[#564337] font-semibold rounded-[40px] border-2 border-[#e8dfc8] transition-colors font-heading"
          >
            {t("go_home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
