"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { ProfileEditModal } from "@/components/ProfileEditModal";
import dynamic from "next/dynamic";
import { NewSparkleIcon, PencilIcon } from "@/components/icons";

const MySkillsClient = dynamic(() => import("./MySkillsClient").then((m) => m.MySkillsClient), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-[24px] border border-[#dbe5f7] bg-white p-5 shadow-[0_12px_28px_rgba(25,43,87,0.04)]">
          <div className="mb-3 h-5 w-1/3 rounded bg-[#e9eef8]" />
          <div className="mb-4 h-4 w-2/3 rounded bg-[#e9eef8]" />
          <div className="h-4 w-1/4 rounded bg-[#e9eef8]" />
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

function UsageStatsCard() {
  const t = useT("dashboard");
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const [stats, setStats] = useState<{
    events7d: number;
    events30d: number;
    quotaUsed7d: number;
    quotaUsed30d: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/user/analytics/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setStats(d);
      })
      .catch(() => {})
  }, []);

  return (
    <div className="rounded-[18px] border border-[#dfe5ef] bg-white p-7 shadow-[0_10px_28px_rgba(20,31,54,0.04)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[24px] font-semibold text-[#111c33]">{t("usage_stats")}</h2>
          <p className="mt-1 text-[14px] text-[#7c879f]">{t("your_activity")}</p>
        </div>
        <div className="inline-flex overflow-hidden rounded-[6px] border border-[#cbd8ee] bg-white">
          {(["7d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={[
                "h-11 min-w-[82px] px-4 text-[14px] font-medium transition-colors",
                period === p
                  ? "rounded-[6px] border border-[#9ebcf5] bg-[#f4f8ff] text-[#2d67f7]"
                  : "text-[#6d7891]",
              ].join(" ")}
            >
              {p === "7d" ? t("last_7d") : t("last_30d")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-[12px] border border-[#e4eaf4] bg-[#fbfdff] px-4 py-5 text-center">
          <p className="text-[34px] font-semibold text-[#1f62e8]">
            {(period === "7d" ? stats?.events7d : stats?.events30d) ?? 0}
          </p>
          <p className="mt-1 text-[13px] text-[#7c879f]">{t("api_calls")}</p>
        </div>
        <div className="rounded-[12px] border border-[#e4eaf4] bg-[#fbfdff] px-4 py-5 text-center">
          <p className="text-[34px] font-semibold text-[#1f62e8]">
            {(period === "7d" ? stats?.quotaUsed7d : stats?.quotaUsed30d) ?? 0}
          </p>
          <p className="mt-1 text-[13px] text-[#7c879f]">{t("quota_units")}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardClient({ user: initialUser, quota, token }: DashboardClientProps) {
  const t = useT("dashboard");
  const [user, setUser] = useState(initialUser);
  const [generating, setGenerating] = useState(false);
  const [activeToken, setActiveToken] = useState<{ id: string; createdAt: string | null; value: string } | null>(token);
  const [tokenValue, setTokenValue] = useState<string | null>(() => (token ? token.value : null));
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
  const displayName = user.name || user.phone || user.email?.split("@")[0] || t("display_name_fallback");
  const joinedAt = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="w-full px-9 py-10">
      <div className="mb-8 space-y-2">
        <h1 className="text-[52px] font-semibold leading-tight text-[#111c33]">
          {t("welcome")} <span className="text-[#2d67f7]">{displayName}</span>
        </h1>
        <p className="text-[15px] italic text-[#6d7891]">{t("tagline")}</p>
      </div>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[464px_minmax(0,1fr)]">
        <div className="flex flex-col gap-7">
          <section className="rounded-[18px] border border-[#dfe5ef] bg-white p-8 shadow-[0_10px_28px_rgba(20,31,54,0.04)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-[#fff0e8]">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.id}&backgroundColor=ff7a45,f25f2c,f6b36a`}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#7c879f]">{t("user_name")}</p>
                <p className="mt-1 truncate text-[18px] font-semibold text-[#15213b]">{user.name || t("anonymous")}</p>
                <p className="mt-1 text-[13px] text-[#7c879f]">{user.phone || user.email || "—"}</p>
              </div>
              <button
                onClick={() => setProfileModalOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[7px] border border-[#9ebcf5] bg-white px-5 text-[14px] font-medium text-[#2d67f7] transition-colors hover:bg-[#f7faff]"
              >
                <PencilIcon className="h-4 w-4" />
                {t("edit")}
              </button>
            </div>

            <div className="my-7 border-t border-[#e6ebf2]" />

            <div>
              <p className="text-[13px] font-medium text-[#7c879f]">{t("registered_at")}</p>
              <p className="mt-3 text-[17px] text-[#15213b]">{joinedAt}</p>
            </div>
          </section>

          <section className="rounded-[18px] border border-[#dfe5ef] bg-white p-8 shadow-[0_10px_28px_rgba(20,31,54,0.04)]">
            <h2 className="text-[24px] font-semibold text-[#111c33]">{t("token_mgmt")}</h2>
            {activeToken ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-[13px] bg-[#121d35] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <code className="min-w-0 truncate text-[13px] text-[#dbe5f7]">
                      {tokenValue
                        ? `export CLAWPLAY_TOKEN=${tokenValue.length > 20 ? `${tokenValue.slice(0, 8)}...` : tokenValue}`
                        : t("current_token")}
                    </code>
                    <button
                      onClick={copyToken}
                      className="inline-flex h-10 items-center justify-center rounded-[7px] border border-[#2d67f7] bg-[#1b315a] px-5 text-[13px] font-medium text-white transition-colors hover:bg-[#254577]"
                    >
                      {copied ? t("copied") : t("copy_token")}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-[#7c879f]">
                    {t("generated_at")}{" "}
                    {activeToken.createdAt ? formatRelativeTime(new Date(activeToken.createdAt), t) : "—"}
                  </span>
                  <button
                    onClick={revokeToken}
                    disabled={revoking}
                    className="text-[12px] font-medium text-red-500 transition-colors hover:underline disabled:opacity-50"
                  >
                    {revoking ? t("revoking") : t("revoke")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <button
                  onClick={generateToken}
                  disabled={generating}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#2d67f7] text-[14px] font-medium text-white shadow-[0_12px_24px_rgba(45,103,247,0.18)] transition-colors hover:bg-[#2457d4] disabled:opacity-60"
                >
                  {generating ? "⏳" : "✨"} {generating ? t("generating") : t("generate_token")}
                </button>
                <p className="mt-3 text-center text-[12px] text-[#7c879f]">{t("token_valid_30d")}</p>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-7">
          <section className="rounded-[18px] border border-[#dfe5ef] bg-white p-8 shadow-[0_10px_28px_rgba(20,31,54,0.04)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[24px] font-semibold text-[#111c33]">{t("free_quota")}</h2>
                <p className="mt-1 text-[14px] text-[#7c879f]">{t("monthly_usage")}</p>
              </div>
              <div className="text-right">
                <span className="text-[38px] font-semibold text-[#1f62e8]">
                  {quota.used}
                </span>
                <span className="text-[14px] text-[#7c879f]"> / {quota.limit}</span>
              </div>
            </div>

            <div className="mt-7 h-5 overflow-hidden rounded-full bg-[#eef2f7]">
              <div
                className="h-full rounded-full bg-[#2d67f7]"
                style={{ width: `${quotaPct}%` }}
              />
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-[12px] border border-[#d5e2f7] bg-[#f8fbff] p-5 text-[14px] text-[#5f6c86]">
              <span className="mt-0.5 shrink-0 text-[#2d67f7]">
                <NewSparkleIcon className="h-4 w-4" />
              </span>
              <span>
                {t("quota_status")} <strong className="text-[#2d67f7]">{t("status_good")}</strong>，
                {t("quota_remaining", { n: quota.remaining })}，{t("reset_in")}
              </span>
            </div>
          </section>

          <UsageStatsCard />

        </div>

        <section className="rounded-[18px] border border-[#dfe5ef] bg-white p-8 shadow-[0_10px_28px_rgba(20,31,54,0.04)] lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[24px] font-semibold text-[#111c33]">{t("my_skills")}</h2>
          </div>
          <div className="mt-7">
            <MySkillsClient />
          </div>
        </section>
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
