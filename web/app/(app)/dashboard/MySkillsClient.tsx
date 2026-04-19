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
  approved: "bg-[#586330]/10 text-[#586330]",
  pending: "bg-[#a23f00]/10 text-[#a23f00]",
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
          <div key={i} className="bg-[#fffdf7] rounded-[24px] p-5 sm:p-6 border border-[#e8dfc8] animate-pulse">
            <div className="h-5 bg-[#e8dfc8] rounded w-1/3 mb-3" />
            <div className="h-4 bg-[#e8dfc8] rounded w-2/3 mb-4" />
            <div className="h-4 bg-[#e8dfc8] rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-[24px] px-5 py-4 text-sm font-body">
        {error}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="bg-[#fffdf7] rounded-[24px] p-8 sm:p-10 border border-[#e8dfc8] text-center space-y-3">
        <div className="text-4xl">🌱</div>
        <p className="text-[#7a6a5a] font-body">{t("empty")}</p>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white text-sm font-semibold font-heading hover:opacity-90 transition-opacity"
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
          className="bg-[#fffdf7] rounded-[24px] p-5 sm:p-6 border border-[#e8dfc8] card-shadow"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <span className="text-3xl flex-shrink-0">{skill.iconEmoji}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-lg font-bold font-heading text-[#564337] truncate">
                    {skill.name}
                  </h3>
                  <StatusBadge status={skill.moderationStatus} />
                </div>
                {skill.summary && (
                  <p className="text-sm text-[#7a6a5a] font-body mb-2 line-clamp-1">
                    {skill.summary}
                  </p>
                )}
                {skill.latestVersion && (
                  <p className="text-xs text-[#a89070] font-body">
                    {t("version")} {skill.latestVersion.version}
                    {skill.latestVersion.moderationStatus === "pending" && (
                      <span className="ml-2 text-[#a23f00]">
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
                className="inline-flex min-h-11 items-center px-3 py-1.5 text-xs font-semibold text-[#564337] bg-[#f0e8d0] rounded-full font-body hover:bg-[#e8dfc8] transition-colors"
              >
                {t("versions")}
              </Link>
              {skill.moderationStatus === "approved" && (
                <Link
                  href={`/skills/${skill.slug}/versions/new`}
                  className="inline-flex min-h-11 items-center px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#a23f00] to-[#fa7025] rounded-full font-heading hover:opacity-90 transition-opacity"
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
