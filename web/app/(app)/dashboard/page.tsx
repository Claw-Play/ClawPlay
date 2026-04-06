"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}

interface UserInfo {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => {
        if (!r.ok) throw new Error("not authed");
        return r.json();
      })
      .then((data) => {
        setUser(data.user);
        setQuota(data.quota);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function generateToken() {
    setGenerating(true);
    try {
      const res = await fetch("/api/user/token/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToken(data.token);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setGenerating(false);
    }
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(`export CLAWPLAY_TOKEN=${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf3d0]">
        <div className="text-[#7a6a5a] animate-pulse font-body">Loading...</div>
      </div>
    );
  }

  const quotaPct = quota
    ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
    : 0;

  const progressColor =
    quotaPct > 80 ? "bg-[#DC2626]" : quotaPct > 50 ? "bg-[#fa7025]" : "bg-[#586330]";

  return (
    <div className="min-h-screen bg-[#faf3d0]">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Identity + Community cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* User Identity Card */}
          <div className="bg-[#fffdf7] card-radius p-5 border border-[#e8dfc8] card-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#faf3d0] border border-[#e8dfc8] flex items-center justify-center text-lg">
                🦐
              </div>
              <div className="min-w-0">
                <p className="font-semibold font-heading text-[#564337] truncate">
                  {user?.name || user?.email?.split("@")[0] || "User"}
                </p>
                <p className="text-xs text-[#a89888] font-mono-custom">
                  USR-{String(user?.id ?? "").padStart(4, "0")}
                </p>
              </div>
              {user?.role === "admin" && (
                <span className="ml-auto px-2 py-0.5 bg-[#586330]/10 text-[#586330] text-xs font-semibold rounded-full font-body">
                  Admin
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#7a6a5a] font-body">Email</span>
                <span className="text-[#564337] font-body truncate ml-2 max-w-[160px]">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7a6a5a] font-body">Member Since</span>
                <span className="text-[#564337] font-body">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Community Status Card */}
          <div className="bg-[#fffdf7] card-radius p-5 border border-[#e8dfc8] card-shadow flex flex-col justify-center items-center text-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌿</span>
              <span className="inline-flex items-center px-2.5 py-1 bg-[#586330]/10 text-[#586330] text-xs font-semibold rounded-full font-body">
                Active Member
              </span>
            </div>
            <p className="text-sm font-semibold font-heading text-[#564337]">
              Top 5% Contributor
            </p>
            <p className="text-xs text-[#a89888] font-body">Keep building amazing Skills!</p>
          </div>
        </div>

        {/* Quota card */}
        <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold font-heading text-[#564337]">Free Quota</h2>
            <span className="text-sm text-[#7a6a5a] font-body">
              {quota ? `${quota.used} / ${quota.limit}` : "—"}
            </span>
          </div>

          {/* Progress bar — warm yellow track per Figma */}
          <div className="h-3 bg-[#ede9cf] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#7a6a5a] font-body">
              {quota ? `${quota.remaining} units remaining` : "Loading..."}
            </p>
            <div className="flex gap-3">
              <span className="flex items-center gap-1 text-xs text-[#7a6a5a] font-body">
                <span className="w-2 h-2 rounded-full bg-[#586330] inline-block" /> Auto-Refill
              </span>
              <span className="flex items-center gap-1 text-xs text-[#7a6a5a] font-body">
                <span className="w-2 h-2 rounded-full bg-[#586330] inline-block" /> 2FA Shield
              </span>
              <span className="flex items-center gap-1 text-xs text-[#7a6a5a] font-body">
                <span className="w-2 h-2 rounded-full bg-[#586330] inline-block" /> Cloud Sync
              </span>
            </div>
          </div>
        </div>

        {/* Token card */}
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold font-heading text-[#564337]">Your CLI Token</h2>
            <p className="text-sm text-[#7a6a5a] font-body">
              Use this token to power your X Claw Skills with ClawPlay capabilities.
            </p>
          </div>

          {!token ? (
            <Button onClick={generateToken} loading={generating} className="w-full">
              🦐 Generate Token
            </Button>
          ) : (
            <>
              {/* Dark code box */}
              <div
                className="rounded-[24px] p-5 border border-[#464330]"
                style={{ background: "#1d1c0d" }}
              >
                <p className="text-xs mb-3 font-body" style={{ color: "#a89888" }}>
                  Add to your X Claw environment:
                </p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-sm font-mono-custom leading-relaxed" style={{ color: "#fa7025" }}>
                    export CLAWPLAY_TOKEN={token.length > 20 ? `${token.slice(0, 8)}...${token.slice(-4)}` : token}
                  </code>
                  <button
                    onClick={copyToken}
                    className="flex-shrink-0 px-4 py-2 rounded-[16px] text-sm font-semibold font-heading transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #a23f00 0%, #fa7025 100%)", color: "#fff" }}
                  >
                    {copied ? "✅ Copied" : "📋 Copy"}
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#7a6a5a] font-body">
                Token expires in 30 days. Sign out to revoke access.
              </p>
              <form action="/api/auth/logout" method="POST">
                <button className="text-sm text-[#a89888] hover:text-[#a23f00] transition-colors font-body underline">
                  Revoke Access & Sign out
                </button>
              </form>
            </>
          )}
        </div>

        {/* Quick start */}
        <div className="bg-[#fffdf7] card-radius p-6 border border-[#e8dfc8] card-shadow">
          <h2 className="font-semibold font-heading text-[#564337] mb-3">Quick Start</h2>
          <div className="space-y-2 text-sm font-mono-custom">
            <div className="bg-[#faf3d0] rounded-[16px] p-3 text-[#7a6a5a]">
              <span className="text-[#fa7025]"># </span>
              <span>Install CLI</span>
            </div>
            <div className="bg-[#faf3d0] rounded-[16px] p-3 text-[#7a6a5a]">
              <span className="text-[#fa7025]"># </span>
              <span>Configure your token</span>
            </div>
            <div className="bg-[#faf3d0] rounded-[16px] p-3 text-[#7a6a5a]">
              <span className="text-[#fa7025]"># </span>
              <span>clawplay whoami</span>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex gap-3">
          <Link
            href="/skills"
            className="flex-1 text-center px-4 py-3 bg-[#fffdf7] border-2 border-[#e8dfc8] text-[#7a6a5a] text-sm font-semibold rounded-[40px] hover:border-[#a23f00] hover:text-[#a23f00] transition-colors font-heading"
          >
            Browse Skills
          </Link>
          <Link
            href="/submit"
            className="flex-1 text-center px-4 py-3 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold rounded-[40px] shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
          >
            Submit a Skill
          </Link>
        </div>
      </div>
    </div>
  );
}
