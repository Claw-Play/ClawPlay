import Link from "next/link";
import { getT } from "@/lib/i18n";

export default async function NotFound() {
  const t = await getT("not_found");

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fefae0] via-[#faf3d0] to-[#f5ecb8] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <ShrimpLogoIcon className="w-20 h-20 text-[#a23f00] mx-auto" />
        <h1 className="text-4xl font-bold font-heading text-[#564337]">{t("code")}</h1>
        <h2 className="text-xl font-semibold font-heading text-[#564337]">{t("title")}</h2>
        <p className="text-[#7a6a5a] font-body">
          {t("desc")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white font-semibold rounded-[40px] shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
          >
            {t("go_home")}
          </Link>
          <Link
            href="/skills"
            className="px-6 py-3 bg-[#fffdf7] hover:bg-[#faf3d0] text-[#564337] font-semibold rounded-[40px] border-2 border-[#e8dfc8] transition-colors font-heading"
          >
            {t("browse_skills")}
          </Link>
        </div>
      </div>
    </div>
  );
}
import { ShrimpLogoIcon } from "@/components/icons";
