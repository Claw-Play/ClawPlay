"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { AdminUserContext } from "@/lib/context/AdminUserContext";
import { PendingCountContext } from "@/lib/context/PendingCountContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SiteTopNav } from "@/components/SiteTopNav";
import type { UserAvatarMenuItem } from "@/components/UserAvatarMenu";
import {
  AuditIcon,
  ChevronRightIcon,
  DashboardIcon,
  EventsIcon,
  MenuIcon,
  ProvidersIcon,
  ReviewIcon,
  ShrimpLogoIcon,
  UsersIcon,
} from "@/components/icons";
import UserAvatarMenu from "@/components/UserAvatarMenu";

interface UserInfo {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin" | "reviewer";
  avatarColor?: string;
  avatarInitials?: string;
  avatarUrl?: string | null;
}

const NAV_ITEMS_ADMIN = [
  { href: "/admin", icon: DashboardIcon, labelKey: "dashboard" as const },
  { href: "/admin/review", icon: ReviewIcon, labelKey: "pending_reviews" as const },
  { href: "/admin/events", icon: EventsIcon, labelKey: "events" as const },
  { href: "/admin/users", icon: UsersIcon, labelKey: "users" as const },
  { href: "/admin/audit", icon: AuditIcon, labelKey: "audit_logs" as const },
  { href: "/admin/providers", icon: ProvidersIcon, labelKey: "providers" as const },
];

const NAV_ITEMS_REVIEWER = [
  { href: "/admin/review", icon: ReviewIcon, labelKey: "pending_reviews" as const },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const t = useT("admin");
  const tNav = useT("nav");
  const tCommon = useT("common");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      try {
        const [meRes, skillsRes] = await Promise.all([
          fetch("/api/user/me"),
          fetch("/api/admin/skills/pending-count"),
        ]);
        const [meData, skillsData] = await Promise.all([
          meRes.json(),
          skillsRes.json(),
        ]);
        if (meData.user?.role !== "admin" && meData.user?.role !== "reviewer") {
          window.location.href = "/";
          return;
        }
        setUser(meData.user);

        const count = typeof skillsData.count === "number" ? skillsData.count : 0;
        setPendingCount(count);
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    }
    init();
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

  useEffect(() => {
    function onLogout() {
      setUser(null);
      setLoading(false);
    }
    window.addEventListener("clawplay:logout", onLogout);
    return () => window.removeEventListener("clawplay:logout", onLogout);
  }, []);

  const navItems = user?.role === "reviewer" ? NAV_ITEMS_REVIEWER : NAV_ITEMS_ADMIN;
  const navTop = [
    { label: tNav("home"), href: "/" },
    { label: tNav("skill_lib"), href: "/skills" },
    { label: tNav("community"), href: "/community" },
  ];
  const avatarMenuItems: UserAvatarMenuItem[] = user
    ? [
        { href: "/dashboard", label: tCommon("dashboard"), kind: "dashboard" } as UserAvatarMenuItem,
        { href: "/submit", label: tCommon("submit"), kind: "submit" } as UserAvatarMenuItem,
        ...(user.role === "admin"
          ? ([{ href: "/admin", label: tCommon("admin_panel"), kind: "admin", tone: "accent" }] as UserAvatarMenuItem[])
          : []),
      ]
    : [];

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/admin/events") return pathname.startsWith("/admin/events");
    if (href === "/admin/users") return pathname.startsWith("/admin/users");
    if (href === "/admin/review") return pathname.startsWith("/admin/review");
    if (href === "/admin/audit") return pathname.startsWith("/admin/audit");
    if (href === "/admin/providers") return pathname === "/admin/providers";
    return false;
  }

  function displayCount(n: number): string {
    return n > 99 ? "99+" : String(n);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfdff] flex items-center justify-center px-4">
        <div className="animate-pulse font-medium text-[#6d7891]">{t("loading")}</div>
      </div>
    );
  }

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
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe5f7] bg-white text-[#2d67f7] shadow-[0_8px_18px_rgba(25,43,87,0.04)] transition-colors hover:bg-[#f7faff] md:hidden"
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <MenuIcon className="h-5 w-5" />
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
              buttonTitle={tNav("account_settings")}
              accountSettingsLabel={tNav("account_settings")}
              anonymousLabel={tCommon("anonymous")}
              logoutLabel={tNav("logout")}
              onBeforeLogout={() => {
                localStorage.removeItem("clawplay_draft_form");
                localStorage.removeItem("clawplay_draft_mermaid");
              }}
              items={avatarMenuItems}
            />
          </>
        }
      />

      <div className="flex">
        <aside
          ref={mobileNavRef}
          className={`fixed inset-y-0 left-0 z-50 w-[180px] max-w-[72vw] bg-white px-3 py-3 shadow-[8px_0_28px_rgba(25,43,87,0.08)] transition-transform duration-200 md:hidden ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-[#dbe5f7] px-1 pb-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#edf4ff] text-[#2d67f7]">
              <ShrimpLogoIcon className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#2d67f7]">{tCommon("dashboard")}</p>
              <p className="text-xs text-[#7c879f]">{t("admin_panel")}</p>
            </div>
          </div>

          <div className="space-y-1.5 pt-3">
            {navTop.map(({ label, href }) => {
              const active =
                href === "/" ? pathname === "/" : href === "/skills" ? pathname.startsWith("/skills") : pathname.startsWith("/community");
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
                  <ChevronRightIcon className="h-3 w-3" />
                </Link>
              );
            })}
          </div>

          <div className="mt-4 border-t border-[#dbe5f7] pt-3.5">
            <p className="px-1 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8aa0cb] font-body">
              {t("admin_panel")}
            </p>
            <div className="space-y-1.5">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-full px-2.5 py-2 text-[12px] font-medium font-body transition-colors ${
                      active
                        ? "bg-[#2d67f7] text-white"
                        : "text-[#5f6c86] hover:bg-[#f7faff]"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.href === "/admin/review" ? `${t(item.labelKey)} (${displayCount(pendingCount)})` : t(item.labelKey)}</span>
                    </span>
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <aside className="hidden w-60 shrink-0 sticky top-[72px] h-[calc(100vh-72px)] overflow-y-auto md:block">
          <div className="bg-white border-r border-[#dbe5f7] p-4 flex flex-col gap-1 min-h-full">
            <div className="px-2.5 pb-4 border-b border-[#dbe5f7]">
              <p className="text-[15px] font-semibold text-[#15213b]">{t("admin_panel")}</p>
              <p className="text-xs text-[#7c879f] font-body mt-0.5">
                {user?.role === "reviewer" ? t("reviewer") : t("admin")}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-1">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-[6px] text-[13px] font-medium font-body transition-colors ${
                      active
                        ? "bg-[#edf4ff] text-[#2d67f7] shadow-[inset_0_0_0_1px_rgba(45,103,247,0.12)]"
                        : "text-[#5f6c86] hover:bg-[#f7faff]"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate whitespace-nowrap">
                      {item.href === "/admin/review" ? `${t(item.labelKey)} (${displayCount(pendingCount)})` : t(item.labelKey)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-x-clip">
          <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto flex w-full max-w-[1360px] flex-col">
              <AdminUserContext.Provider value={{ currentUserId: user?.id ?? null }}>
                <PendingCountContext.Provider value={{ count: pendingCount, decrement: () => setPendingCount((n) => Math.max(0, n - 1)) }}>
                  {children}
                </PendingCountContext.Provider>
              </AdminUserContext.Provider>
            </div>
          </div>
          <footer className="border-t border-[#dbe5f7] bg-white/72 px-4 py-4 text-center text-[12px] text-[#7c879f] sm:px-6 lg:px-8">
            © 2025 管理员面板. 保留所有权利.
          </footer>
        </main>
      </div>
    </div>
  );
}
