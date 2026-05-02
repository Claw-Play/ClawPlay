"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

interface QuickInstallCardProps {
  slug: string;
  repoUrl: string | null;
  auth: boolean;
  className?: string;
}

export function QuickInstallCard({ slug, repoUrl, auth, className = "" }: QuickInstallCardProps) {
  const t = useT("components");
  return (
    <div className={`space-y-5 ${className}`}>
      {/* Quick Install */}
      <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-5 shadow-[0_8px_20px_rgba(25,43,87,0.06)]">
        <h3 className="mb-1 font-heading text-[18px] font-bold tracking-[-0.02em] text-[#15213b]">
          {t("quick_install")}
        </h3>
        <p className="mb-4 text-xs font-body text-[#7c879f]">
          {t("run_in_terminal")}
        </p>
        <code className="block rounded-[6px] border border-[#dfe8f8] bg-[#f7faff] p-4 text-sm font-semibold leading-6 text-[#394766]">
          clawplay install {slug}
        </code>
        <button
          onClick={() => navigator.clipboard.writeText(`clawplay install ${slug}`)}
          className="mt-3 w-full rounded-[6px] bg-[#2d67f7] py-2.5 text-sm font-semibold font-heading text-white transition-colors hover:bg-[#2457d4]"
        >
          {t("copy_command")}
        </button>
        {repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center text-sm font-body text-[#2d67f7] transition-colors hover:text-[#2457d4] hover:underline"
          >
            {t("view_source")}
          </a>
        )}
      </div>

      {/* Quick setup */}
      <div className="rounded-[6px] border border-[#dbe5f7] bg-white p-5 shadow-[0_8px_20px_rgba(25,43,87,0.06)]">
        <h3 className="mb-3 font-heading text-[18px] font-bold tracking-[-0.02em] text-[#15213b]">{t("quick_setup")}</h3>
        <p className="mb-3 text-sm text-[#7c879f] font-body">
          {t("use_clawplay")}
        </p>
        <code className="block space-y-1 rounded-[6px] border border-[#dfe8f8] bg-[#f7faff] p-4 text-sm font-semibold leading-6 text-[#394766]">
          <div>export CLAWPLAY_TOKEN=...</div>
          <div>clawplay image generate ...</div>
        </code>
        {!auth && (
          <Link
            href="/login"
            className="mt-3 block w-full rounded-[6px] bg-[#2d67f7] px-4 py-3 text-center text-sm font-semibold font-heading text-white transition-colors hover:bg-[#2457d4]"
          >
            {t("get_free_token")}
          </Link>
        )}
      </div>
    </div>
  );
}
