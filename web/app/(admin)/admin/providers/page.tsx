"use client";
import { useT } from "@/lib/i18n/context";
import ProvidersClient from "./ProvidersClient";

export default function AdminProvidersPage() {
  const t = useT("admin_settings");

  return (
    <div className="text-[#564337] font-body">
      <div className="mb-6">
        <h2 className="text-xl font-bold font-heading">{t("title")}</h2>
      </div>
      <ProvidersClient />
    </div>
  );
}
