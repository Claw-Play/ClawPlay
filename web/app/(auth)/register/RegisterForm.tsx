"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

type Tab = "phone" | "wechat";

export function RegisterForm() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [tab, setTab] = useState<Tab>("phone");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Phone tab
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneName, setPhoneName] = useState("");
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

  async function handlePhoneRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, name: phoneName }),
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
    { key: "phone", label: t("phone") },
    { key: "wechat", label: t("wechat") },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fefae0] via-[#faf3d0] to-[#f5ecb8] flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🦐</span>
          <span className="text-xl font-bold font-heading text-[#564337] group-hover:text-[#a23f00] transition-colors">
            ClawPlay
          </span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col md:flex-row">
        {/* Left branding — hidden on mobile */}
        <div className="hidden md:flex flex-col justify-center items-center flex-1 p-12">
          <div className="max-w-md text-center space-y-6">
            <div className="text-6xl mb-4">🦐</div>
            <h2 className="text-4xl font-extrabold font-heading text-[#564337] leading-tight">
              {t("join_community")}
            </h2>
            <p className="text-lg text-[#7a6a5a] font-body leading-relaxed">
              {t("join_desc")}
            </p>
            <div className="pt-4 space-y-3">
              <div className="inline-flex items-center gap-2 bg-white/80 rounded-full px-5 py-2.5 text-sm text-[#7a6a5a] border border-[#e8dfc8] font-body">
                <span>🖼️</span>
                <span>{t("feature_image")}</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/80 rounded-full px-5 py-2.5 text-sm text-[#7a6a5a] border border-[#e8dfc8] font-body">
                <span>🎙️</span>
                <span>{t("feature_tts")}</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/80 rounded-full px-5 py-2.5 text-sm text-[#7a6a5a] border border-[#e8dfc8] font-body">
                <span>🛡️</span>
                <span>{t("feature_secure")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right form — full width on mobile */}
        <div className="flex flex-col justify-center items-center flex-1 px-4 py-8">
          <div className="w-full max-w-sm">

            <div className="bg-[#fffdf7] rounded-3xl p-6 border border-[#e8dfc8] shadow-lg space-y-5">
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold font-heading text-[#564337]">{t("create_account")}</h1>
                <p className="text-[#7a6a5a] text-sm font-body">{t("register_subtitle")}</p>
              </div>

              {/* Tab switcher */}
              <div className="flex rounded-2xl bg-[#faf3d0] p-1 gap-1">
                {tabs.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setTab(key); setError(""); }}
                    className={`flex-1 text-sm font-semibold py-2 rounded-xl transition-colors font-body ${
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
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-3.5 text-sm font-body">
                  {error}
                </div>
              )}

              {tab === "phone" && (
                <form onSubmit={handlePhoneRegister} className="space-y-3">
                  <Input
                    label={t("nickname")}
                    type="text"
                    placeholder={t("nickname_placeholder")}
                    value={phoneName}
                    onChange={(e) => setPhoneName(e.target.value)}
                    autoComplete="name"
                  />
                  <Input
                    label={t("phone")}
                    type="tel"
                    placeholder="138 0000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    required
                    autoComplete="tel"
                  />
                  <div>
                    <label className="block text-sm font-semibold text-[#564337] mb-1.5 font-body">
                      {t("verification_code")}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder={t("code_placeholder")}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        className="flex-1 border border-[#e0d4bc] rounded-full px-4 py-3 text-sm text-[#564337] bg-white focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30 font-body"
                      />
                      <button
                        type="button"
                        onClick={sendCode}
                        disabled={countdown > 0}
                        className="shrink-0 px-4 py-3 rounded-full text-sm font-semibold border border-[#e0d4bc] text-[#a23f00] bg-[#faf3d0] hover:bg-[#f5ecb8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-body"
                      >
                        {countdown > 0 ? `${countdown}s` : t("get_code")}
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#faf3d0] border border-[#e8dfc8] rounded-2xl px-4 py-2.5 text-sm text-[#7a6a5a] font-body">
                    <span className="text-[#fa7025] mr-1">✨</span>
                    {t("free_quota")}
                  </div>
                  <Button type="submit" className="w-full" loading={loading}>
                    {t("register_btn")}
                  </Button>
                </form>
              )}

              {tab === "wechat" && (
                <div className="space-y-4">
                  <a
                    href="/api/auth/wechat?redirect=/dashboard"
                    className="flex items-center justify-center gap-3 w-full py-3 rounded-full bg-[#07c160] hover:bg-[#06ad56] text-white font-semibold text-sm transition-colors font-body"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-3.825-6.348-7.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-3.74 2.704c.532 0 .963.441.963.983a.963.963 0 0 1-.963.983.963.963 0 0 1-.963-.983c0-.542.43-.983.963-.983zm4.848 0c.533 0 .963.441.963.983a.963.963 0 0 1-.963.983.963.963 0 0 1-.963-.983c0-.542.43-.983.963-.983z"/>
                    </svg>
                    {t("wechat_register")}
                  </a>
                  <p className="text-xs text-center text-[#7a6a5a] font-body">
                    {t("wechat_register_desc")}
                  </p>
                </div>
              )}

              <p className="text-center text-sm text-[#7a6a5a] font-body">
                {t("has_account")}{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[#a23f00] hover:text-[#c45000] underline transition-colors"
                >
                  {t("go_login")}
                </Link>
              </p>
            </div>

            <p className="text-center text-xs text-[#7a6a5a] mt-6 font-body">
              {t("agree_terms")}{" "}
              <Link href="/terms" className="underline hover:text-[#a23f00]">{t("terms")}</Link>
              {" "}和{" "}
              <Link href="/privacy" className="underline hover:text-[#a23f00]">{t("privacy")}</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
