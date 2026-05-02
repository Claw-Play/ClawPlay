"use client";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SiteTopNav } from "@/components/SiteTopNav";
import type { UserAvatarMenuItem } from "@/components/UserAvatarMenu";
import {
  BookmarkIcon,
  ChevronRightIcon,
  GridIcon,
  MenuIcon,
  NewSparkleIcon,
  ShrimpLogoIcon,
  SettingsIcon,
  TrendingIcon,
} from "@/components/icons";
import UserAvatarMenu from "@/components/UserAvatarMenu";

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
  const t = useT("nav");
  const tCommon = useT("common");
  const isSkillsRoute = pathname.startsWith("/skills");
  const hideSidebarNav = /^\/skills\/[^/]+\/versions\/new\/?$/.test(pathname);
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
    setMobileNavOpen(false);
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
  const avatarMenuItems: UserAvatarMenuItem[] = user
    ? [
        { href: "/dashboard", label: tCommon("dashboard"), kind: "dashboard" } as UserAvatarMenuItem,
        { href: "/submit", label: tCommon("submit"), kind: "submit" } as UserAvatarMenuItem,
        ...(user.role === "admin"
          ? ([{ href: "/admin", label: tCommon("admin_panel"), kind: "admin", tone: "accent" }] as UserAvatarMenuItem[])
          : []),
        ...(user.role === "reviewer"
          ? ([{ href: "/admin/review", label: tCommon("pending_reviews"), kind: "review", tone: "accent" }] as UserAvatarMenuItem[])
          : []),
      ]
    : [];

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

  return (
    <div className="min-h-screen bg-[#fbfdff] text-[#1f2b45]">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <SiteTopNav
        containerClassName="mx-auto max-w-none px-4 sm:px-6 lg:px-8"
        centerItems={navTop.map(({ label, href }) => ({
          label,
          href,
          active:
            href === "/"
              ? pathname === "/"
              : href === "/skills"
                ? pathname.startsWith("/skills")
                : pathname.startsWith("/community"),
        }))}
        leftSlot={
          <>
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe5f7] bg-white text-[#2d67f7] shadow-[0_8px_18px_rgba(25,43,87,0.04)] transition-colors hover:bg-[#f7faff] md:hidden ${
                hideSidebarNav ? "hidden" : ""
              }`}
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center" aria-hidden="true">
                <MenuIcon className="w-5 h-5" />
              </span>
            </button>
            <Link href="/" className="flex items-center gap-3">
              <ShrimpLogoIcon className="h-14 w-14" />
              <span className="text-[22px] font-bold tracking-tight text-[#1f2b45]">
                ClawPlay
              </span>
            </Link>
          </>
        }
        rightSlot={
          <>
            <LanguageSwitcher variant="home" />
            <div className="hidden h-6 w-px bg-[#dbe5f7] md:block" />
            <UserAvatarMenu
              user={user}
              loading={loading}
              loginHref="/login"
              loginLabel={tCommon("login")}
              buttonTitle={tCommon("dashboard")}
              accountSettingsLabel={t("account_settings")}
              anonymousLabel={tCommon("anonymous")}
              logoutLabel={t("logout")}
              onBeforeLogout={() => {
                localStorage.removeItem("clawplay_draft_form");
                localStorage.removeItem("clawplay_draft_mermaid");
              }}
              items={avatarMenuItems}
            />
          </>
        }
      />

      {!hideSidebarNav && (
        <aside
          ref={mobileNavRef}
          className={`fixed inset-y-0 left-0 z-50 w-[180px] max-w-[72vw] bg-white px-3 py-3 shadow-[8px_0_28px_rgba(25,43,87,0.08)] transition-transform duration-200 md:hidden ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-[#dbe5f7] px-1 pb-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#edf4ff] text-[#2d67f7]">
              <ShrimpLogoIcon className="w-7 h-7" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#2d67f7]">{tCommon("dashboard")}</p>
              <p className="text-xs text-[#7c879f]">{t("skill_lib")}</p>
            </div>
          </div>
          <div className="space-y-1.5 pt-3">
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
                      ? "bg-[#edf4ff] text-[#2d67f7] shadow-[inset_0_0_0_1px_rgba(45,103,247,0.12)]"
                      : "text-[#5f6c86] hover:bg-[#f7faff]"
                  }`}
                >
                  <span>{label}</span>
                  <ChevronRightIcon className="h-3 w-3 opacity-60" />
                </Link>
              );
            })}
          </div>

          {isSkillsRoute && (
            <div className="mt-4 border-t border-[#dbe5f7] pt-3.5">
              <p className="px-1 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8aa0cb] font-body">
                {t("skill_lib")}
              </p>
              <div className="space-y-1.5">
                {sidebarItems.map(({ label, href, active }) => (
                  <Link
                    key={label}
                    href={href}
                    className={`flex items-center justify-between rounded-full px-2.5 py-2 text-[12px] font-medium font-body transition-colors ${
                      active
                        ? "bg-[#2d67f7] text-white"
                        : "text-[#5f6c86] hover:bg-[#f7faff]"
                    }`}
                  >
                    <span>{label}</span>
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>
                ))}
              </div>
              <Link
                href="/submit"
                className="mt-3 block w-full rounded-full bg-[#2d67f7] px-2.5 py-2 text-center text-[12px] font-semibold text-white transition-colors hover:bg-[#2457d4]"
              >
                {t("join_workshop")}
              </Link>
            </div>
          )}
        </aside>
      )}

      <div className="flex">
        {isSkillsRoute && !hideSidebarNav && (
              <aside className="hidden w-60 shrink-0 sticky top-[71px] h-[calc(100vh-71px)] overflow-y-auto md:block">
            <div className="bg-white border-r border-[#dbe5f7] p-4 flex flex-col gap-1 min-h-full">
              <div className="px-2.5 pb-4 border-b border-[#dbe5f7]">
                <p className="text-[15px] font-semibold text-[#15213b]">{t("skill_lib")}</p>
                <p className="text-xs text-[#7c879f] font-body mt-0.5">
                  {t("discover_ai_play")}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-1">
                {sidebarItems.map(({ label, href, icon, active }) => (
                  <Link
                    key={label}
                    href={href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-[6px] text-[13px] font-medium font-body transition-colors ${
                      active
                        ? "bg-[#edf4ff] text-[#2d67f7] shadow-[inset_0_0_0_1px_rgba(45,103,247,0.12)]"
                        : "text-[#5f6c86] hover:bg-[#f7faff]"
                    }`}
                  >
                    <NavIcon name={icon} />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-8 pt-3 border-t border-[#dbe5f7]">
                <Link
                  href="/submit"
                  className="block w-full text-center py-2.5 rounded-[6px] border border-[#cfdcf3] bg-white text-[#2d67f7] text-[13px] font-semibold hover:bg-[#f7faff] transition-colors"
                >
                  {t("join_workshop")}
                </Link>
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0 overflow-x-clip">
          {children}
        </main>
      </div>
    </div>
  );
}
