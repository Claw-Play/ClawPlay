"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/context";

type Tab = "account" | "more";

function getSafeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  return value;
}

function SocialButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      className="flex h-12 items-center justify-center gap-3 rounded-[20px] border border-[#d9e2f7] bg-white text-[14px] font-medium text-[#394766] shadow-[0_8px_20px_rgba(25,43,87,0.04)] transition-transform hover:-translate-y-0.5 hover:border-[#b7c9f5] hover:bg-[#f7faff]"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT("auth");
  const [tab, setTab] = useState<Tab>("account");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectTo = getSafeRedirectPath(searchParams.get("from"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleAccountLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("login_failed"));
        return;
      }
      const target = data.hasToken && redirectTo === "/dashboard" ? "/skills" : redirectTo;
      router.push(target);
      router.refresh();
    } catch {
      setError(t("network_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative w-full max-w-[360px]">
      <div className="rounded-[24px] border border-transparent bg-white/85 px-4 py-7 shadow-[0_34px_96px_rgba(25,43,87,0.18)] sm:px-5 sm:py-8">
        <div className="mb-5 text-center">
          <h1 className="text-[clamp(1.5rem,2.4vw,1.85rem)] font-semibold tracking-[-0.04em] text-[#15213b]">
            {t("welcome_back")}
          </h1>
        </div>

        <div className="rounded-[18px] border border-[#d9e2f7] bg-transparent p-1">
          <div className="grid grid-cols-2 gap-1">
            {[
              { key: "account" as const, label: t("account") },
              { key: "more" as const, label: t("more") },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key);
                  setError("");
                }}
                className={[
                  "rounded-[14px] py-2.5 text-[14px] font-semibold transition-all",
                  tab === item.key
                    ? "bg-[#e8efff] text-[#2d67f7]"
                    : "bg-white text-[#98a3bc] shadow-[0_2px_8px_rgba(25,43,87,0.03)]",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-[20px] border border-[#ffd1d1] bg-[#fff5f5] px-4 py-3 text-sm text-[#c53a3a]">
            {error}
          </div>
        )}

        {tab === "account" ? (
          <form onSubmit={handleAccountLogin} className="mt-5 space-y-3.5">
            <div className="space-y-2">
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                type="email"
                placeholder={t("email_placeholder")}
                autoComplete="email"
                className="h-12 w-full rounded-[18px] border border-[#d9e2f7] bg-white px-3.5 text-[13px] text-[#15213b] placeholder:text-[#98a3bc] outline-none transition focus:border-[#2d67f7] focus:ring-2 focus:ring-[#2d67f7]/15"
              />
            </div>

            <div className="space-y-2">
              <input
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                type="password"
                placeholder={t("password_placeholder")}
                autoComplete="current-password"
                className="h-12 w-full rounded-[18px] border border-[#d9e2f7] bg-white px-3.5 text-[13px] text-[#15213b] placeholder:text-[#98a3bc] outline-none transition focus:border-[#2d67f7] focus:ring-2 focus:ring-[#2d67f7]/15"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-[18px] bg-gradient-to-r from-[#2d67f7] to-[#4f82f7] text-[14px] font-semibold text-white shadow-[0_12px_24px_rgba(45,103,247,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(45,103,247,0.3)] disabled:translate-y-0 disabled:opacity-60"
            >
              {loading ? t("loading") : t("login_btn")}
            </button>

            <p className="pt-1 text-center text-[13px] text-[#6d7891]">
              {t("login_hint")}
            </p>
          </form>
        ) : (
          <div className="mt-8">
            <p className="mb-[29px] text-center text-[14px] font-medium text-[#394766]">
              {t("other_login_methods")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SocialButton
                href={`/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`}
                label="Google"
                icon={
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                }
              />
              <SocialButton
                href={`/api/auth/github?redirect=${encodeURIComponent(redirectTo)}`}
                label="GitHub"
                icon={
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path fill="currentColor" d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                }
              />
              <SocialButton
                href={`/api/auth/x?redirect=${encodeURIComponent(redirectTo)}`}
                label="X (Twitter)"
                icon={
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                }
              />
              <SocialButton
                href={`/api/auth/discord?redirect=${encodeURIComponent(redirectTo)}`}
                label="Discord"
                icon={
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path fill="#5865F2" d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.057a19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
                  </svg>
                }
              />
            </div>

            <p className="pt-5 text-center text-[13px] text-[#6d7891]">
              {t("login_hint")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
