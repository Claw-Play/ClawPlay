"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";

interface UserInfo {
  id: number;
  email: string;
  name: string;
  role: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useT("admin");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.role !== "admin") {
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

  const isReview = pathname?.startsWith("/admin/review");
  const isAudit = pathname?.startsWith("/admin/audit");

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
            <p className="text-[#586330] text-[10px] uppercase tracking-widest font-body leading-tight">{t("managing")}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          <NavLink href="/admin" icon="📊" label={t("dashboard")} active={pathname === "/admin"} />
          <NavLink href="/admin/review" icon="📝" label={t("pending_reviews")} active={isReview} />
          <NavLink href="/admin/audit" icon="📋" label={t("audit_logs")} active={isAudit} />
          <NavLink href="/admin/settings" icon="⚙️" label={t("settings")} active={pathname === "/admin/settings"} />
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
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-full text-[#586330] hover:bg-[#ede9cf] transition-colors font-body"
            >
              <span className="text-base">🚪</span>
              <span className="text-sm">{t("logout")}</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="h-[80px] bg-[#fefae0] border-b border-[rgba(220,193,177,0.1)] flex items-center px-8 shadow-[0px_8px_24px_0px_rgba(86,67,55,0.06)]">
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-heading text-[#a23f00] tracking-tight">
              {getPageTitle(pathname ?? "", {
                dashboard: t("dashboard"),
                pending_reviews: t("pending_reviews"),
                audit_logs: t("audit_logs"),
                settings: t("settings"),
                admin_panel: t("admin_panel"),
              })}
            </h1>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-[#1d1c0d] font-body">{user.name || user.email}</p>
                <p className="text-[10px] text-[#586330] uppercase tracking-wide font-body">{user.role}</p>
              </div>
              <div className="w-[40px] h-[40px] rounded-full bg-gradient-to-br from-[#a23f00] to-[#fa7025] flex items-center justify-center text-white font-bold text-sm font-body">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-full transition-all font-body ${
        active
          ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)]"
          : "text-[#586330] hover:bg-[#ede9cf]"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function getPageTitle(pathname: string, labels: {dashboard: string; pending_reviews: string; audit_logs: string; settings: string; admin_panel: string}): string {
  if (pathname === "/admin") return labels.dashboard;
  if (pathname.startsWith("/admin/review")) return labels.pending_reviews;
  if (pathname.startsWith("/admin/audit")) return labels.audit_logs;
  if (pathname.startsWith("/admin/settings")) return labels.settings;
  return labels.admin_panel;
}
