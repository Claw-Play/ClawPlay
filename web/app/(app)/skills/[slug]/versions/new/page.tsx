"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";

interface SkillDetail {
  slug: string;
  name: string;
  iconEmoji: string;
  moderationStatus: string;
  summary: string;
  repoUrl: string;
}

interface LatestVersion {
  version: string;
  changelog: string;
  moderationStatus: string;
}

function suggestNextVersion(current: string, type: "patch" | "minor" | "major"): string {
  const parts = current.split(".").map(Number);
  if (parts.length < 3) return current;
  const [major, minor, patch] = parts;
  if (type === "patch") return `${major}.${minor}.${patch + 1}`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major + 1}.0.0`;
}

export default function SubmitNewVersionPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const t = useT("submit_version");
  const tSkillVersions = useT("skill_versions");

  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [latestVersion, setLatestVersion] = useState<LatestVersion | null>(null);

  const [form, setForm] = useState({
    version: "",
    changelog: "",
    skillMdContent: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check auth
    fetch("/api/user/me")
      .then((r) => {
        if (!r.ok) throw new Error("not authed");
      })
      .catch(() => router.push("/login"));

    // Load skill info
    Promise.all([
      fetch(`/api/skills/${slug}`).then((r) => r.json()),
      fetch(`/api/skills/${slug}/versions`).then((r) => r.json()),
    ]).then(([skillData, versionsData]) => {
      if (skillData.error) {
        setError(skillData.error);
        return;
      }
      setSkill(skillData.skill);
      if (versionsData.versions?.length > 0) {
        const latest = versionsData.versions[0];
        setLatestVersion(latest);
        // Pre-fill changelog with version
        setForm((prev) => ({
          ...prev,
          version: suggestNextVersion(latest.version, "patch"),
        }));
      }
    }).catch(() => {
      setError("Failed to load skill.");
    });
  }, [slug, router]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function loadFile(file: File) {
    setFileError("");
    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      setFileError(t("file_type_error"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") update("skillMdContent", text);
    };
    reader.readAsText(file, "utf-8");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/skills/${slug}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("submission_failed"));
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push(`/skills/${slug}/versions`), 1800);
    } catch {
      setError(t("network_error"));
    } finally {
      setLoading(false);
    }
  }

  const isApproved = skill?.moderationStatus === "approved";

  return (
    <div className="min-h-screen bg-[#faf3d0]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#7a6a5a] mb-6 font-body">
          <Link href="/dashboard" className="hover:text-[#a23f00]">
            {t("breadcrumb_dashboard")}
          </Link>
          <span>/</span>
          <Link href={`/skills/${slug}`} className="hover:text-[#a23f00]">
            {skill?.name ?? slug}
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#564337]">
            {t("breadcrumb_new_version")}
          </span>
        </div>

        <h1 className="text-3xl md:text-[48px] font-extrabold font-heading text-[#564337] mb-8 leading-none tracking-tight">
          {t("title")}
        </h1>

        {/* Auto-approval banner */}
        {skill && (
          <div
            className={`mb-6 rounded-[24px] px-5 py-3.5 text-sm font-body ${
              isApproved
                ? "bg-[#586330]/10 text-[#586330] border border-[#586330]/20"
                : "bg-[#a23f00]/10 text-[#a23f00] border border-[#a23f00]/20"
            }`}
          >
            {isApproved
              ? t("auto_approved_notice")
              : t("pending_notice")}
          </div>
        )}

        <div className="grid lg:grid-cols-10 gap-8">
          {/* Form — 65% */}
          <div className="lg:col-span-6">
            <div className="bg-[#fffdf7] rounded-[32px] p-6 md:p-8 border border-[#e8dfc8] card-shadow space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-[24px] px-5 py-3.5 text-sm font-body">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-[24px] px-5 py-3.5 text-sm font-body">
                  {t("success_message")}
                </div>
              )}

              {/* Skill info (read-only) */}
              {skill && (
                <div className="flex items-center gap-3 p-4 bg-[#f8f4db] rounded-[20px]">
                  <span className="text-2xl">{skill.iconEmoji}</span>
                  <div>
                    <p className="font-bold font-heading text-[#564337]">{skill.name}</p>
                    <p className="text-xs text-[#7a6a5a] font-body">{skill.summary}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Version number */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#564337] font-body">
                    {t("version_number")}
                  </label>
                  <Input
                    value={form.version}
                    onChange={(e) => update("version", e.target.value)}
                    placeholder="e.g. 1.1.0"
                    required
                    bg="bg-[#e7e3ca]"
                    disabled={loading || success}
                    pattern="^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
                  />
                  {latestVersion && (
                    <div className="flex gap-2 flex-wrap">
                      {(["patch", "minor", "major"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            update("version", suggestNextVersion(latestVersion.version, type))
                          }
                          className="px-3 py-1 text-xs font-semibold rounded-full border border-[#e8dfc8] bg-[#fffdf7] text-[#7a6a5a] hover:border-[#a23f00] hover:text-[#a23f00] transition-colors font-body"
                        >
                          {t("suggest")} {suggestNextVersion(latestVersion.version, type)}
                          <span className="ml-1 opacity-60">({type})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-[#a89070] font-body">
                    {t("semver_hint")}
                  </p>
                </div>

                {/* Changelog */}
                <div>
                  <Textarea
                    label={t("changelog")}
                    placeholder={t("changelog_placeholder")}
                    value={form.changelog}
                    onChange={(e) => update("changelog", e.target.value)}
                    rows={3}
                    bg="bg-[#e7e3ca]"
                    disabled={loading || success}
                    maxLength={1000}
                  />
                  <p className="text-xs text-[#a89070] mt-1 font-body text-right">
                    {form.changelog.length}/1000
                  </p>
                </div>

                {/* SKILL.md content */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-[#564337] font-body">
                      {t("skill_md_content")}
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#a23f00] hover:text-[#fa7025] transition-colors font-body"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      {t("select_file")}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) loadFile(file);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {fileError && (
                    <p className="text-xs text-red-500 font-body">{fileError}</p>
                  )}

                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    className="relative"
                  >
                    {isDragOver && (
                      <div className="absolute inset-0 z-10 rounded-[20px] bg-[rgba(162,63,0,0.07)] border-2 border-dashed border-[#a23f00] flex items-center justify-center pointer-events-none">
                        <span className="text-sm font-semibold text-[#a23f00] font-body">{t("drop_to_import")}</span>
                      </div>
                    )}
                    <Textarea
                      rows={16}
                      className="font-mono-custom text-sm"
                      bg={isDragOver ? "bg-[#fdf5e6]" : "bg-[#e7e3ca]"}
                      value={form.skillMdContent}
                      onChange={(e) => update("skillMdContent", e.target.value)}
                      placeholder={t("skill_md_placeholder")}
                      required
                    />
                  </div>
                </div>

                {/* Review notice */}
                {!isApproved && (
                  <div className="bg-[#faf3d0] border border-[#e8dfc8] rounded-[24px] px-5 py-3.5 text-sm text-[#7a6a5a] font-body">
                    {t("pending_review_notice")}
                  </div>
                )}

                <Button type="submit" loading={loading} className="w-full">
                  {t("submit_btn")}
                </Button>
              </form>
            </div>
          </div>

          {/* Sidebar — 35% */}
          <div className="lg:col-span-4 space-y-5">
            {/* Version history */}
            {latestVersion && (
              <div className="bg-[#fffdf7] rounded-[24px] p-5 border border-[#e8dfc8] card-shadow">
                <h3 className="font-semibold font-heading text-[#564337] mb-3 text-sm">
                  {t("current_version")}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#7a6a5a] font-body">v{latestVersion.version}</span>
                    <span className="text-xs px-2 py-0.5 bg-[#586330]/10 text-[#586330] rounded-full font-body">
                      {latestVersion.moderationStatus}
                    </span>
                  </div>
                  {latestVersion.changelog && (
                    <p className="text-xs text-[#7a6a5a] font-body">
                      {latestVersion.changelog}
                    </p>
                  )}
                </div>
                <Link
                  href={`/skills/${slug}/versions`}
                  className="mt-3 block text-center text-xs text-[#a23f00] hover:underline font-body"
                >
                  {tSkillVersions("title")} →
                </Link>
              </div>
            )}

            {/* Tips */}
            <div className="bg-[#fffdf7] rounded-[24px] p-5 border border-[#e8dfc8] card-shadow">
              <h3 className="font-semibold font-heading text-[#564337] mb-3 text-sm">
                {t("tips_title")}
              </h3>
              <ul className="space-y-2">
                {[t("tip_1"), t("tip_2"), t("tip_3")].map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs text-[#7a6a5a] font-body">
                    <span className="text-[#fa7025] flex-shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
