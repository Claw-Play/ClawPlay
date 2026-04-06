"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}

interface UserInfo {
  id: number;
  email: string;
  phone: string | null;
  wechat: string | null;
  name: string;
  role: string;
  createdAt: string;
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

const NAV_ITEMS = [
  { label: "概览", href: "/dashboard", icon: "📊", active: true },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [tokenCreatedAt, setTokenCreatedAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => {
        if (!r.ok) throw new Error("not authed");
        return r.json();
      })
      .then((data) => {
        setUser(data.user);
        setQuota(data.quota);
        if (data.token) {
          setTokenCreatedAt(new Date(data.token.createdAt));
          // Active token exists but we don't have the encrypted value
          // — user must generate a new one to see it
        }
      })
      .catch(() => {
        setRedirecting(true);
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fefae0]">
        <div className="text-[#7a6a5a] animate-pulse font-body">Loading...</div>
      </div>
    );
  }

  async function generateToken() {
    setGenerating(true);
    try {
      const res = await fetch("/api/user/token/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToken(data.token);
      setTokenId(data.tokenId);
      setTokenCreatedAt(new Date(data.createdAt));
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成 Token 失败");
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

  async function revokeToken() {
    setRevoking(true);
    try {
      await fetch("/api/user/token/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId }),
      });
      setToken(null);
      setTokenId(null);
      setTokenCreatedAt(null);
    } catch {
      alert("撤销失败，请稍后重试。");
    } finally {
      setRevoking(false);
    }
  }

  const quotaPct = quota
    ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
    : 0;

  const progressColor =
    quotaPct > 80 ? "bg-[#DC2626]" : quotaPct > 50 ? "bg-[#fa7025]" : "bg-[#586330]";

  const userId = String(user?.id ?? "").padStart(4, "0");
  const displayName = user?.name || user?.phone || user?.email?.split("@")[0] || "用户";
  const joinedAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="min-h-screen bg-[#fefae0] flex flex-col">
      {/* Top Navigation */}
      <header className="bg-[#fefae0] border-b border-[#e8dfc8] sticky top-0 z-50">
        <div className="max-w-[1536px] mx-auto px-8 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🦐</span>
            <span className="text-xl font-bold font-heading text-[#a23f00] group-hover:text-[#c45000] transition-colors">
              ClawPlay
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-8">
            {[
              { label: "控制台", href: "/dashboard", active: true },
              { label: "社区", href: "/community", active: false },
              { label: "Skills", href: "/skills", active: false },
              { label: "Token", href: "/dashboard", active: false },
            ].map(({ label, href, active }) => (
              <Link
                key={label}
                href={href}
                className={`text-sm font-semibold transition-colors font-body ${
                  active
                    ? "text-[#a23f00] border-b-2 border-[#a23f00] pb-1"
                    : "text-[#586330] hover:text-[#a23f00]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="px-6 py-2 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold rounded-full shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
            >
              生成 Token
            </Link>
            <div className="w-10 h-10 rounded-full bg-[#faf3d0] border-2 border-[#e8dfc8] flex items-center justify-center text-lg">
              🦐
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 max-w-[1536px] mx-auto w-full p-8 gap-8">
        {/* Left Sidebar */}
        <aside className="w-[180px] shrink-0">
          <div className="bg-[#f8f4db] rounded-[32px] shadow-[8px_0px_24px_rgba(86,67,55,0.06)] p-6 flex flex-col gap-6 h-full">
            {/* Brand */}
            <div>
              <p className="text-sm font-bold text-[#a23f00] font-heading mb-1">Creator Hub</p>
              <p className="text-xs text-[#586330] opacity-70 font-body">活跃成员</p>
            </div>

            {/* Nav */}
            <nav className="flex-1 flex flex-col gap-1">
              {NAV_ITEMS.map(({ label, href, icon, active }) => (
                <Link
                  key={label}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium font-body transition-colors ${
                    active
                      ? "bg-[#a23f00] text-white"
                      : "text-[#586330] hover:bg-[#ede9cf]"
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </Link>
              ))}
            </nav>

            {/* Bottom actions */}
            <div className="flex flex-col gap-2">
              <form action="/api/auth/logout" method="POST">
                <button className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-[#586330] text-sm font-medium font-body hover:bg-[#ede9cf] transition-colors">
                  <span>🚪</span>
                  <span>退出登录</span>
                </button>
              </form>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col gap-8">
          {/* Welcome header */}
          <div className="space-y-2">
            <h1 className="text-5xl font-extrabold font-heading text-[#1d1c0d] tracking-tight">
              欢迎回来，<span className="text-[#a23f00]">{displayName}</span>
            </h1>
            <p className="text-base text-[#564337] italic font-body">
              「持续创造，精彩自来。」
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-12 gap-8">
            {/* Left column — Identity Card */}
            <div className="col-span-12 md:col-span-4">
              {/* User Identity Card */}
              <div className="bg-white rounded-[32px] shadow-[0px_8px_24px_rgba(86,67,55,0.06)] p-8 relative">
                <div className="absolute top-8 right-8 text-5xl">🦐</div>
                <h2 className="text-lg font-bold text-[#a23f00] font-heading mb-6">用户信息</h2>
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-semibold text-[#897365] uppercase tracking-wider mb-2 font-body">账号 ID</p>
                    <div className="inline-block bg-[#f8f4db] rounded-full px-4 py-1 font-mono-custom text-sm text-[#564337]">
                      SUN-{userId}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-[#897365] uppercase tracking-wider mb-2 font-body">
                      {user?.phone ? "手机号" : "邮箱"}
                    </p>
                    <p className="text-base text-[#1d1c0d] font-medium font-body">
                      {user?.phone || user?.email || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-[#897365] uppercase tracking-wider mb-2 font-body">注册时间</p>
                    <p className="text-base text-[#1d1c0d] font-medium font-body">{joinedAt}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column — Quota + Token */}
            <div className="col-span-12 md:col-span-8 flex flex-col gap-8">
              {/* Quota Usage Card */}
              <div className="bg-white rounded-[32px] shadow-[0px_8px_24px_rgba(86,67,55,0.06)] p-8 border border-[rgba(220,193,177,0.1)]">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-extrabold font-heading text-[#1d1c0d] mb-1">免费配额</h2>
                    <p className="text-base text-[#564337] font-body">本月生成额度</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-semibold text-[#586330] font-heading">{quota?.used ?? 0}</span>
                    <span className="text-base text-[#564337] font-body"> / {quota?.limit ?? 1000}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-6 bg-[#ede9cf] rounded-full overflow-hidden mb-4">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>

                {/* Status message */}
                <div className="bg-[#fefae0] rounded-[20px] p-4 flex items-center gap-3">
                  <span className="text-xl">✨</span>
                  <p className="text-sm text-[#564337] font-body">
                    当前配额使用状态 <strong className="text-[#586330]">良好</strong>，剩余 {quota?.remaining ?? 0} 单位，距离重置还有 30 天。
                  </p>
                </div>
              </div>

              {/* Token Management Card */}
              <div className="bg-white rounded-[32px] shadow-[0px_8px_24px_rgba(86,67,55,0.06)] p-8 border border-[rgba(220,193,177,0.1)] relative overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute bg-[rgba(250,112,37,0.1)] blur-[32px] right-[-40px] top-[-40px] w-[160px] h-[160px] rounded-full pointer-events-none" />

                <h2 className="text-2xl font-extrabold font-heading text-[#1d1c0d] mb-6">Token 管理</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left — Generate Token Button */}
                  <div className="flex flex-col gap-4">
                    {token ? (
                      <div className="bg-[#f8f4db] border border-[rgba(220,193,177,0.2)] rounded-[32px] p-6">
                        <p className="text-[10px] font-semibold text-[#897365] uppercase tracking-wider mb-3 font-body">当前 Token</p>
                        <div className="bg-[#1d1c0d] rounded-[20px] p-4 flex items-center justify-between gap-3 mb-4">
                          <code className="text-sm font-mono-custom text-[#ffdbcd] truncate">
                            export CLAWPLAY_TOKEN={token.length > 20 ? `${token.slice(0, 8)}...` : token}
                          </code>
                          <button
                            onClick={copyToken}
                            className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white text-sm font-semibold rounded-full font-heading hover:opacity-90 transition-opacity"
                          >
                            {copied ? "✅ 已复制" : "📋 复制"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#564337] font-body opacity-60">
                            生成于 {tokenCreatedAt ? formatRelativeTime(tokenCreatedAt) : "—"}
                          </span>
                          <button
                            onClick={revokeToken}
                            disabled={revoking}
                            className="text-xs text-red-600 font-semibold hover:underline font-body"
                          >
                            {revoking ? "撤销中..." : "撤销访问"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={generateToken}
                        disabled={generating}
                        className="w-full py-5 rounded-[32px] bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white text-lg font-semibold font-heading shadow-[0_10px_15px_-3px_rgba(162,63,0,0.2),0_4px_6px_-4px_rgba(162,63,0,0.2)] hover:opacity-90 transition-opacity flex items-center justify-center gap-3"
                      >
                        {generating ? (
                          <>
                            <span className="animate-spin">⏳</span>
                            <span>生成中...</span>
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            <span>生成 Token</span>
                          </>
                        )}
                      </button>
                    )}
                    {!token && (
                      <p className="text-xs text-[#564337] opacity-60 text-center font-body">
                        Token 有效期 30 天，请妥善保管。
                      </p>
                    )}
                  </div>

                  {/* Right — CLI Guide */}
                  <div className="bg-[#f8f4db] rounded-[32px] p-6 border border-[rgba(220,193,177,0.2)]">
                    <p className="text-[10px] font-semibold text-[#897365] uppercase tracking-wider mb-4 font-body">快速开始</p>
                    <div className="space-y-2 font-mono-custom text-sm">
                      <div className="bg-[#faf3d0] rounded-[16px] p-3 text-[#7a6a5a]">
                        <span className="text-[#fa7025]">$ </span>
                        <span>npm install -g clawplay</span>
                      </div>
                      <div className="bg-[#faf3d0] rounded-[16px] p-3 text-[#7a6a5a]">
                        <span className="text-[#fa7025]">$ </span>
                        <span>clawplay whoami</span>
                      </div>
                      <div className="bg-[#faf3d0] rounded-[16px] p-3 text-[#7a6a5a]">
                        <span className="text-[#fa7025]">$ </span>
                        <span>clawplay image generate ...</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex gap-4">
            <Link
              href="/skills"
              className="flex-1 text-center px-6 py-4 bg-white border-2 border-[#e8dfc8] text-[#7a6a5a] text-sm font-semibold rounded-full hover:border-[#a23f00] hover:text-[#a23f00] transition-colors font-heading"
            >
              浏览 Skills
            </Link>
            <Link
              href="/submit"
              className="flex-1 text-center px-6 py-4 bg-gradient-to-r from-[#a23f00] to-[#fa7025] hover:opacity-90 text-white text-sm font-semibold rounded-full shadow-[0_6px_24px_rgba(162,63,0,0.2)] transition-all font-heading"
            >
              提交 Skill
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
