"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  AdminShieldIcon,
  BookmarkIcon,
  ChevronRightIcon,
  DashboardIcon,
  GridIcon,
  MenuIcon,
  NewSparkleIcon,
  ReviewIcon,
  ShrimpLogoIcon,
  SettingsIcon,
  SubmitIcon,
  TrendingIcon,
} from "@/components/icons";

function NavIcon({ name }: { name: string }) {
  if (name === "grid") return <GridIcon className="w-4 h-4 shrink-0" />;
  if (name === "trending") return <TrendingIcon className="w-4 h-4 shrink-0" />;
  if (name === "new") return <NewSparkleIcon className="w-4 h-4 shrink-0" />;
  if (name === "bookmark") return <BookmarkIcon className="w-4 h-4 shrink-0" />;
  if (name === "settings") return <SettingsIcon className="w-4 h-4 shrink-0" />;
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useT("nav");
  const tCommon = useT("common");
  const isSkillsRoute = pathname.startsWith("/skills");
  const currentSort = searchParams.get("sort") ?? "";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<{
    id?: number;
    name?: string;
    role?: string;
    avatarColor?: string;
    avatarInitials?: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const userCache = useRef<{ user: typeof user; loaded: boolean }>({ user: null, loaded: false });

  // Fetch user on mount (only once due to cache)
  const fetchRef = useRef(false);
  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    if (userCache.current.loaded) {
      setUser(userCache.current.user);
      setLoading(false);
      return;
    }
    fetch("/api/user/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          userCache.current = { user: data.user, loaded: true };
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Re-fetch user when page becomes visible again (e.g. after OAuth redirect)
  useEffect(() => {
    function onVisible() {
      if (!document.hidden) {
        fetch("/api/user/me")
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            if (data) {
              userCache.current = { user: data.user, loaded: true };
              setUser(data.user);
            }
          })
          .catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Listen for profile updates from DashboardClient
  useEffect(() => {
    function onProfileUpdate(e: Event) {
      const detail = (e as CustomEvent).detail;
      userCache.current = { user: detail, loaded: true };
      setUser(detail);
    }
    window.addEventListener("clawplay:profile-updated", onProfileUpdate);
    return () => window.removeEventListener("clawplay:profile-updated", onProfileUpdate);
  }, []);

  // Listen for logout to clear cached user
  useEffect(() => {
    function onLogout() {
      userCache.current = { user: null, loaded: true };
      setUser(null);
    }
    window.addEventListener("clawplay:logout", onLogout);
    return () => window.removeEventListener("clawplay:logout", onLogout);
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

  useEffect(() => {
    setMobileNavOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node)) {
        setMobileNavOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileNavOpen]);

  const navTop = [
    { label: t("home"), href: "/" },
    { label: t("skill_lib"), href: "/skills" },
    { label: t("community"), href: "/community" },
  ];

  const sidebarItems = [
    { label: t("all_skills"), href: "/skills", icon: "grid" as const, sortKey: "" },
    { label: t("trending"), href: "/skills?sort=trending", icon: "trending" as const, sortKey: "trending" },
    { label: t("new"), href: "/skills?sort=new", icon: "new" as const, sortKey: "new" },
    { label: t("favorites"), href: "/dashboard", icon: "bookmark" as const, sortKey: "" },
  ].map((item) => ({
    ...item,
    active:
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : isSkillsRoute && item.sortKey === currentSort,
  }));

  const avatarUrl = user?.avatarUrl
    ? user.avatarUrl
    : user
    ? `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.id}&backgroundColor=ff6b35,fa7025,a23f00`
    : null;

  return (
    <div className="min-h-screen bg-[#fefae0] overflow-x-hidden">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <header className="bg-[#fefae0] border-b border-[#e8dfc8] sticky top-0 z-50 shadow-[0px_8px_24px_0px_rgba(86,67,55,0.06)]">
        <div className="max-w-[1536px] mx-auto px-4 py-3 flex items-center justify-between gap-3 md:px-8 md:py-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e8dfc8] bg-white text-[#564337] shadow-[0_4px_12px_rgba(86,67,55,0.06)] transition-colors hover:bg-[#faf3d0] md:hidden"
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center" aria-hidden="true">
                <MenuIcon className="w-5 h-5" />
              </span>
            </button>
            <Link href="/" className="flex items-center gap-2 group min-w-0">
              <ShrimpLogoIcon className="w-6 h-6 md:w-[26px] md:h-[26px] text-[#a23f00]" />
              <span className="truncate text-lg md:text-xl font-bold font-heading text-[#a23f00] group-hover:text-[#c45000] transition-colors">
                ClawPlay
              </span>
            </Link>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
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

          <div className="flex items-center gap-2 md:gap-3">
            {/* Language switcher */}
            <LanguageSwitcher />
            <div className="hidden h-6 w-px bg-[#e8dfc8] md:block" />

            {/* Loading skeleton */}
            {loading && (
              <div className="w-10 h-10 rounded-full bg-[#e8dfc8] animate-pulse" />
            )}
            {!loading && user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#e8dfc8] flex items-center justify-center hover:border-[#a23f00] transition-all cursor-pointer"
                title={tCommon("dashboard")}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : null}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(86,67,55,0.12)] border border-[#e8dfc8] overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[#ede9cf]">
                    <p className="text-sm font-semibold text-[#1d1c0d] font-body truncate">
                      {user ? (user.name || tCommon("anonymous")) : ""}
                    </p>
                    <p className="text-xs text-[#7a6a5a] font-body mt-0.5">{t("account_settings")}</p>
                  </div>
                  <div className="py-2">
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#564337] hover:bg-[#faf3d0] font-body transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <DashboardIcon className="w-4 h-4" /> {tCommon("dashboard")}
                    </Link>
                    <Link
                      href="/submit"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#564337] hover:bg-[#faf3d0] font-body transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <SubmitIcon className="w-4 h-4" /> {tCommon("submit")}
                    </Link>
                    {(user && user.role === "admin") && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#a23f00] hover:bg-[#faf3d0] font-body transition-colors font-semibold"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <AdminShieldIcon className="w-4 h-4" /> {tCommon("admin_panel")}
                      </Link>
                    )}
                    {(user && user.role === "reviewer") && (
                      <Link
                        href="/admin/review"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#a23f00] hover:bg-[#faf3d0] font-body transition-colors font-semibold"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <ReviewIcon className="w-4 h-4" /> {tCommon("pending_reviews")}
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-[#ede9cf] py-2">
                    <button
                      onClick={async () => {
                        setDropdownOpen(false);
                        localStorage.removeItem('clawplay_draft_form');
                        localStorage.removeItem('clawplay_draft_mermaid');
                        window.dispatchEvent(new Event("clawplay:logout"));
                        await fetch("/api/auth/logout", { method: "POST" });
                        router.push("/login");
                        router.refresh();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 font-body transition-colors text-left"
                    >
                      <SubmitIcon className="w-4 h-4 rotate-180" /> {t("logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </header>

      <aside
        ref={mobileNavRef}
        className={`fixed inset-y-0 left-0 z-50 w-[160px] max-w-[58vw] bg-[#f8f4db] px-2 py-3 shadow-[8px_0px_24px_0px_rgba(86,67,55,0.08)] transition-transform duration-200 md:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-1.5 px-1 pb-4 border-b border-[#e8dfc8]">
            <ShrimpLogoIcon className="w-5 h-5 text-[#a23f00]" />
          <div>
            <p className="text-sm font-bold font-heading text-[#a23f00]">{tCommon("dashboard")}</p>
            <p className="text-xs text-[#7a6a5a] font-body">{t("skill_lib")}</p>
          </div>
        </div>
        <div className="pt-3 space-y-1.5">
          {navTop.map(({ label, href }) => {
            const active =
              label === t("skill_lib")
                ? pathname.startsWith("/skills")
                : pathname === href;
            return (
              <Link
                key={label}
                href={href}
                className={`flex items-center justify-between rounded-full px-2.5 py-2 text-[12px] font-semibold font-body transition-colors ${
                  active
                    ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white"
                    : "text-[#586330] hover:bg-[#ede9cf]"
                }`}
              >
                <span>{label}</span>
                <ChevronRightIcon className="w-3 h-3" />
              </Link>
            );
          })}
        </div>

        {isSkillsRoute && (
          <div className="mt-4 border-t border-[#e8dfc8] pt-3.5">
            <p className="px-1 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#897365] font-body">
              {t("skill_lib")}
            </p>
            <div className="space-y-1.5">
              {sidebarItems.map(({ label, href, active }) => (
                <Link
                  key={label}
                  href={href}
                  className={`flex items-center justify-between rounded-full px-2.5 py-2 text-[12px] font-medium font-body transition-colors ${
                    active
                      ? "bg-[#a23f00] text-white"
                      : "text-[#586330] hover:bg-[#ede9cf]"
                  }`}
                >
                  <span>{label}</span>
                  <ChevronRightIcon className="w-3 h-3" />
                </Link>
              ))}
            </div>
            <Link
              href="/submit"
              className="mt-3 block w-full rounded-full bg-[#d8e6a6] px-2.5 py-2 text-center text-[12px] font-bold font-heading text-[#5c6834] transition-colors hover:bg-[#c8d896]"
            >
              {t("join_workshop")}
            </Link>
          </div>
        )}
      </aside>

      <div className="flex">
        {isSkillsRoute && (
          <aside className="hidden w-[256px] shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto md:block">
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
