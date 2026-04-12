"use client";
import { useState, useEffect, useCallback } from "react";
import { useT } from "@/lib/i18n/context";

interface UserRecord {
  userId: number;
  name: string;
  totalEvents: number;
  totalQuotaUsed: number;
  lastActive: number;
  topAbilities: { ability: string; count: number }[];
}

function formatTs(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
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

export default function UsersClient() {
  const t = useT("admin");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const [sort, setSort] = useState<"events" | "quota_used">("quota_used");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      period,
      sort,
      limit: String(limit),
      offset: String(offset),
    });
    fetch(`/api/admin/analytics/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setUsers(d.users ?? []);
        setTotal(d.pagination?.total ?? 0);
      })
      .catch(() => setError("Failed to load user data."))
      .finally(() => setLoading(false));
  }, [period, sort, offset]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-white rounded-full p-1 shadow-[0_4px_12px_rgba(86,67,55,0.08)]">
          {(["7d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setOffset(0); }}
              className={`px-4 py-1.5 rounded-full text-sm font-body transition-all ${
                period === p
                  ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white"
                  : "text-[#586330] hover:bg-[#ede9cf]"
              }`}
            >
              {p === "7d" ? t("period_7d") : t("period_30d")}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white rounded-full p-1 shadow-[0_4px_12px_rgba(86,67,55,0.08)]">
          <button
            onClick={() => { setSort("quota_used"); setOffset(0); }}
            className={`px-4 py-1.5 rounded-full text-sm font-body transition-all ${
              sort === "quota_used"
                ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white"
                : "text-[#586330] hover:bg-[#ede9cf]"
            }`}
          >
            By Token
          </button>
          <button
            onClick={() => { setSort("events"); setOffset(0); }}
            className={`px-4 py-1.5 rounded-full text-sm font-body transition-all ${
              sort === "events"
                ? "bg-gradient-to-r from-[#a23f00] to-[#fa7025] text-white"
                : "text-[#586330] hover:bg-[#ede9cf]"
            }`}
          >
            By Events
          </button>
        </div>
        <span className="text-sm text-[#a89070] font-body ml-auto">{total} users</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[32px] shadow-[0_8px_24px_rgba(86,67,55,0.06)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#a89070] font-body animate-pulse">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-[#a23f00] font-body">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-[#a89070] font-body">No user data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-[#e8dfc8] text-left">
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">#</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">User</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">Events</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">Token Used</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">Last Active</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">Top Abilities</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.userId} className="border-b border-[#f0e8d0] hover:bg-[#faf5e8] transition-colors">
                    <td className="px-4 py-3 text-[#a89070] font-mono-custom text-xs">
                      {(offset + i + 1).toString().padStart(3, "0")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#a23f00] to-[#fa7025] flex items-center justify-center text-white font-bold text-xs font-body flex-shrink-0">
                          {(u.name || `U${u.userId}`).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#564337] font-body">{u.name || `User ${u.userId}`}</p>
                          <p className="text-xs text-[#a89070] font-body">{u.userId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#564337] font-semibold">
                      {u.totalEvents.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#564337] font-semibold">
                      {u.totalQuotaUsed.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a89070] font-body whitespace-nowrap">
                      {formatTs(u.lastActive)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.topAbilities.length === 0 ? (
                          <span className="text-xs text-[#a89070]">—</span>
                        ) : (
                          u.topAbilities.map((a) => (
                            <span
                              key={a.ability}
                              className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                backgroundColor: (ABILITY_COLORS[a.ability] ?? "#a89070") + "20",
                                color: ABILITY_COLORS[a.ability] ?? "#a89070",
                              }}
                            >
                              {formatAbility(a.ability)} {a.count}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="px-4 py-2 rounded-full text-sm font-body text-[#564337] bg-white shadow-[0_4px_12px_rgba(86,67,55,0.08)] disabled:opacity-40 hover:bg-[#ede9cf] transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-[#a89070] font-body px-4">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            className="px-4 py-2 rounded-full text-sm font-body text-[#564337] bg-white shadow-[0_4px_12px_rgba(86,67,55,0.08)] disabled:opacity-40 hover:bg-[#ede9cf] transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
