"use client";
import { useT } from "@/lib/i18n/context";

export default function AdminSettingsPage() {
  const t = useT("admin_settings");

  return (
    <div className="text-[#564337] font-body">
      <h2 className="text-xl font-bold mb-4">{t("admin_settings")}</h2>
      <p>{t("coming_soon")}</p>
    </div>
  );
}
