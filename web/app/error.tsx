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
    <div className="min-h-screen bg-gradient-to-br from-[#f8faff] via-[#f0f6ff] to-[#e8f0ff] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-6xl">😔</div>
        <h1 className="text-3xl font-bold font-heading text-[#1f2b45]">{t("title")}</h1>
        <p className="text-[#52617d] font-body">
          {t("desc")}
        </p>
        {error.digest && (
          <p className="text-xs text-[#6d7891] font-mono-custom">
            {t("error_id")}{error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gradient-to-r from-[#2d67f7] to-[#4f82f7] hover:opacity-90 text-white font-semibold rounded-[40px] shadow-[0_6px_24px_rgba(45,103,247,0.2)] transition-all font-heading"
          >
            {t("try_again")}
          </button>
          <Link
            href="/"
            className="px-6 py-3 bg-[#ffffff] hover:bg-[#f0f6ff] text-[#1f2b45] font-semibold rounded-[40px] border-2 border-[#dbe5f7] transition-colors font-heading"
          >
            {t("go_home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
