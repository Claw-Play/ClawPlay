"use client";
import { useT } from "@/lib/i18n/context";
import ProvidersClient from "./ProvidersClient";

export default function AdminProvidersPage() {
  const t = useT("admin_settings");

  return (
    <div className="text-[#564337] font-body px-4 sm:px-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold font-heading break-words">{t("title")}</h2>
      </div>
      <ProvidersClient />
    </div>
  );
}
