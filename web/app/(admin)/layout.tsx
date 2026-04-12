"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";

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
  { href: "/admin", icon: "📊", labelKey: "dashboard" as const },
  { href: "/admin/review", icon: "📝", labelKey: "pending_reviews" as const },
  { href: "/admin/events", icon: "📡", labelKey: "events" as const },
  { href: "/admin/users", icon: "👥", labelKey: "users" as const },
  { href: "/admin/audit", icon: "📋", labelKey: "audit_logs" as const },
  { href: "/admin/settings", icon: "⚙️", labelKey: "settings" as const },
];

const NAV_ITEMS_REVIEWER = [
  { href: "/admin/review", icon: "📝", labelKey: "pending_reviews" as const },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const t = useT("admin");
  const tNav = useT("nav");
  const tCommon = useT("common");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.role !== "admin" && data.user?.role !== "reviewer") {
          window.location.href = "/";
          return;
        }
        setUser(data.user);
      })
      .catch(() => {
        window.location.href = "/login";
      })
      .finally(() => setLoading(false));
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

  const navItems = user?.role === "reviewer" ? NAV_ITEMS_REVIEWER : NAV_ITEMS_ADMIN;

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/admin/events") return pathname.startsWith("/admin/events");
    if (href === "/admin/users") return pathname.startsWith("/admin/users");
    if (href === "/admin/review") return pathname.startsWith("/admin/review");
    if (href === "/admin/audit") return pathname.startsWith("/admin/audit");
    if (href === "/admin/settings") return pathname === "/admin/settings";
    return false;
  }

  function getPageTitle(): string {
    const item = navItems.find((n) => isActive(n.href));
    if (item) return t(item.labelKey);
    return t("admin_panel");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fefae0]">
        <div className="text-[#7a6a5a] animate-pulse font-body">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fefae0] flex">
      {/* Left Sidebar */}
      <aside className="w-[213px] flex-shrink-0 bg-[#f8f4db] flex flex-col py-8 px-4 shadow-[8px_0px_24px_0px_rgba(86,67,55,0.06)]">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 pb-8">
          <div className="w-[40px] h-[40px] rounded-full bg-gradient-to-br from-[#a23f00] to-[#fa7025] flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🦐</span>
          </div>
          <div>
            <p className="text-[#a23f00] font-bold font-heading text-lg leading-tight">{t("admin_panel")}</p>
            <p className="text-[#586330] text-[10px] uppercase tracking-widest font-body leading-tight">
              {user?.role === "reviewer" ? t("reviewer") : t("admin")}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-full transition-all font-body ${
                isActive(item.href)
                  ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)]"
                  : "text-[#586330] hover:bg-[#ede9cf]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="text-sm font-medium">{t(item.labelKey)}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="space-y-1 pt-2 border-t border-[rgba(220,193,177,0.2)]">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-full text-[#586330] hover:bg-[#ede9cf] transition-colors font-body"
          >
            <span className="text-base">↩</span>
            <span className="text-sm">{t("back_to_app")}</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="h-[80px] bg-[#fefae0] border-b border-[rgba(220,193,177,0.1)] flex items-center px-8 shadow-[0px_8px_24px_0px_rgba(86,67,55,0.06)]">
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-heading text-[#a23f00] tracking-tight">
              {getPageTitle()}
            </h1>
          </div>
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#e8dfc8] flex items-center justify-center hover:border-[#a23f00] transition-all cursor-pointer"
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
                      <span className="text-base">⚙</span> {tCommon("dashboard")}
                    </Link>
                    <Link
                      href="/submit"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#564337] hover:bg-[#faf3d0] font-body transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="text-base">✦</span> {tCommon("submit")}
                    </Link>
                    {user.role === "admin" && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#a23f00] hover:bg-[#faf3d0] font-body transition-colors font-semibold"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <span className="text-base">🛡</span> {tCommon("admin_panel")}
                      </Link>
                    )}
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
                      <span className="text-base">⊘</span> {tNav("logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
