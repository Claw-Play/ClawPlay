"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";

export default function SubmitPage() {
  const router = useRouter();
  const t = useTranslations("submit");
  const [form, setForm] = useState({
    name: "",
    summary: "",
    repoUrl: "",
    iconEmoji: "🦐",
    skillMdContent: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => {
        if (!r.ok) throw new Error("not authed");
      })
      .catch(() => router.push("/login"));
  }, [router]);

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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear when leaving the drop zone entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/skills/submit", {
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
      setLoading(false);
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch {
      setError(t("network_error"));
    } finally {
      setLoading(false);
    }
  }

  const EMOJIS = ["🦐", "🌍", "🎨", "🎮", "🎵", "📸", "🤖", "✨", "🌟", "🔥", "💬", "🎯"];

  return (
    <div className="min-h-screen bg-[#faf3d0]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#7a6a5a] mb-6 font-body">
          <Link href="/dashboard" className="hover:text-[#a23f00]">{t("breadcrumb_dashboard")}</Link>
          <span>/</span>
          <span className="font-semibold text-[#564337]">{t("breadcrumb_submit")}</span>
        </div>

        <h1 className="text-3xl md:text-[60px] font-extrabold font-heading text-[#564337] mb-8 leading-none tracking-tight">
          {t("title")}
        </h1>

        <div className="grid lg:grid-cols-10 gap-8">
          {/* Form — 65% */}
          <div className="lg:col-span-6">
            <div className="bg-[#fffdf7] rounded-[32px] p-6 md:p-8 border border-[#e8dfc8] card-shadow space-y-5">
              <form onSubmit={handleSubmit} className="space-y-5">
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

                {/* Name */}
                <Input
                  label={t("skill_name")}
                  placeholder={t("skill_name_placeholder")}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                  bg="bg-[#e7e3ca]"
                  disabled={loading || success}
                />

                {/* Emoji picker */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#564337] font-body">
                    {t("icon_emoji")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => update("iconEmoji", e)}
                        className={`w-10 h-10 text-xl rounded-[16px] border transition-all ${
                          form.iconEmoji === e
                            ? "border-[#a23f00] bg-[#faf3d0] ring-2 ring-[#a23f00]"
                            : "border-[#e8dfc8] bg-[#fffdf7] hover:border-[#a23f00]"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <Input
                  label={t("one_line_summary")}
                  placeholder={t("summary_placeholder")}
                  value={form.summary}
                  onChange={(e) => update("summary", e.target.value)}
                  bg="bg-[#e7e3ca]"
                />

                {/* Repo URL */}
                <Input
                  label={t("github_url")}
                  type="url"
                  placeholder={t("github_placeholder")}
                  value={form.repoUrl}
                  onChange={(e) => update("repoUrl", e.target.value)}
                  bg="bg-[#e7e3ca]"
                />

                {/* SKILL.md content — text input + drag-and-drop import */}
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
                      onChange={handleFileInput}
                    />
                  </div>

                  {fileError && (
                    <p className="text-xs text-red-500 font-body">{fileError}</p>
                  )}

                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className="relative rounded-[20px] transition-all"
                  >
                    {/* Drag overlay */}
                    {isDragOver && (
                      <div className="absolute inset-0 z-10 rounded-[20px] bg-[rgba(162,63,0,0.07)] border-2 border-dashed border-[#a23f00] flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a23f00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span className="text-sm font-semibold text-[#a23f00] font-body">{t("drop_to_import")}</span>
                      </div>
                    )}
                    <Textarea
                      placeholder={`${t("skill_md_placeholder")}，${t("drop_to_import")}`}
                      rows={18}
                      className="font-mono-custom text-sm"
                      bg={isDragOver ? "bg-[#fdf5e6]" : "bg-[#e7e3ca]"}
                      value={form.skillMdContent}
                      onChange={(e) => update("skillMdContent", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="bg-[#faf3d0] border border-[#e8dfc8] rounded-[24px] px-5 py-3.5 text-sm text-[#7a6a5a] font-body">
                  {t("review_notice")}
                </div>

                <Button type="submit" loading={loading} className="w-full">
                  {t("submit_btn")}
                </Button>
              </form>
            </div>
          </div>

          {/* Guide sidebar — 35% */}
          <div className="lg:col-span-4 space-y-5">
            {/* How it works */}
            <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow">
              <h3 className="font-semibold font-heading text-[#564337] mb-4">{t("how_it_works")}</h3>
              <div className="space-y-4">
                {[
                  { title: t("step_1_title"), desc: t("step_1_desc") },
                  { title: t("step_2_title"), desc: t("step_2_desc") },
                  { title: t("step_3_title"), desc: t("step_3_desc") },
                  { title: t("step_4_title"), desc: t("step_4_desc") },
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white text-xs font-bold flex items-center justify-center font-heading">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#564337] font-body">{step.title}</p>
                      <p className="text-xs text-[#7a6a5a] mt-0.5 font-body">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SKILL.md template */}
            <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow">
              <h3 className="font-semibold font-heading text-[#564337] mb-3">{t("skill_md_template")}</h3>
              <p className="text-xs text-[#7a6a5a] mb-3 font-body">
                {t("template_note")}
              </p>
              <pre className="bg-[#faf3d0] rounded-[16px] p-4 text-xs font-mono-custom text-[#564337] overflow-x-auto">
{`---
name: My Skill
icon: 🦐
description: One-liner
requires:
  env: []
  bins: []
---

# My Skill

Your instructions here...`}
              </pre>
            </div>

            {/* Tips */}
            <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow">
              <h3 className="font-semibold font-heading text-[#564337] mb-3">{t("tips")}</h3>
              <ul className="space-y-2">
                {[t("tip_1"), t("tip_2"), t("tip_3"), t("tip_4"), t("tip_5")].map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs text-[#7a6a5a] font-body">
                    <span className="text-[#fa7025] flex-shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Illustration */}
            <div className="bg-[#f8f4db] rounded-[32px] p-6 text-center space-y-3 border border-[rgba(220,193,177,0.3)]">
              <div className="text-5xl">🌱</div>
              <p className="text-sm font-serif italic text-[#7a6a5a] leading-relaxed">
                {t("seed_title")}
              </p>
              <p className="text-xs text-[#a89888] font-body">
                {t("seed_subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
