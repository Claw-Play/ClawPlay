"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { AdminUserContext } from "@/lib/context/AdminUserContext";
import { PendingCountContext } from "@/lib/context/PendingCountContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  AdminShieldIcon,
  AuditIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  DashboardIcon,
  EventsIcon,
  LogoutIcon,
  MenuIcon,
  ProvidersIcon,
  ReviewIcon,
  ShrimpLogoIcon,
  SubmitIcon,
  UsersIcon,
} from "@/components/icons";

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const t = useT("admin");
  const tNav = useT("nav");
  const tCommon = useT("common");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch("/api/user/me");
        const meData = await meRes.json();
        if (meData.user?.role !== "admin" && meData.user?.role !== "reviewer") {
          window.location.href = "/";
          return;
        }
        setUser(meData.user);

        const skillsRes = await fetch("/api/admin/skills");
        const skillsData = await skillsRes.json();
        const count = Array.isArray(skillsData.skills) ? skillsData.skills.length : 0;
        setPendingCount(count);
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Close dropdown on outside click
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

  // Listen for logout to clear user and redirect
  useEffect(() => {
    function onLogout() {
      setUser(null);
      setLoading(false);
    }
    window.addEventListener("clawplay:logout", onLogout);
    return () => window.removeEventListener("clawplay:logout", onLogout);
  }, []);

  const navItems = user?.role === "reviewer" ? NAV_ITEMS_REVIEWER : NAV_ITEMS_ADMIN;

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

  function getPageTitle(): string {
    const item = navItems.find((n) => isActive(n.href));
    if (item) return t(item.labelKey);
    return t("admin_panel");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fefae0] px-4">
        <div className="text-[#7a6a5a] animate-pulse font-body">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fefae0] flex overflow-x-hidden">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      {/* Left Sidebar */}
      <aside
        ref={mobileNavRef}
        className={`fixed inset-y-0 left-0 z-50 w-[160px] max-w-[58vw] bg-[#f8f4db] flex flex-col px-2 py-3 shadow-[8px_0px_24px_0px_rgba(86,67,55,0.08)] transition-transform duration-200 md:static md:z-auto md:w-[213px] md:max-w-none md:flex-shrink-0 md:py-8 md:px-4 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-1.5 px-1 pb-4 border-b border-[#e8dfc8] md:gap-3 md:px-4 md:pb-8 md:border-b-0">
          <div className="w-[32px] h-[32px] rounded-full bg-gradient-to-br from-[#a23f00] to-[#fa7025] flex items-center justify-center flex-shrink-0 md:w-[40px] md:h-[40px] text-white">
            <ShrimpLogoIcon className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-[#a23f00] font-bold font-heading text-sm leading-tight md:text-lg">{t("admin_panel")}</p>
            <p className="text-[#586330] text-[10px] uppercase tracking-widest font-body leading-tight">
              {user?.role === "reviewer" ? t("reviewer") : t("admin")}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 pt-3 space-y-1.5 md:pt-0 md:space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-full px-2.5 py-2 text-[12px] font-semibold font-body transition-all md:gap-3 md:px-4 md:py-3 md:text-sm ${
                isActive(item.href)
                  ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)]"
                  : "text-[#586330] hover:bg-[#ede9cf]"
              }`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <item.icon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                <span className="truncate font-medium leading-tight">
                  {item.href === "/admin/review"
                    ? `${t(item.labelKey)} (${displayCount(pendingCount)})`
                    : t(item.labelKey)}
                </span>
              </span>
              <ChevronRightIcon className="w-3 h-3 text-current shrink-0" />
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="space-y-0.5 pt-2 border-t border-[rgba(220,193,177,0.2)] md:space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center justify-between rounded-full px-2.5 py-2 text-[12px] text-[#586330] hover:bg-[#ede9cf] transition-colors font-body md:gap-3 md:px-4 md:py-3 md:text-sm"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <ChevronLeftIcon className="w-3 h-3" />
              <span className="truncate font-medium leading-tight">{t("back_to_app")}</span>
            </span>
            <ChevronRightIcon className="w-3 h-3 text-current shrink-0" />
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="sticky top-0 z-50 bg-[#fefae0] border-b border-[#e8dfc8] shadow-[0px_8px_24px_0px_rgba(86,67,55,0.06)]">
          <div className="max-w-[1536px] mx-auto px-4 py-3 flex items-center justify-between gap-3 md:px-8 md:py-4">
            <div className="flex flex-1 items-center gap-2 min-w-0">
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
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold font-heading text-[#a23f00] tracking-tight md:text-xl">
                  {getPageTitle()}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <LanguageSwitcher />
              <div className="h-6 w-px bg-[#e8dfc8] hidden md:block" />
              {user && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#e8dfc8] flex items-center justify-center hover:border-[#a23f00] transition-all cursor-pointer"
                    title={tNav("account_settings")}
                  >
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.id}&backgroundColor=ff6b35,fa7025,a23f00`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(86,67,55,0.12)] border border-[#e8dfc8] overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-[#ede9cf]">
                        <p className="text-sm font-semibold text-[#1d1c0d] font-body truncate">
                          {user.name || user.email}
                        </p>
                        <p className="text-xs text-[#7a6a5a] font-body mt-0.5">{tNav("account_settings")}</p>
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
                        {user.role === "admin" && (
                          <Link
                            href="/admin"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#a23f00] hover:bg-[#faf3d0] font-body transition-colors font-semibold"
                            onClick={() => setDropdownOpen(false)}
                          >
                        <AdminShieldIcon className="w-4 h-4" /> {tCommon("admin_panel")}
                      </Link>
                        )}
                      </div>
                      <div className="border-t border-[#ede9cf] py-2">
                        <button
                          onClick={async () => {
                            setDropdownOpen(false);
                            const from = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
                            const loginUrl = `/login?from=${encodeURIComponent(from)}`;
                            window.dispatchEvent(new Event("clawplay:logout"));
                            try {
                              await fetch(`/api/auth/logout?from=${encodeURIComponent(from)}`, {
                                method: "POST",
                                redirect: "manual",
                              });
                            } catch {}
                            window.location.href = loginUrl;
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 font-body transition-colors text-left"
                        >
                      <LogoutIcon className="w-4 h-4" /> {tNav("logout")}
                    </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 md:p-8">
          <AdminUserContext.Provider value={{ currentUserId: user?.id ?? null }}>
            <PendingCountContext.Provider value={{ count: pendingCount, decrement: () => setPendingCount((n) => Math.max(0, n - 1)) }}>
              {children}
            </PendingCountContext.Provider>
          </AdminUserContext.Provider>
        </main>
      </div>
    </div>
  );
}
