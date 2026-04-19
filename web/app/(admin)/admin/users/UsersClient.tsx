"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useT } from "@/lib/i18n/context";
import { useAdminUser } from "@/lib/context/AdminUserContext";
import { formatDate } from "@/lib/timestamp";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  SearchIcon,
} from "@/components/icons";

type RoleValue = "user" | "reviewer" | "admin";
type RoleFilter = RoleValue | "all";
type SortField = "events" | "token_used" | "last_active";
type SortOrder = "asc" | "desc";

interface UserRecord {
  userId: number;
  name: string;
  role: RoleValue;
  totalEvents: number;
  totalQuotaUsed: number;
  lastActive: number;
  topAbilities: { ability: string; count: number }[];
}

// Raw shape returned by the API (fields may be undefined)
interface ApiUserRecord {
  userId: number;
  name: string;
  role?: string;
  totalEvents: number;
  totalQuotaUsed: number;
  lastActive: number;
  topAbilities?: { ability: string; count: number }[];
}

function formatAbility(ability: string): string {
  return ability
    .replace("llm.generate", "LLM")
    .replace("image.generate", "Image")
    .replace("vision.analyze", "Vision")
    .replace("tts.synthesize", "TTS")
    .replace("voice.synthesize", "Voice");
}

const ABILITY_COLORS: Record<string, string> = {
  "llm.generate": "#a23f00",
  "image.generate": "#fa7025",
  "vision.analyze": "#586330",
  "tts.synthesize": "#8a6040",
  "voice.synthesize": "#5a7a4a",
};

const panelClassName =
  "rounded-xl border border-[#eadfc8] bg-[radial-gradient(circle_at_top,_rgba(250,244,228,0.92),_rgba(255,252,246,0.98)_38%,_rgba(250,246,237,0.98)_100%)] shadow-[0_18px_44px_rgba(86,67,55,0.08)]";
const menuClassName =
  "absolute left-0 top-full z-20 mt-2 min-w-[112px] rounded-xl border border-[#eadfc8] bg-[linear-gradient(180deg,#fffdf8_0%,#f7efe1_100%)] p-1 shadow-[0_16px_34px_rgba(86,67,55,0.16)] backdrop-blur-sm";
const menuItemClassName =
  "flex min-h-[30px] w-full items-center justify-between rounded-lg px-2.5 py-1 text-left text-xs font-semibold transition-colors";
const headerCellClassName =
  "px-3 py-2 text-[15px] font-semibold uppercase text-black";
const bodyCellClassName = "px-3 py-2.5 align-middle";

export default function UsersClient() {
  const t = useT("admin");
  const { currentUserId } = useAdminUser();
  const roleFilterRef = useRef<HTMLDivElement | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortField, setSortField] = useState<SortField>("token_used");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [pendingRole, setPendingRole] = useState<Record<number, RoleValue>>({});
  const [roleLoading, setRoleLoading] = useState<Record<number, boolean>>({});
  const [roleError, setRoleError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [openUserRoleMenuId, setOpenUserRoleMenuId] = useState<number | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      period: "all",
      sortBy: sortField,
      sortOrder,
      limit: String(limit),
      offset: String(offset),
    });
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter !== "all") params.set("role", roleFilter);
    fetch(`/api/admin/analytics/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        // Merge role from API (analytics now returns role via JOIN)
        const fetchedUsers: UserRecord[] = (d.users ?? []).map((u: ApiUserRecord) => ({
          userId: u.userId,
          name: u.name,
          role: (u.role as RoleValue) ?? "user",
          totalEvents: u.totalEvents,
          totalQuotaUsed: u.totalQuotaUsed,
          lastActive: u.lastActive,
          topAbilities: u.topAbilities ?? [],
        }));
        setUsers(fetchedUsers);
        setTotal(d.pagination?.total ?? 0);
      })
      .catch(() => setError("Failed to load user data."))
      .finally(() => setLoading(false));
  }, [offset, roleFilter, search, sortField, sortOrder]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (!isRoleMenuOpen && openUserRoleMenuId === null) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!roleFilterRef.current?.contains(target)) {
        setIsRoleMenuOpen(false);
      }
      if (!target.closest("[data-user-role-root='true']")) {
        setOpenUserRoleMenuId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsRoleMenuOpen(false);
        setOpenUserRoleMenuId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isRoleMenuOpen, openUserRoleMenuId]);

  const handleRoleChange = async (userId: number, newRole: RoleValue) => {
    setPendingRole((prev) => ({ ...prev, [userId]: newRole }));
    setRoleLoading((prev) => ({ ...prev, [userId]: true }));
    setRoleError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPendingRole((prev) => { const next = { ...prev }; delete next[userId]; return next; });
        setRoleError(data.error ?? t("role_update_err"));
        return;
      }

      // Update role directly in users state
      setUsers((prev) =>
        prev.map((u) => u.userId === userId ? { ...u, role: newRole } : u)
      );
      setPendingRole((prev) => { const next = { ...prev }; delete next[userId]; return next; });
    } catch {
      setPendingRole((prev) => { const next = { ...prev }; delete next[userId]; return next; });
      setRoleError(t("role_update_err"));
    } finally {
      setRoleLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasUsers = users.length > 0;
  const fillerRowCount = hasUsers ? Math.max(limit - users.length, 0) : Math.max(limit - 1, 0);

  const getDisplayRole = (u: UserRecord): RoleValue =>
    pendingRole[u.userId] ?? u.role;

  const handleSortChange = (field: SortField) => {
    setOffset(0);
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortOrder("desc");
  };

  const renderSortIndicator = (field: SortField) => {
    const active = sortField === field;
    return (
      <span
        aria-hidden="true"
        className={`ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          active
            ? "bg-black/10 text-black shadow-[0_6px_16px_rgba(0,0,0,0.08)]"
            : "text-black/30 hover:bg-black/5 hover:text-black"
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          {active ? (
            sortOrder === "asc" ? (
              <path
                d="M2.5 7.5L6 4L9.5 7.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M2.5 4.5L6 8L9.5 4.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )
          ) : (
            <>
              <path
                d="M3 5L6 2L9 5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
              <path
                d="M3 7L6 10L9 7"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            </>
          )}
        </svg>
      </span>
    );
  };

  const renderSortButton = (field: SortField, label: string) => (
    <div className="flex min-h-[44px] items-center">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => handleSortChange(field)}
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-black/15"
        aria-label={`Sort by ${label}`}
      >
        {renderSortIndicator(field)}
      </button>
    </div>
  );

  const renderMobileSortButton = (field: SortField, label: string) => {
    const active = sortField === field;
    return (
      <button
        key={field}
        type="button"
        onClick={() => handleSortChange(field)}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
          active
            ? "border-[#a23f00] bg-[#f6e9d7] text-[#a23f00]"
            : "border-[#eadfc8] bg-white text-black/60"
        }`}
      >
        <span>{label}</span>
        {renderSortIndicator(field)}
      </button>
    );
  };

  const roleFilterOptions: { value: RoleFilter; label: string }[] = [
    { value: "all", label: t("all_roles") },
    { value: "user", label: t("role_user") },
    { value: "reviewer", label: t("role_reviewer") },
    { value: "admin", label: t("role_admin") },
  ];
  const roleEditorOptions: { value: RoleValue; label: string }[] = [
    { value: "user", label: t("role_user") },
    { value: "reviewer", label: t("role_reviewer") },
    { value: "admin", label: t("role_admin") },
  ];

  const currentRoleFilterLabel =
    roleFilterOptions.find((option) => option.value === roleFilter)?.label ?? t("all_roles");

  const getRoleChipClassName = (role: RoleValue) => {
    if (role === "admin") return "bg-red-100 text-red-700";
    if (role === "reviewer") return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-500";
  };

  const getRoleTextClassName = (role: RoleValue) => {
    if (role === "admin") return "text-red-700";
    if (role === "reviewer") return "text-green-800";
    return "text-gray-500";
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className={`${panelClassName} flex flex-col items-stretch gap-3 px-4 py-4 md:flex-row md:flex-wrap md:items-center`}>
        {/* Search */}
        <div className="relative w-full md:w-auto">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            placeholder={t("search_users")}
            className="w-full min-w-0 rounded-full border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm text-black placeholder:text-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_20px_rgba(86,67,55,0.05)] transition-colors focus:border-black/30 focus:outline-none focus:ring-2 focus:ring-black/15 md:min-w-[220px]"
            style={{ fontFamily: "var(--font-vietnam)" }}
          />
        </div>

        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40 md:ml-auto">
          {t("users_count", { count: total.toLocaleString() })}
        </span>
      </div>

      {/* Role error toast */}
      {roleError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-body text-red-700 shadow-[0_10px_24px_rgba(193,75,50,0.08)]">
          {roleError}
        </div>
      )}

      {/* Table */}
      <div className={`${panelClassName} min-h-[900px] overflow-hidden`}>
        {loading && users.length === 0 ? (
          <div className="p-10 text-center font-body text-black/40 animate-pulse">{t("loading")}</div>
        ) : error && users.length === 0 ? (
          <div className="p-10 text-center font-body text-red-600">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center font-body text-black/40">{t("no_user_data")}</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-[#e6dac2] px-4 py-3 md:hidden">
              {renderMobileSortButton("events", t("events"))}
              {renderMobileSortButton("token_used", t("quota_used"))}
              {renderMobileSortButton("last_active", t("last_active"))}
            </div>

            <div className="grid gap-3 px-4 py-4 md:hidden">
              {users.map((u) => {
                const displayRole = getDisplayRole(u);
                return (
                  <article key={u.userId} className="rounded-[24px] border border-[#eadfc8] bg-white/90 p-4 shadow-[0_8px_20px_rgba(86,67,55,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#b45822_0%,#eb8747_100%)] text-[12px] font-bold text-white shadow-[0_8px_18px_rgba(178,88,34,0.2)]">
                          {(u.name || `U${u.userId}`).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-black">{u.name || `User ${u.userId}`}</p>
                          <p className="text-xs font-semibold text-black/40 [font-variant-numeric:tabular-nums]">#{u.userId.toLocaleString()}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getRoleChipClassName(displayRole)}`}>
                        {t(`role_${displayRole}`)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-2xl bg-[#faf3d0] px-3 py-2">
                        <p className="text-black/40">{t("events")}</p>
                        <p className="mt-1 font-semibold text-black [font-variant-numeric:tabular-nums]">{u.totalEvents.toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl bg-[#faf3d0] px-3 py-2">
                        <p className="text-black/40">{t("quota_used")}</p>
                        <p className="mt-1 font-semibold text-black [font-variant-numeric:tabular-nums]">{u.totalQuotaUsed.toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl bg-[#faf3d0] px-3 py-2">
                        <p className="text-black/40">{t("last_active")}</p>
                        <p className="mt-1 text-[11px] font-semibold text-black [font-variant-numeric:tabular-nums]">
                          {formatDate(u.lastActive ? new Date(u.lastActive) : null)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/35">{t("top_abilities")}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {u.topAbilities.length === 0 ? (
                          <span className="text-xs font-medium text-black/40">—</span>
                        ) : (
                          u.topAbilities.slice(0, 3).map((a) => (
                            <span
                              key={a.ability}
                              className="inline-flex items-center rounded-full border border-white/40 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                              style={{
                                backgroundColor: (ABILITY_COLORS[a.ability] ?? "#666") + "1a",
                                color: ABILITY_COLORS[a.ability] ?? "#666",
                              }}
                            >
                              {formatAbility(a.ability)} {a.count}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="relative hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] table-fixed text-sm font-body">
              <colgroup>
                <col className="w-[72px]" />
                <col className="w-[232px]" />
                <col className="w-[116px]" />
                <col className="w-[128px]" />
                <col className="w-[144px]" />
                <col className="w-[144px]" />
                <col className="w-[240px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[#e6dac2] bg-[linear-gradient(180deg,rgba(255,252,246,0.96),rgba(249,243,232,0.96))] text-left">
                  <th className="pl-5 pr-3 py-2 text-[15px] font-semibold uppercase text-black">ID</th>
                  <th className={headerCellClassName}>{t("user_label")}</th>
                  <th className={headerCellClassName}>
                    <div ref={roleFilterRef} className="relative flex min-h-[44px] items-center">
                      <span>{t("role")}</span>
                      <button
                        type="button"
                        onClick={() => setIsRoleMenuOpen((prev) => !prev)}
                        className={`ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-black/15 ${
                          roleFilter === "all"
                            ? "text-black/30 hover:bg-black/5 hover:text-black focus:bg-black/5 focus:text-black"
                            : "bg-black/10 text-black hover:bg-black/15 focus:bg-black/15"
                        }`}
                        aria-haspopup="menu"
                        aria-expanded={isRoleMenuOpen}
                        aria-label={`Filter by role: ${currentRoleFilterLabel}`}
                        title={currentRoleFilterLabel}
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-flex h-3.5 w-3.5 items-center justify-center transition-transform ${
                            isRoleMenuOpen ? "rotate-180" : ""
                          }`}
                        >
                          <ChevronDownIcon className="w-3 h-3" />
                        </span>
                      </button>
                      {isRoleMenuOpen && (
                        <div className={menuClassName}>
                          {roleFilterOptions.map((option) => {
                            const selected = option.value === roleFilter;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setRoleFilter(option.value);
                                  setOffset(0);
                                  setIsRoleMenuOpen(false);
                                }}
                                className={`${menuItemClassName} ${
                                  selected
                                    ? "bg-black/10 text-black"
                                    : "text-black/60 hover:bg-black/5 hover:text-black"
                                }`}
                                style={{ fontFamily: "var(--font-vietnam)" }}
                                role="menuitemradio"
                                aria-checked={selected}
                              >
                                <span>{option.label}</span>
                                <span
                                  aria-hidden="true"
                                  className={`inline-flex h-4 w-4 items-center justify-center ${
                                    selected ? "text-black" : "text-transparent"
                                  }`}
                                >
                                  <CheckIcon className="w-3 h-3" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </th>
                  <th className={headerCellClassName}>
                    {renderSortButton("events", t("events"))}
                  </th>
                  <th className={headerCellClassName}>
                    {renderSortButton("token_used", t("quota_used"))}
                  </th>
                  <th className={headerCellClassName}>
                    {renderSortButton("last_active", t("last_active"))}
                  </th>
                  <th className={headerCellClassName}>{t("top_abilities")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const displayRole = getDisplayRole(u);
                  return (
                    <tr key={u.userId} className="border-b border-[#efe4cf] transition-colors hover:bg-[linear-gradient(90deg,rgba(248,241,226,0.75),rgba(255,252,246,0.15))]">
                      <td className="pl-5 pr-3 py-2.5 whitespace-nowrap text-[14px] font-semibold text-black [font-variant-numeric:tabular-nums]">
                        {u.userId.toLocaleString()}
                      </td>
                      <td className={bodyCellClassName}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#b45822_0%,#eb8747_100%)] text-[12px] font-bold text-white shadow-[0_8px_18px_rgba(178,88,34,0.2)]">
                            {(u.name || `U${u.userId}`).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold leading-tight">{u.name || `User ${u.userId}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className={bodyCellClassName}>
                        {currentUserId === u.userId ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold tracking-[0.01em] ${getRoleTextClassName(displayRole)}`}>
                            <span>{t(`role_${displayRole}`)}</span>
                            <span>{t("you_suffix")}</span>
                          </span>
                        ) : (
                          <div
                            data-user-role-root="true"
                            className="relative inline-flex items-center"
                          >
                            <button
                              type="button"
                              disabled={!!roleLoading[u.userId]}
                              onClick={() =>
                                setOpenUserRoleMenuId((prev) => (prev === u.userId ? null : u.userId))
                              }
                              className={`inline-flex min-h-[24px] items-center gap-1.5 text-xs font-semibold tracking-[0.01em] transition-colors focus:outline-none ${
                                roleLoading[u.userId]
                                  ? "cursor-wait opacity-50"
                                  : "hover:opacity-90"
                              }`}
                              style={{ fontFamily: "var(--font-vietnam)" }}
                              aria-haspopup="menu"
                              aria-expanded={openUserRoleMenuId === u.userId}
                              aria-label={`Change role for ${u.name || `User ${u.userId}`}`}
                            >
                              <span className={getRoleTextClassName(displayRole)}>
                                {t(`role_${displayRole}`)}
                              </span>
                              <span
                                aria-hidden="true"
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition-all ${
                                  getRoleChipClassName(displayRole)
                                } ${openUserRoleMenuId === u.userId ? "rotate-180 shadow-[0_6px_16px_rgba(86,67,55,0.1)]" : ""}`}
                              >
                                <ChevronDownIcon className="w-2.5 h-2.5" />
                              </span>
                            </button>
                            {openUserRoleMenuId === u.userId && (
                              <div className={menuClassName}>
                                {roleEditorOptions.map((option) => {
                                  const selected = option.value === displayRole;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => {
                                        void handleRoleChange(u.userId, option.value);
                                        setOpenUserRoleMenuId(null);
                                      }}
                                      className={`${menuItemClassName} ${
                                        selected
                                          ? "bg-[#eee0c9] text-[#75563f]"
                                          : "text-[#8d745e] hover:bg-[#f5ede0] hover:text-[#a23f00]"
                                      }`}
                                      style={{ fontFamily: "var(--font-vietnam)" }}
                                      role="menuitemradio"
                                      aria-checked={selected}
                                    >
                                      <span>{option.label}</span>
                                      <span
                                        aria-hidden="true"
                                        className={`inline-flex h-4 w-4 items-center justify-center ${
                                          selected ? "text-[#a23f00]" : "text-transparent"
                                        }`}
                                      >
                                        <CheckIcon className="w-3 h-3" />
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className={`${bodyCellClassName} whitespace-nowrap text-[14px] font-semibold text-black [font-variant-numeric:tabular-nums]`}>
                        {u.totalEvents.toLocaleString()}
                      </td>
                      <td className={`${bodyCellClassName} whitespace-nowrap text-[14px] font-semibold text-black [font-variant-numeric:tabular-nums]`}>
                        {u.totalQuotaUsed.toLocaleString()}
                      </td>
                      <td className={`${bodyCellClassName} whitespace-nowrap text-[14px] font-semibold text-black [font-variant-numeric:tabular-nums]`}>
                        {formatDate(u.lastActive ? new Date(u.lastActive) : null)}
                      </td>
                      <td className={bodyCellClassName}>
                        <div className="flex flex-wrap gap-1.5 overflow-hidden">
                          {u.topAbilities.length === 0 ? (
                            <span className="text-xs font-medium text-black/40">—</span>
                          ) : (
                            u.topAbilities.map((a) => (
                              <span
                                key={a.ability}
                                className="inline-flex items-center rounded-full border border-white/40 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                                style={{
                                  backgroundColor: (ABILITY_COLORS[a.ability] ?? "#666") + "1a",
                                  color: ABILITY_COLORS[a.ability] ?? "#666",
                                }}
                              >
                                {formatAbility(a.ability)} {a.count}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {loading && (
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.24),rgba(247,240,226,0.14))] backdrop-blur-[1px]">
                <div className="absolute inset-x-6 top-6 h-px bg-[linear-gradient(90deg,transparent,rgba(0,0,0,0.18),transparent)] animate-pulse" />
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-body text-black shadow-[0_8px_20px_rgba(86,67,55,0.06)] transition-colors hover:bg-black/5 disabled:opacity-40"
          >
            <ChevronLeftIcon className="w-3 h-3" /> {t("pagination_prev")}
          </button>
          <span className="px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
            {t("pagination_status", {
              current: String(currentPage),
              total: String(totalPages),
            })}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-body text-black shadow-[0_8px_20px_rgba(86,67,55,0.06)] transition-colors hover:bg-black/5 disabled:opacity-40"
          >
            {t("pagination_next")} <ChevronRightIcon className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
