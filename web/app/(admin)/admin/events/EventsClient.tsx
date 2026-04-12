"use client";
import { useState, useEffect, useCallback } from "react";
import { useT } from "@/lib/i18n/context";

const EVENT_OPTIONS = [
  { value: "", label: "All events" },
  { value: "user.register", label: "user.register" },
  { value: "user.login", label: "user.login" },
  { value: "skill.view", label: "skill.view" },
  { value: "skill.submit", label: "skill.submit" },
  { value: "skill.approve", label: "skill.approve" },
  { value: "skill.reject", label: "skill.reject" },
  { value: "skill.download", label: "skill.download" },
  { value: "quota.check", label: "token.check" },
  { value: "quota.use", label: "token.use" },
  { value: "quota.exceeded", label: "token.exceeded" },
  { value: "quota.error", label: "token.error" },
  { value: "token.generate", label: "token.generate" },
  { value: "token.revoke", label: "token.revoke" },
];

const TARGET_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "skill", label: "skill" },
  { value: "user", label: "user" },
  { value: "token", label: "token" },
  { value: "quota", label: "token" },
  { value: "ability", label: "ability" },
];

interface EventRecord {
  id: number;
  event: string;
  user_id: number | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: number;
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function EventsClient() {
  useT("admin");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventFilter, setEventFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (eventFilter) params.set("event", eventFilter);
    if (userIdFilter) params.set("user_id", userIdFilter);
    if (targetTypeFilter) params.set("target_type", targetTypeFilter);
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    fetch(`/api/admin/analytics/events?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setEvents(d.events ?? []);
        setTotal(d.pagination?.total ?? 0);
      })
      .catch(() => setError("Failed to load events."))
      .finally(() => setLoading(false));
  }, [eventFilter, userIdFilter, targetTypeFilter, fromFilter, toFilter, offset]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  function resetFilters() {
    setEventFilter("");
    setUserIdFilter("");
    setTargetTypeFilter("");
    setFromFilter("");
    setToFilter("");
    setOffset(0);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-[32px] p-6 shadow-[0_8px_24px_rgba(86,67,55,0.06)] space-y-3">
        <div className="flex flex-wrap gap-3">
          <select
            value={eventFilter}
            onChange={(e) => { setEventFilter(e.target.value); setOffset(0); }}
            className="border border-[#e8dfc8] rounded-full px-4 py-2 text-sm font-body text-[#564337] bg-[#fefae0] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30"
          >
            {EVENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="User ID"
            value={userIdFilter}
            onChange={(e) => { setUserIdFilter(e.target.value); setOffset(0); }}
            className="border border-[#e8dfc8] rounded-full px-4 py-2 text-sm font-body text-[#564337] bg-[#fefae0] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30 w-32"
          />
          <select
            value={targetTypeFilter}
            onChange={(e) => { setTargetTypeFilter(e.target.value); setOffset(0); }}
            className="border border-[#e8dfc8] rounded-full px-4 py-2 text-sm font-body text-[#564337] bg-[#fefae0] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30"
          >
            {TARGET_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="From (Unix ms)"
            value={fromFilter}
            onChange={(e) => { setFromFilter(e.target.value); setOffset(0); }}
            className="border border-[#e8dfc8] rounded-full px-4 py-2 text-sm font-body text-[#564337] bg-[#fefae0] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30 w-40"
          />
          <input
            type="number"
            placeholder="To (Unix ms)"
            value={toFilter}
            onChange={(e) => { setToFilter(e.target.value); setOffset(0); }}
            className="border border-[#e8dfc8] rounded-full px-4 py-2 text-sm font-body text-[#564337] bg-[#fefae0] focus:outline-none focus:ring-2 focus:ring-[#a23f00]/30 w-40"
          />
          <button
            onClick={resetFilters}
            className="px-4 py-2 rounded-full text-sm font-body text-[#586330] hover:bg-[#ede9cf] transition-colors border border-[#e8dfc8]"
          >
            Reset
          </button>
        </div>
        <p className="text-xs text-[#a89070] font-body">
          {total.toLocaleString()} events total
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[32px] shadow-[0_8px_24px_rgba(86,67,55,0.06)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#a89070] font-body animate-pulse">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-[#a23f00] font-body">{error}</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-[#a89070] font-body">No events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-[#e8dfc8] text-left">
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">Time</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">Event</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">User</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">Type</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">Target</th>
                  <th className="px-4 py-3 text-xs text-[#a89070] font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-[#f0e8d0] hover:bg-[#faf5e8] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#564337] font-mono-custom whitespace-nowrap">
                      {formatTs(e.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ede9cf] text-[#a23f00]">
                        {e.event}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#564337]">
                      {e.user_id ?? <span className="text-[#a89070]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#564337]">
                      {e.target_type ?? <span className="text-[#a89070]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#564337] max-w-[120px] truncate">
                      {e.target_id ?? <span className="text-[#a89070]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#a89070] max-w-[200px] truncate">
                      {JSON.stringify(e.metadata)}
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
