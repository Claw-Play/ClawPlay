"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

interface SkillVersion {
  id: string;
  skillId: string;
  version: string;
  changelog: string;
  moderationStatus: string;
  deprecatedAt: string | null;
  createdAt: string;
}

interface SkillSummary {
  id: string;
  slug: string;
  name: string;
  summary: string;
  iconEmoji: string;
  moderationStatus: string;
  latestVersionId: string | null;
  createdAt: string;
  latestVersion: SkillVersion | null;
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-[#e9f8ef] text-[#379465]",
  pending: "bg-[#edf4ff] text-[#2d67f7]",
  rejected: "bg-red-100 text-red-600",
};

function StatusBadge({ status }: { status: string }) {
  const t = useT("common");
  const labels: Record<string, string> = {
    approved: t("approved"),
    pending: t("pending"),
    rejected: "Rejected",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold font-body ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function MySkillsClient() {
  const t = useT("my_skills");
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/user/skills")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setSkills(d.skills ?? []);
      })
      .catch((e) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-[24px] border border-[#dbe5f7] bg-white p-5 shadow-[0_12px_28px_rgba(25,43,87,0.04)] animate-pulse">
            <div className="mb-3 h-5 w-1/3 rounded bg-[#e9eef8]" />
            <div className="mb-4 h-4 w-2/3 rounded bg-[#e9eef8]" />
            <div className="h-4 w-1/4 rounded bg-[#e9eef8]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="space-y-3 rounded-[14px] border border-[#dfe5ef] bg-white p-8 text-center shadow-[0_8px_18px_rgba(20,31,54,0.03)] sm:p-10">
        <div className="text-4xl">🌱</div>
        <p className="text-[#7c879f]">{t("empty")}</p>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 rounded-[7px] bg-[#2d67f7] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_18px_rgba(45,103,247,0.18)] transition-colors hover:bg-[#2457d4]"
        >
          {t("submit_first")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {skills.map((skill) => (
        <div
          key={skill.id}
          className="rounded-[14px] border border-[#dfe5ef] bg-white px-6 py-5 shadow-[0_8px_18px_rgba(20,31,54,0.03)]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <span className="text-[30px] flex-shrink-0 leading-none">{skill.iconEmoji}</span>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[18px] font-semibold text-[#15213b]">
                    {skill.name}
                  </h3>
                  <StatusBadge status={skill.moderationStatus} />
                </div>
                {skill.summary && (
                  <p className="mb-2 line-clamp-1 text-[14px] text-[#7c879f]">
                    {skill.summary}
                  </p>
                )}
                {skill.latestVersion && (
                  <p className="text-[12px] text-[#8aa0cb]">
                    {t("version")} {skill.latestVersion.version}
                    {skill.latestVersion.moderationStatus === "pending" && (
                      <span className="ml-2 text-[#c45f1d]">
                        — {t("pending_review")}
                      </span>
                    )}
                    {skill.latestVersion.deprecatedAt && (
                      <span className="ml-2 text-red-500">— {t("deprecated")}</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <Link
                href={`/skills/${skill.slug}/versions`}
                className="inline-flex min-h-11 items-center rounded-[7px] border border-[#dbe3ef] bg-white px-4 py-1.5 text-[13px] font-medium text-[#5f6c86] transition-colors hover:bg-[#f7faff]"
              >
                {t("versions")}
              </Link>
              {skill.moderationStatus === "approved" && (
                <Link
                  href={`/skills/${skill.slug}/versions/new`}
                  className="inline-flex min-h-11 items-center rounded-[7px] bg-[#1f62e8] px-4 py-1.5 text-[13px] font-medium text-white shadow-[0_10px_18px_rgba(45,103,247,0.18)] transition-colors hover:bg-[#2457d4]"
                >
                  {t("new_version")}
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
