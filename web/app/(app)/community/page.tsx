import { getT } from "@/lib/i18n";

export default function CommunityPage() {
  const t = getT("community");

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-6">
      <div className="text-center max-w-md space-y-6">
        {/* Emoji */}
        <div className="text-6xl">🌱</div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold font-heading text-[#564337] leading-tight">
          {t("coming_soon_title")}
        </h1>

        {/* Description */}
        <p className="text-lg text-[#7a6a5a] font-body leading-relaxed">
          {t("coming_soon_desc")}
        </p>
      </div>
    </div>
  );
}
