"use client";

import { useEffect, useState, useRef } from "react";
import { useT } from "@/lib/i18n/context";
import UserAvatarMenu from "@/components/UserAvatarMenu";

export default function HomeHeaderAuth() {
  const tCommon = useT("common");
  const tNav = useT("nav");
  const [user, setUser] = useState<{
    id: number;
    name?: string;
    role?: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch("/api/user/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onLogout() {
      setUser(null);
    }
    window.addEventListener("clawplay:logout", onLogout);
    return () => window.removeEventListener("clawplay:logout", onLogout);
  }, []);

  return (
    <UserAvatarMenu
      user={user}
      loading={loading}
      loginHref="/login"
      loginLabel={tCommon("login")}
      buttonTitle={tCommon("dashboard")}
      accountSettingsLabel={tNav("account_settings")}
      anonymousLabel={tCommon("anonymous")}
      logoutLabel={tNav("logout")}
      onBeforeLogout={() => {
        localStorage.removeItem("clawplay_draft_form");
        localStorage.removeItem("clawplay_draft_mermaid");
      }}
      items={
        user
          ? [
              { href: "/dashboard", label: tCommon("dashboard"), kind: "dashboard" as const },
              { href: "/submit", label: tCommon("submit"), kind: "submit" as const },
              ...(user.role === "admin"
                ? [{ href: "/admin", label: tCommon("admin_panel"), kind: "admin" as const, tone: "accent" as const }]
                : []),
              ...(user.role === "reviewer"
                ? [{ href: "/admin/review", label: tCommon("pending_reviews"), kind: "review" as const, tone: "accent" as const }]
                : []),
            ]
          : []
      }
    />
  );
}
