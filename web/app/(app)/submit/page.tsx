"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";

export default function SubmitPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    summary: "",
    repoUrl: "",
    iconEmoji: "🦐",
    skillMdContent: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        setError(data.error ?? "Submission failed.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
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
          <Link href="/dashboard" className="hover:text-[#a23f00]">Dashboard</Link>
          <span>/</span>
          <span className="font-semibold text-[#564337]">Submit Skill</span>
        </div>

        <h1 className="text-3xl md:text-[60px] font-extrabold font-heading text-[#564337] mb-8 leading-none tracking-tight">
          Share your magic.
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

                {/* Name */}
                <Input
                  label="Skill name"
                  placeholder="e.g. Shrimp Avatar Creator"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                  bg="bg-[#e7e3ca]"
                />

                {/* Emoji picker */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#564337] font-body">
                    Icon emoji
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
                  label="One-line summary"
                  placeholder="Describe what this Skill in one sentence"
                  value={form.summary}
                  onChange={(e) => update("summary", e.target.value)}
                  bg="bg-[#e7e3ca]"
                />

                {/* Repo URL */}
                <Input
                  label="GitHub / GitLab URL"
                  type="url"
                  placeholder="https://github.com/you/your-skill"
                  value={form.repoUrl}
                  onChange={(e) => update("repoUrl", e.target.value)}
                  bg="bg-[#e7e3ca]"
                />

                {/* SKILL.md content */}
                <Textarea
                  label="SKILL.md content"
                  placeholder="Paste the content of your SKILL.md file here..."
                  rows={18}
                  className="font-mono-custom text-sm"
                  bg="bg-[#e7e3ca]"
                  value={form.skillMdContent}
                  onChange={(e) => update("skillMdContent", e.target.value)}
                  required
                />

                {/* Submit */}
                <div className="bg-[#faf3d0] border border-[#e8dfc8] rounded-[24px] px-5 py-3.5 text-sm text-[#7a6a5a] font-body">
                  ✨ Your Skill will be reviewed by our team within 24–48 hours.
                </div>

                <Button type="submit" loading={loading} className="w-full">
                  Submit for review
                </Button>
              </form>
            </div>
          </div>

          {/* Guide sidebar — 35% */}
          <div className="lg:col-span-4 space-y-5">
            {/* How it works */}
            <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow">
              <h3 className="font-semibold font-heading text-[#564337] mb-4">How it works</h3>
              <div className="space-y-4">
                {GUIDE_STEPS.map((step, i) => (
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
              <h3 className="font-semibold font-heading text-[#564337] mb-3">SKILL.md template</h3>
              <p className="text-xs text-[#7a6a5a] mb-3 font-body">
                Your SKILL.md should include frontmatter like:
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
              <h3 className="font-semibold font-heading text-[#564337] mb-3">Tips</h3>
              <ul className="space-y-2">
                {TIPS.map((tip, i) => (
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
                Every great forest began as a single seed.
              </p>
              <p className="text-xs text-[#a89888] font-body">
                Yours is ready to grow.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const GUIDE_STEPS = [
  {
    title: "Fill in the form",
    desc: "Name, emoji icon, one-line summary, and GitHub URL.",
  },
  {
    title: "Paste your SKILL.md",
    desc: "Include frontmatter with requires.env and requires.bins.",
  },
  {
    title: "Submit for review",
    desc: "Our team reviews within 24–48 hours.",
  },
  {
    title: "Get approved",
    desc: "Your Skill appears in the public directory!",
  },
];

const TIPS = [
  "Keep the description short and clear",
  "Use relevant emoji icons",
  "List all required environment variables",
  "Test your Skill before submitting",
  "Include example commands in SKILL.md",
];
