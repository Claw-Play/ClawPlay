"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useRouter } from "next/navigation";

interface VersionActionButtonsProps {
  slug: string;
  version: string;
  isAuthor: boolean;
  isAdmin: boolean;
  isDeprecated: boolean;
}

export function VersionActionButtons({
  slug,
  version,
  isAuthor,
  isAdmin,
  isDeprecated,
}: VersionActionButtonsProps) {
  const t = useT("skill_versions");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"deprecate" | "undeprecate" | null>(null);

  const canDeprecate = isAuthor || isAdmin;
  const canSetLatest = isAdmin;

  async function doAction(act: "deprecate" | "undeprecate") {
    const confirmed = window.confirm(
      act === "deprecate"
        ? t("deprecate_confirm")
        : t("undeprecate_confirm")
    );
    if (!confirmed) return;
    setLoading(true);
    setAction(act);
    try {
      const res = await fetch(`/api/skills/${slug}/versions/${version}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
      setAction(null);
    }
  }

  if (!canDeprecate && !canSetLatest) return null;

  return (
    <div className="flex items-center gap-2">
      {canDeprecate && (
        <button
          onClick={() => doAction(isDeprecated ? "undeprecate" : "deprecate")}
          disabled={loading}
          className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors font-body disabled:opacity-50 ${
            isDeprecated
              ? "border-[#586330] text-[#586330] hover:bg-[#586330]/10"
              : "border-red-300 text-red-500 hover:bg-red-50"
          }`}
        >
          {loading && action === (isDeprecated ? "undeprecate" : "deprecate")
            ? "..."
            : isDeprecated
            ? t("restore")
            : t("deprecate")}
        </button>
      )}
    </div>
  );
}
