"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

interface QuickInstallCardProps {
  slug: string;
  repoUrl: string | null;
  auth: boolean;
}

export function QuickInstallCard({ slug, repoUrl, auth }: QuickInstallCardProps) {
  const t = useT("components");
  return (
    <div className="space-y-5">
      {/* Quick Install — dark card */}
      <div
        className="rounded-[24px] p-5 border border-[#464330]"
        style={{ background: "#323120" }}
      >
        <h3 className="font-semibold font-heading mb-1" style={{ color: "#fefae0" }}>
          {t("quick_install")}
        </h3>
        <p className="text-xs mb-4 font-body" style={{ color: "#a89888" }}>
          {t("run_in_terminal")}
        </p>
        <div
          className="rounded-[16px] p-4 text-sm font-mono-custom leading-relaxed"
          style={{ background: "#1d1c0d", color: "#fa7025" }}
        >
          clawplay install {slug}
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(`clawplay install ${slug}`)}
          className="mt-3 w-full py-2.5 rounded-[16px] text-sm font-semibold font-heading transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #a23f00 0%, #fa7025 100%)", color: "#fff" }}
        >
          {t("copy_command")}
        </button>
        {repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center text-sm font-body hover:underline transition-all"
            style={{ color: "#fa7025" }}
          >
            {t("view_source")}
          </a>
        )}
      </div>

      {/* Quick setup */}
      <div className="bg-[#fffdf7] card-radius p-5 border border-[#e8dfc8] card-shadow">
        <h3 className="font-semibold font-heading text-[#564337] mb-3">{t("quick_setup")}</h3>
        <p className="text-sm text-[#7a6a5a] mb-3 font-body">
          {t("use_clawplay")}
        </p>
        <div className="bg-[#faf3d0] rounded-[16px] p-3 text-xs font-mono-custom text-[#564337] space-y-1">
          <div>export CLAWPLAY_TOKEN=...</div>
          <div>clawplay image generate ...</div>
        </div>
        {!auth && (
          <Link
            href="/register"
            className="mt-3 block w-full text-center px-4 py-3 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold rounded-[40px] shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
          >
            {t("get_free_token")}
          </Link>
        )}
      </div>
    </div>
  );
}
