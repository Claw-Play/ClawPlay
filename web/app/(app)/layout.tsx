"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

function NavIcon({ name }: { name: string }) {
  if (name === "grid") return <span className="inline-block w-4 text-center text-base">⊞</span>;
  if (name === "trending") return <span className="inline-block w-4 text-center text-base">↗</span>;
  if (name === "new") return <span className="inline-block w-4 text-center text-base">✦</span>;
  if (name === "bookmark") return <span className="inline-block w-4 text-center text-base">▦</span>;
  if (name === "settings") return <span className="inline-block w-4 text-center text-base">⚙</span>;
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const isSkillsRoute = pathname.startsWith("/skills");
  const [user, setUser] = useState<{ name?: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setUser(data.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const navTop = [
    { label: t("home"), href: "/" },
    { label: t("skill_lib"), href: "/skills" },
    { label: t("community"), href: "/community" },
  ];

  const sidebarItems = [
    { label: t("all_skills"), href: "/skills", icon: "grid" as const },
    { label: t("trending"), href: "/skills?sort=trending", icon: "trending" as const },
    { label: t("new"), href: "/skills?sort=new", icon: "new" as const },
    { label: t("favorites"), href: "/dashboard", icon: "bookmark" as const },
    { label: t("settings"), href: "/dashboard", icon: "settings" as const },
  ].map((item) => ({
    ...item,
    active:
      item.href === "/skills"
        ? pathname === "/skills" || pathname.startsWith("/skills")
        : false,
  }));

  const avatarInitial = user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-[#fefae0]">
      <header className="bg-[#fefae0] border-b border-[#e8dfc8] sticky top-0 z-50">
        <div className="max-w-[1536px] mx-auto px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🦐</span>
            <span className="text-xl font-bold font-heading text-[#a23f00] group-hover:text-[#c45000] transition-colors">
              ClawPlay
            </span>
          </Link>

          <nav className="flex items-center gap-8">
            {navTop.map(({ label, href }) => {
              const active =
                label === t("skill_lib")
                  ? pathname.startsWith("/skills")
                  : pathname === href;
              return (
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
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="w-10 h-10 rounded-full bg-[#faf3d0] border-2 border-[#e8dfc8] flex items-center justify-center text-sm font-bold font-heading text-[#586330] hover:border-[#a23f00] transition-all cursor-pointer"
                title={tCommon("dashboard")}
              >
                {avatarInitial}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(86,67,55,0.12)] border border-[#e8dfc8] overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[#ede9cf]">
                    <p className="text-sm font-semibold text-[#1d1c0d] font-body truncate">
                      {user?.name || tCommon("anonymous")}
                    </p>
                    <p className="text-xs text-[#7a6a5a] font-body mt-0.5">{t("account_settings")}</p>
                  </div>
                  <div className="py-2">
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#564337] hover:bg-[#faf3d0] font-body transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="text-base">⚙</span> {tCommon("dashboard")}
                    </Link>
                    <Link
                      href="/submit"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#564337] hover:bg-[#faf3d0] font-body transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="text-base">✦</span> {tCommon("submit")}
                    </Link>
                  </div>
                  <div className="border-t border-[#ede9cf] py-2">
                    <button
                      onClick={async () => {
                        setDropdownOpen(false);
                        await fetch("/api/auth/logout", { method: "POST" });
                        router.push("/");
                        router.refresh();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 font-body transition-colors text-left"
                    >
                      <span className="text-base">⊘</span> {t("logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {isSkillsRoute && (
          <aside className="w-[256px] shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto">
            <div className="bg-[#fefae0] p-4 flex flex-col gap-1">
              <div className="px-3 pb-4 border-b border-[#e8dfc8]">
                <p className="text-base font-bold text-[#a23f00] font-heading">{t("skill_lib")}</p>
                <p className="text-xs text-[#564337] opacity-60 font-body mt-0.5">
                  {t("discover_ai_behaviors")}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-1">
                {sidebarItems.map(({ label, href, icon, active }) => (
                  <Link
                    key={label}
                    href={href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium font-body transition-colors ${
                      active
                        ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white"
                        : "text-[#586330] hover:bg-[#ede9cf]"
                    }`}
                  >
                    <NavIcon name={icon} />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-auto pt-4 border-t border-[#e8dfc8]">
                <Link
                  href="/submit"
                  className="block w-full text-center py-3 rounded-full bg-[#d8e6a6] text-[#5c6834] text-sm font-bold font-heading hover:bg-[#c8d896] transition-colors"
                >
                  {t("join_workshop")}
                </Link>
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
