import { getT } from "@/lib/i18n";

export default async function CommunityPage() {
  const t = await getT("community");

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-6">
      <div className="text-center max-w-md space-y-6">
        {/* Emoji */}
        <div className="text-6xl">🌱</div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold font-heading text-[#1f2b45] leading-tight">
          {t("coming_soon_title")}
        </h1>

        {/* Description */}
        <p className="text-lg text-[#52617d] font-body leading-relaxed">
          {t("coming_soon_desc")}
        </p>
      </div>
    </div>
  );
}
