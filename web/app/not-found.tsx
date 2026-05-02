import Link from "next/link";
import { getT } from "@/lib/i18n";

export default async function NotFound() {
  const t = await getT("not_found");

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8faff] via-[#f0f6ff] to-[#e8f0ff] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <ShrimpLogoIcon className="w-28 h-28 text-[#2d67f7] mx-auto" />
        <h1 className="text-4xl font-bold font-heading text-[#1f2b45]">{t("code")}</h1>
        <h2 className="text-xl font-semibold font-heading text-[#1f2b45]">{t("title")}</h2>
        <p className="text-[#52617d] font-body">
          {t("desc")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-gradient-to-r from-[#2d67f7] to-[#4f82f7] hover:opacity-90 text-white font-semibold rounded-[40px] shadow-[0_6px_24px_rgba(45,103,247,0.2)] transition-all font-heading"
          >
            {t("go_home")}
          </Link>
          <Link
            href="/skills"
            className="px-6 py-3 bg-[#ffffff] hover:bg-[#f0f6ff] text-[#1f2b45] font-semibold rounded-[40px] border-2 border-[#dbe5f7] transition-colors font-heading"
          >
            {t("browse_skills")}
          </Link>
        </div>
      </div>
    </div>
  );
}
import { ShrimpLogoIcon } from "@/components/icons";
