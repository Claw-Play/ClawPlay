"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AdminShieldIcon,
  DashboardIcon,
  LogoutIcon,
  ReviewIcon,
  SubmitIcon,
} from "@/components/icons";

export type UserAvatarMenuUser = {
  id?: number;
  name?: string;
  role?: string;
  avatarUrl?: string | null;
} | null;

export type UserAvatarMenuItem = {
  href: string;
  label: string;
  tone?: "default" | "accent";
  kind: "dashboard" | "submit" | "admin" | "review";
};

type UserAvatarMenuProps = {
  user: UserAvatarMenuUser;
  loading?: boolean;
  loginHref: string;
  loginLabel: string;
  buttonTitle: string;
  accountSettingsLabel: string;
  anonymousLabel: string;
  logoutLabel: string;
  items: UserAvatarMenuItem[];
  onBeforeLogout?: () => void;
};

function ItemIcon({ kind }: { kind: UserAvatarMenuItem["kind"] }) {
  if (kind === "dashboard") return <DashboardIcon className="h-5 w-5" />;
  if (kind === "submit") return <SubmitIcon className="h-5 w-5" />;
  if (kind === "admin") return <AdminShieldIcon className="h-5 w-5" />;
  return <ReviewIcon className="h-5 w-5" />;
}

export default function UserAvatarMenu({
  user,
  loading = false,
  loginHref,
  loginLabel,
  buttonTitle,
  accountSettingsLabel,
  anonymousLabel,
  logoutLabel,
  items,
  onBeforeLogout,
}: UserAvatarMenuProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    setDropdownOpen(false);
  }, [pathname]);

  if (loading) {
    return <div className="h-9 w-9 rounded-full bg-[#e9eef8] animate-pulse" />;
  }

  if (!user) {
    return (
      <Link
        href={loginHref}
        className="inline-flex min-h-9 items-center justify-center rounded-xl bg-[#2d67f7] px-4 text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(45,103,247,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-[#2457d4] sm:px-5 sm:text-[14px]"
      >
        {loginLabel}
      </Link>
    );
  }

  const avatarUrl = user.avatarUrl
    ? user.avatarUrl
    : `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.id ?? "clawplay"}&backgroundColor=ff7a45,f25f2c,f6b36a`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={dropdownOpen}
        className="h-9 w-9 overflow-hidden rounded-full border border-[#c8d7f5] bg-white flex items-center justify-center shadow-[0_8px_18px_rgba(25,43,87,0.04)] transition-all cursor-pointer hover:-translate-y-0.5 hover:border-[#2d67f7]"
        title={buttonTitle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[min(88vw,272px)] overflow-hidden rounded-[20px] border border-[#d9e3f4] bg-white shadow-[0_18px_42px_rgba(25,43,87,0.14)] backdrop-blur-xl">
          <div className="border-b border-[#edf1f8] px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d9e3f4] bg-[#f7faff] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-heading font-semibold tracking-[-0.03em] text-[#1f2b45]">
                  {user.name || anonymousLabel}
                </p>
                <p className="mt-1 text-[12px] font-body text-[#8a95ab]">{accountSettingsLabel}</p>
              </div>
            </div>
          </div>

          <div className="px-2 py-2.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] transition-colors hover:bg-[#f7faff] ${
                  item.tone === "accent" ? "font-semibold text-[#2d67f7]" : "text-[#1f2b45]"
                }`}
                onClick={() => setDropdownOpen(false)}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf4ff] text-[#3f67ff]">
                  <span className="inline-flex h-[17px] w-[17px] items-center justify-center">
                    <ItemIcon kind={item.kind} />
                  </span>
                </span>
                <span className={`font-heading tracking-[-0.02em] ${item.tone === "accent" ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          <div className="border-t border-[#edf1f8] px-2 py-2.5">
            <button
              onClick={async () => {
                setDropdownOpen(false);
                onBeforeLogout?.();
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
              className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] text-[#ef4444] transition-colors hover:bg-[#fff5f5] text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff5f5] text-[#ef4444]">
                <LogoutIcon className="h-[14px] w-[14px]" />
              </span>
              <span className="font-heading font-semibold tracking-[-0.02em]">{logoutLabel}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
