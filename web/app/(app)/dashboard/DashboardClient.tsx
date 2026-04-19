"use client";
import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n/context";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import dynamic from "next/dynamic";
import { SettingsIcon } from "@/components/icons";

const MySkillsClient = dynamic(() => import("./MySkillsClient").then((m) => m.MySkillsClient), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="bg-[#fffdf7] rounded-[24px] p-6 border border-[#e8dfc8] animate-pulse">
          <div className="h-5 bg-[#e8dfc8] rounded w-1/3 mb-3" />
          <div className="h-4 bg-[#e8dfc8] rounded w-2/3 mb-4" />
          <div className="h-4 bg-[#e8dfc8] rounded w-1/4" />
        </div>
      ))}
    </div>
  ),
});

interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}

interface UserInfo {
  id: number;
  email: string | null;
  phone: string | null;
  wechat: string | null;
  name: string;
  role: string;
  avatarColor: string;
  avatarInitials: string;
  avatarUrl: string | null;
  createdAt: string | null;
}

function formatRelativeTime(date: Date, t: ReturnType<typeof useT<"dashboard">>): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("just_now");
  if (mins < 60) return t("minutes_ago", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("hours_ago", { n: hours });
  const days = Math.floor(hours / 24);
  return t("days_ago", { n: days });
}

interface DashboardClientProps {
  user: UserInfo;
  quota: QuotaInfo;
  token: { id: string; createdAt: string | null; value: string } | null;
}

const ABILITY_COLORS: Record<string, string> = {
  "llm.generate": "#a23f00",
  "image.generate": "#fa7025",
  "vision.analyze": "#586330",
  "tts.synthesize": "#8a6040",
  "voice.synthesize": "#5a7a4a",
};

function formatAbility(ability: string): string {
  return ability
    .replace("llm.generate", "LLM")
    .replace("image.generate", "Image")
    .replace("vision.analyze", "Vision")
    .replace("tts.synthesize", "TTS")
    .replace("voice.synthesize", "Voice");
}

function UsageStatsCard() {
  const t = useT("dashboard");
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const [stats, setStats] = useState<{
    events7d: number;
    events30d: number;
    quotaUsed7d: number;
    quotaUsed30d: number;
    abilityBreakdown7d: { ability: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/user/analytics/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setStats(d);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-[0px 8px 24px_rgba(86,67,55,0.06)] p-5 md:p-8 border border-[rgba(220,193,177,0.1)]">
        <div className="h-6 bg-[#e8dfc8] rounded w-1/3 mb-4 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex-1 h-16 bg-[#e8dfc8] rounded-[20px] animate-pulse" />
          <div className="flex-1 h-16 bg-[#e8dfc8] rounded-[20px] animate-pulse" />
        </div>
      </div>
    );
  }

  const events = period === "7d" ? (stats.events7d ?? 0) : (stats.events30d ?? 0);
  const quotaUsed = period === "7d" ? (stats.quotaUsed7d ?? 0) : (stats.quotaUsed30d ?? 0);

  return (
    <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-[0px 8px 24px_rgba(86,67,55,0.06)] p-5 md:p-8 border border-[rgba(220,193,177,0.1)]">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold font-heading text-[#1d1c0d] mb-1">{t("usage_stats")}</h2>
          <p className="text-sm md:text-base text-[#564337] font-body">{t("your_activity")}</p>
        </div>
        <div className="flex gap-1 bg-[#f0e8d0] rounded-full p-1 self-start sm:self-auto">
          {(["7d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1 rounded-full text-sm font-body transition-all ${
                period === p
                  ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white"
                  : "text-[#586330] hover:bg-[#ede9cf]"
              }`}
            >
              {p === "7d" ? t("last_7d") : t("last_30d")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="flex-1 bg-[#f8f4db] rounded-[20px] p-4 text-center">
          <p className="text-2xl md:text-3xl font-bold text-[#a23f00] font-heading">{events.toLocaleString()}</p>
          <p className="text-xs text-[#564337] font-body mt-1">{t("api_calls")}</p>
        </div>
        <div className="flex-1 bg-[#f8f4db] rounded-[20px] p-4 text-center">
          <p className="text-2xl md:text-3xl font-bold text-[#586330] font-heading">{quotaUsed.toLocaleString()}</p>
          <p className="text-xs text-[#564337] font-body mt-1">{t("quota_units")}</p>
        </div>
      </div>

      {stats.abilityBreakdown7d.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[#a89070] font-body font-semibold uppercase tracking-wider">{t("top_abilities")}</p>
          <div className="flex flex-wrap gap-2">
            {stats.abilityBreakdown7d.slice(0, 5).map((a) => (
              <span
                key={a.ability}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-body font-semibold"
                style={{
                  backgroundColor: (ABILITY_COLORS[a.ability] ?? "#a89070") + "15",
                  color: ABILITY_COLORS[a.ability] ?? "#a89070",
                }}
              >
                {formatAbility(a.ability)}
                <span className="text-xs opacity-70">{a.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardClient({ user: initialUser, quota, token }: DashboardClientProps) {
  const t = useT("dashboard");
  const [user, setUser] = useState(initialUser);
  const [generating, setGenerating] = useState(false);
  const [activeToken, setActiveToken] = useState<{ id: string; createdAt: string | null; value: string } | null>(token);
  // Token 值持久化在 localStorage（key = token id），用于路由跳转后恢复
  const [tokenValue, setTokenValue] = useState<string | null>(() =>
    token ? token.value : null
  );
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  async function handleProfileSave(data: {
    name: string;
    avatarUrl: string | null;
    avatarInitials: string;
  }) {
    const res = await fetch("/api/user/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? t("save_error"));
    const updatedUser = {
      ...user,
      name: json.name,
      avatarUrl: json.avatarUrl,
      avatarInitials: json.avatarInitials,
    };
    setUser(updatedUser);
    window.dispatchEvent(new CustomEvent("clawplay:profile-updated", { detail: updatedUser }));
  }
  async function generateToken() {
    setGenerating(true);
    try {
      const res = await fetch("/api/user/token/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newToken = { id: data.tokenId, createdAt: data.createdAt, value: data.token };
      setActiveToken(newToken);
      setTokenValue(data.token);
      localStorage.setItem(`clawplay_token_${data.tokenId}`, data.token);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("generate_failed"));
    } finally {
      setGenerating(false);
    }
  }

  async function copyToken() {
    if (!tokenValue) return;
    await navigator.clipboard.writeText(`export CLAWPLAY_TOKEN=${tokenValue}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function revokeToken() {
    if (!activeToken) return;
    setRevoking(true);
    try {
      await fetch("/api/user/token/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: activeToken.id }),
      });
      localStorage.removeItem(`clawplay_token_${activeToken.id}`);
      setActiveToken(null);
      setTokenValue(null);
    } catch {
      alert(t("revoke_failed"));
    } finally {
      setRevoking(false);
    }
  }

  const quotaPct = Math.min(100, Math.round((quota.used / quota.limit) * 100));
  const progressColor =
    quotaPct > 80 ? "bg-[#DC2626]" : quotaPct > 50 ? "bg-[#fa7025]" : "bg-[#586330]";

  const displayName = user.name || user.phone || user.email?.split("@")[0] || t("display_name_fallback");
  const joinedAt = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="max-w-[1536px] mx-auto w-full px-4 py-5 sm:px-6 lg:p-8 flex flex-col gap-6 lg:gap-8">
      {/* Welcome header */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-heading text-[#1d1c0d] tracking-tight break-words">
          {t("welcome")}<span className="text-[#a23f00]">{displayName}</span>
        </h1>
        <p className="text-sm sm:text-base text-[#564337] italic font-body">
          {t("tagline")}
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Left column */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Profile card */}
          <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-[0px_8px_24px_rgba(86,67,55,0.06)] p-5 md:p-8">
            {/* Header: avatar + name + edit */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.id}&backgroundColor=ff6b35,fa7025,a23f00`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-[#897365] uppercase tracking-wider font-body mb-0.5">{t("user_name")}</p>
                <p className="text-lg md:text-xl font-bold text-[#1d1c0d] font-heading truncate">{user.name || t("anonymous")}</p>
                <p className="text-xs text-[#a89070] font-body">{user.phone || user.email || "—"}</p>
              </div>
              <button
                onClick={() => setProfileModalOpen(true)}
                className="flex-shrink-0 inline-flex w-full sm:w-auto items-center justify-center px-5 py-2.5 rounded-full bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white text-sm font-semibold font-heading shadow-[0_4px_12px_rgba(162,63,0,0.2)] hover:opacity-90 transition-opacity min-h-11"
              >
                <SettingsIcon className="w-4 h-4" /> {t("edit")}
              </button>
            </div>
            {/* Divider */}
            <div className="border-t border-[#f0e8d0] mb-5" />
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-[#897365] uppercase tracking-wider mb-2 font-body">{t("registered_at")}</p>
                <p className="text-base text-[#1d1c0d] font-medium font-body">{joinedAt}</p>
              </div>
            </div>
          </div>

          {/* Token card */}
          <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-[0px_8px_24px_rgba(86,67,55,0.06)] p-5 md:p-8 border border-[rgba(220,193,177,0.1)] relative overflow-hidden">
            <div className="absolute bg-[rgba(250,112,37,0.1)] blur-[32px] right-[-40px] top-[-40px] w-[160px] h-[160px] rounded-full pointer-events-none" />
            <h2 className="text-xl md:text-2xl font-extrabold font-heading text-[#1d1c0d] mb-6">{t("token_mgmt")}</h2>
            {activeToken ? (
              <div className="flex flex-col gap-4">
                {/* Token display */}
                <div className="bg-[#1d1c0d] rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <code className="text-sm font-mono-custom text-[#ffdbcd] truncate">
                    {tokenValue
                      ? `export CLAWPLAY_TOKEN=${tokenValue.length > 20 ? `${tokenValue.slice(0, 8)}...` : tokenValue}`
                      : t("current_token")}
                  </code>
                  <button
                    onClick={copyToken}
                    className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white text-sm font-semibold rounded-full font-heading hover:opacity-90 transition-opacity min-h-11"
                  >
                    {copied ? t("copied") : t("copy_token")}
                  </button>
                </div>
                {/* Footer */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-[#564337] font-body opacity-60">
                    {t("generated_at")} {activeToken.createdAt ? formatRelativeTime(new Date(activeToken.createdAt), t) : "—"}
                  </span>
                  <button
                    onClick={revokeToken}
                    disabled={revoking}
                    className="text-xs text-red-600 font-semibold hover:underline font-body"
                  >
                    {revoking ? t("revoking") : t("revoke")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={generateToken}
                disabled={generating}
                className="w-full min-h-14 py-4 rounded-[32px] bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-base md:text-lg font-semibold font-heading shadow-[0_10px_15px_-3px_rgba(162,63,0,0.2),0_4px_6px_-4px_rgba(162,63,0,0.2)] hover:opacity-90 transition-opacity flex items-center justify-center gap-3"
              >
                {generating ? (
                  <><span className="animate-spin">⏳</span><span>{t("generating")}</span></>
                ) : (
                  <><span>✨</span><span>{t("generate_token")}</span></>
                )}
              </button>
            )}
            {!activeToken && (
              <p className="text-xs text-[#564337] opacity-60 text-center mt-3 font-body">{t("token_valid_30d")}</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-8 flex flex-col gap-6 lg:gap-8">
          {/* Quota Card */}
          <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-[0px 8px 24px_rgba(86,67,55,0.06)] p-5 md:p-8 border border-[rgba(220,193,177,0.1)]">
            <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold font-heading text-[#1d1c0d] mb-1">{t("free_quota")}</h2>
                <p className="text-sm md:text-base text-[#564337] font-body">{t("monthly_usage")}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl md:text-3xl font-semibold text-[#586330] font-heading">{quota.used}</span>
                <span className="text-sm md:text-base text-[#564337] font-body"> / {quota.limit}</span>
              </div>
            </div>
            <div className="h-6 bg-[#ede9cf] rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                style={{ width: `${quotaPct}%` }}
              />
            </div>
            <div className="bg-[#fefae0] rounded-[20px] p-4 flex items-start gap-3">
              <span className="text-xl">✨</span>
              <p className="text-sm text-[#564337] font-body">
                {t("quota_status")} <strong className="text-[#586330]">{t("status_good")}</strong>，{t("quota_remaining", { n: quota.remaining })}，{t("reset_in")}
              </p>
            </div>
          </div>

          {/* Usage Stats */}
          <UsageStatsCard />

          {/* My Skills */}
          <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-[0px_8px_24px_rgba(86,67,55,0.06)] p-5 md:p-8 border border-[rgba(220,193,177,0.1)]">
            <h2 className="text-xl md:text-2xl font-extrabold font-heading text-[#1d1c0d] mb-6">
              {t("my_skills")}
            </h2>
            <MySkillsClient />
          </div>
        </div>
      </div>

      <ProfileEditModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialName={user.name}
        userId={user.id}
        initialAvatarUrl={user.avatarUrl}
        onSave={handleProfileSave}
      />
    </div>
  );
}
