"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

type Tab = "account" | "phone" | "wechat";

export function LoginForm() {
  const router = useRouter();
  const t = useT("auth");
  const [tab, setTab] = useState<Tab>("account");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Account tab
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phone tab
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCountdown() {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function handleAccountLogin(e: React.FormEvent) {
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
      if (!res.ok) { setError(data.error ?? t("login_failed")); return; }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("network_error"));
    } finally {
      setLoading(false);
    }
  }

  async function sendCode() {
    setError("");
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError(t("invalid_phone"));
      return;
    }
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("send_failed")); return; }
      startCountdown();
    } catch {
      setError(t("network_error"));
    }
  }

  async function handlePhoneLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("register_failed")); return; }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("network_error"));
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "account", label: t("account") },
    { key: "phone", label: t("phone") },
    { key: "wechat", label: t("wechat") },
  ];

  return (
    <div className="space-y-6">
      {/* Mobile logo */}
      <div className="md:hidden flex items-center gap-2 justify-center mb-2">
        <span className="text-3xl">🦐</span>
        <span className="text-2xl font-bold font-heading text-[#564337]">ClawPlay</span>
      </div>

      <div className="bg-[#fffdf7] card-radius p-8 md:p-10 border border-[#e8dfc8] card-shadow space-y-6 w-full max-w-sm md:w-96 md:max-w-none">
        <div className="text-center space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-[#564337]">{t("login")}</h1>
          <p className="text-[#7a6a5a] text-sm font-body">{t("login_subtitle")}</p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-[20px] bg-[#faf3d0] p-1 gap-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(""); }}
              className={`flex-1 text-sm font-semibold py-2 rounded-[16px] transition-colors font-body ${
                tab === key
                  ? "bg-[#fffdf7] text-[#564337] shadow-sm"
                  : "text-[#7a6a5a] hover:text-[#564337]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-[24px] px-5 py-3.5 text-sm font-body">
            {error}
          </div>
        )}

        {tab === "account" && (
          <form onSubmit={handleAccountLogin} className="w-full space-y-4">
            <Input
              label={t("email")}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              required
              autoComplete="email"
              className="w-full"
              p="px-4 py-2.5"
            />
            <Input
              label={t("password")}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              required
              autoComplete="current-password"
              p="px-4 py-2.5"
            />
            <Button type="submit" className="w-full" loading={loading}>
              {t("login_btn")}
            </Button>
          </form>
        )}

        {tab === "phone" && (
          <form onSubmit={handlePhoneLogin} className="w-full space-y-4">
            <Input
              label={t("phone")}
              type="tel"
              placeholder="138 0000 0000"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setError(""); }}
              required
              autoComplete="tel"
              p="px-4 py-2.5"
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[#564337] mb-1.5 font-body">
                {t("verification_code")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={t("code_placeholder")}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="flex-1 h-[46px] border border-[#e0d4bc] rounded-[20px] px-4 text-sm text-[#564337] bg-white placeholder-[#a89888] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30 transition-colors font-body"
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={countdown > 0}
                  className="shrink-0 h-[46px] w-[104px] px-4 rounded-[20px] text-sm font-semibold border border-[#e0d4bc] text-[#a23f00] bg-[#faf3d0] hover:bg-[#f5ecb8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-body"
                >
                  {countdown > 0 ? `${countdown}s` : t("get_code")}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              {t("login_register_btn")}
            </Button>
          </form>
        )}

        {tab === "wechat" && (
          <div className="space-y-4">
            <a
              href="/api/auth/wechat?redirect=/dashboard"
              className="flex items-center justify-center gap-3 w-full py-3 rounded-[24px] bg-[#07c160] hover:bg-[#06ad56] text-white font-semibold text-sm transition-colors font-body"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-3.825-6.348-7.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-3.74 2.704c.532 0 .963.441.963.983a.963.963 0 0 1-.963.983.963.963 0 0 1-.963-.983c0-.542.43-.983.963-.983zm4.848 0c.533 0 .963.441.963.983a.963.963 0 0 1-.963.983.963.963 0 0 1-.963-.983c0-.542.43-.983.963-.983z"/>
              </svg>
              {t("wechat_login")}
            </a>
            <p className="text-xs text-center text-[#7a6a5a] font-body">
              {t("wechat_login_desc")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
