"use client";
import { useState, useEffect, useCallback } from "react";
import { useT } from "@/lib/i18n/context";

type Ability = "llm" | "image" | "vision";

interface KeyRecord {
  id: number;
  provider: string;
  ability: string;
  keyHash: string;
  endpoint: string;
  apiFormat: string;
  modelName: string;
  quota: number;
  windowUsed: number;
  windowStart: number;
  totalCalls: number;
  enabled: boolean;
  createdAt: Date;
}

interface GroupedKeys {
  [ability: string]: KeyRecord[];
}

const ABILITIES: { key: Ability; icon: string; color: string }[] = [
  { key: "llm", icon: "💬", color: "#586330" },
  { key: "image", icon: "🖼️", color: "#a23f00" },
  { key: "vision", icon: "👁️", color: "#7a5a3a" },
];

const PROVIDER_META: Record<string, { labelKey: string; color: string; badge: string }> = {
  ark: { labelKey: "provider_ark", color: "#fa7025", badge: "🔵" },
  gemini: { labelKey: "provider_gemini", color: "#4285f4", badge: "🟢" },
};

function UsageBar({ used, quota, windowStart, totalCalls, t }: { used: number; quota: number; windowStart: number; totalCalls: number; t: (key: string) => string }) {
  // windowStart is Unix seconds; compare against current minute boundary
  const nowMinute = Math.floor(Date.now() / 60000);
  const windowMinute = Math.floor(windowStart / 60);
  const effectiveUsed = windowMinute < nowMinute ? 0 : used;
  const pct = quota > 0 ? Math.min(100, Math.round((effectiveUsed / quota) * 100)) : 0;
  const color = pct >= 80 ? "#e53e3e" : pct >= 50 ? "#d69e2e" : "#38a169";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#e8dfc8] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-xs font-mono-custom whitespace-nowrap" style={{ color, minWidth: "80px", textAlign: "right" }}>
          {effectiveUsed.toLocaleString()} / {quota.toLocaleString()} {t("per_minute")}
        </span>
      </div>
      <div className="flex justify-end">
        <span className="text-xs font-mono-custom text-[#a89070]">
          {t("total_calls")}: {totalCalls.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function maskHash(hash: string): string {
  if (!hash || hash.length <= 8) return hash ?? "••••";
  return `${hash.slice(0, 4)}••••${hash.slice(-4)}`;
}

function Toggle({ enabled, onToggle, loading }: { enabled: boolean; onToggle: () => void; loading: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
        enabled ? "bg-[#38a169] focus:ring-[#38a169]" : "bg-[#e8dfc8] focus:ring-[#e8dfc8]"
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

interface AddProviderFormProps {
  ability: Ability;
  /** If set, form runs in edit mode (PATCH) pre-filled with existing values */
  editKey?: KeyRecord;
  onClose: () => void;
  onAdded: () => void;
  t: (key: string) => string;
}

function AddProviderForm({ ability, editKey, onClose, onAdded, t }: AddProviderFormProps) {
  const isEdit = !!editKey;
  const [provider, setProvider] = useState(editKey?.provider ?? "ark");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState(editKey?.endpoint ?? "");
  const [apiFormat, setApiFormat] = useState(editKey?.apiFormat ?? "ark");
  const [modelName, setModelName] = useState(editKey?.modelName ?? "");
  const [quota, setQuota] = useState(editKey?.quota ? String(editKey.quota) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit && !apiKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let body: Record<string, unknown>;

      if (isEdit) {
        body = {
          id: editKey.id,
          endpoint: endpoint.trim() || "",
          apiFormat: apiFormat || "",
          modelName: modelName.trim() || "",
          quota: quota ? parseInt(quota, 10) : undefined,
        };
        const res = await fetch("/api/admin/keys", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? t("error_update"));
          return;
        }
      } else {
        body = {
          provider,
          ability,
          key: apiKey.trim(),
          endpoint: endpoint.trim() || undefined,
          apiFormat: apiFormat || undefined,
          modelName: modelName.trim() || undefined,
          quota: quota ? parseInt(quota, 10) : undefined,
        };
        const res = await fetch("/api/admin/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? t("error_adding"));
          return;
        }
        setApiKey("");
        setEndpoint("");
        setModelName("");
        setQuota("");
      }
      onAdded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#faf5e8] border border-[#f0e8d0] rounded-2xl p-4 space-y-3"
    >
      {error && (
        <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
          {error}
        </div>
      )}

      {/* Provider selector — only in add mode */}
      {!isEdit && (
        <div className="grid grid-cols-2 gap-2">
          {(["ark", "gemini"] as const).map((p) => {
            const meta = PROVIDER_META[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => { setProvider(p); setApiFormat(p); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  provider === p
                    ? "border-current text-white"
                    : "border-[#e8dfc8] text-[#a89070] hover:border-[#fa7025]"
                }`}
                style={provider === p ? { backgroundColor: meta.color, borderColor: meta.color } : {}}
              >
                <span>{meta.badge}</span>
                <span>{t(meta.labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* API Key — only in add mode */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-semibold text-[#a89070] mb-1 uppercase tracking-wide">
            {t("api_key")} <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t("api_key_placeholder")}
            className="w-full px-3 py-2 rounded-xl border border-[#e8dfc8] text-sm text-[#564337] focus:outline-none focus:ring-2 focus:ring-[#fa7025] bg-white"
            autoFocus
            required
          />
        </div>
      )}

      {/* Endpoint */}
      <div>
        <label className="block text-xs font-semibold text-[#a89070] mb-1 uppercase tracking-wide">
          {t("endpoint")}
        </label>
        <input
          type="url"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder={t("endpoint_placeholder")}
          className="w-full px-3 py-2 rounded-xl border border-[#e8dfc8] text-sm text-[#564337] focus:outline-none focus:ring-2 focus:ring-[#fa7025] bg-white"
        />
      </div>

      {/* Model + Quota row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[#a89070] mb-1 uppercase tracking-wide">
            {t("model_name")}
          </label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder={t("model_name_placeholder")}
            className="w-full px-3 py-2 rounded-xl border border-[#e8dfc8] text-sm text-[#564337] focus:outline-none focus:ring-2 focus:ring-[#fa7025] bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#a89070] mb-1 uppercase tracking-wide">
            {t("quota_rpm")}
          </label>
          <input
            type="number"
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            placeholder="500"
            min="1"
            className="w-full px-3 py-2 rounded-xl border border-[#e8dfc8] text-sm text-[#564337] focus:outline-none focus:ring-2 focus:ring-[#fa7025] bg-white"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm text-[#a89070] hover:bg-[#ede9cf] transition-colors"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={loading || (!isEdit && !apiKey.trim())}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#fa7025] hover:bg-[#e8651f] transition-colors disabled:opacity-50"
        >
          {loading ? "..." : isEdit ? t("save_btn") : t("add_provider_btn")}
        </button>
      </div>
    </form>
  );
}

interface ProviderCardProps {
  keyRecord: KeyRecord;
  onToggle: (id: number, enabled: boolean) => void;
  onDelete: (id: number) => void;
  onEdit: (key: KeyRecord) => void;
  toggling: boolean;
  deleting: boolean;
  editing: boolean;
  t: (key: string) => string;
}

function ProviderCard({ keyRecord: k, onToggle, onDelete, onEdit, toggling, deleting, editing, t }: ProviderCardProps) {
  const meta = PROVIDER_META[k.provider] ?? { labelKey: k.provider, color: "#888", badge: "⚙️" };
  const pct = k.quota > 0 ? Math.min(100, Math.round((k.windowUsed / k.quota) * 100)) : 0;
  const nearQuota = k.quota > 0 && pct >= 80;

  return (
    <div
      className={`bg-white rounded-2xl shadow-[0_2px_12px_rgba(86,67,55,0.06)] border border-[#f0e8d0] overflow-hidden transition-opacity ${
        !k.enabled ? "opacity-50" : "opacity-100"
      }`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0e8d0]">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: meta.color }}
          >
            {k.provider.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-[#564337]">{t(meta.labelKey)}</span>
          {nearQuota && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-50 text-red-500 font-semibold">
              ⚠ {t("near_quota")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Toggle enabled={k.enabled} onToggle={() => onToggle(k.id, k.enabled)} loading={toggling} />
          <button
            onClick={() => onEdit(k)}
            disabled={editing}
            className="text-xs text-[#a89070] hover:text-[#564337] px-2 py-1 rounded-lg hover:bg-[#f0e8d0] transition-colors"
          >
            {editing ? "..." : t("edit")}
          </button>
          <button
            onClick={() => onDelete(k.id)}
            disabled={deleting}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
          >
            {deleting ? "..." : t("delete_provider")}
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 space-y-2">
        {/* API Key */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#a89070] uppercase tracking-wide">{t("api_key")}</span>
          <span className="font-mono-custom text-sm text-[#564337]">{maskHash(k.keyHash)}</span>
        </div>

        {/* Endpoint */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#a89070] uppercase tracking-wide">{t("endpoint")}</span>
          <span className="font-mono-custom text-xs text-[#564337] truncate max-w-[200px]" title={k.endpoint || "—"}>
            {k.endpoint || "—"}
          </span>
        </div>

        {/* Model Name */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#a89070] uppercase tracking-wide">{t("model_name")}</span>
          <span className="font-mono-custom text-xs text-[#564337] truncate max-w-[200px]" title={k.modelName}>
            {k.modelName || "—"}
          </span>
        </div>
      </div>

      {/* Usage bar */}
      <div className="px-4 py-3 border-t border-[#f0e8d0] bg-[#faf5e8]">
        <UsageBar used={k.windowUsed} quota={k.quota} windowStart={k.windowStart} totalCalls={k.totalCalls} t={t} />
      </div>
    </div>
  );
}

export default function ProvidersClient() {
  const t = useT("admin_settings");
  const [activeAbility, setActiveAbility] = useState<Ability>("llm");
  const [grouped, setGrouped] = useState<GroupedKeys>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [toggling, setToggling] = useState<Record<number, boolean>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const [editingKey, setEditingKey] = useState<KeyRecord | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/keys");
      const data = await res.json();
      if (data.grouped) {
        setGrouped(data.grouped as GroupedKeys);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
    const interval = setInterval(fetchKeys, 60_000);
    return () => clearInterval(interval);
  }, [fetchKeys]);

  const handleToggle = async (id: number, currentEnabled: boolean) => {
    setToggling((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/admin/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: !currentEnabled }),
      });
      if (res.ok) {
        setGrouped((prev) => {
          const next = { ...prev };
          for (const ability of Object.keys(next)) {
            next[ability] = next[ability].map((k) =>
              k.id === id ? { ...k, enabled: !currentEnabled } : k
            );
          }
          return next;
        });
      }
    } finally {
      setToggling((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("delete_confirm"))) return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/keys?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setGrouped((prev) => {
          const next = { ...prev };
          for (const ability of Object.keys(next)) {
            next[ability] = next[ability].filter((k) => k.id !== id);
          }
          return next;
        });
      }
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleEdit = (key: KeyRecord) => {
    setEditingKey(key);
  };

  const keys = grouped[activeAbility] ?? [];

  return (
    <div className="space-y-5">
      {/* Ability tabs */}
      <div className="flex gap-1 bg-white rounded-full p-1 shadow-[0_4px_12px_rgba(86,67,55,0.08)] w-fit">
        {ABILITIES.map((a) => (
          <button
            key={a.key}
            onClick={() => { setActiveAbility(a.key); setShowAddForm(false); setEditingKey(null); }}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              activeAbility === a.key
                ? "text-white shadow-sm"
                : "text-[#a89070] hover:text-[#564337] hover:bg-[#f0e8d0]"
            }`}
            style={activeAbility === a.key ? { background: `linear-gradient(135deg, ${a.color}, ${a.color}dd)` } : {}}
          >
            <span>{a.icon}</span>
            <span>{t(`ability_${a.key}`)}</span>
          </button>
        ))}
      </div>

      {/* Ability section */}
      <div>
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-[#a89070] uppercase tracking-wide font-semibold">
            {keys.length} {keys.length === 1 ? t("provider_singular") : t("provider_plural")}
          </p>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${ABILITIES.find((a) => a.key === activeAbility)?.color ?? "#fa7025"}, ${ABILITIES.find((a) => a.key === activeAbility)?.color ?? "#fa7025"}dd)` }}
          >
            + {t("add_provider")}
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-4">
            <AddProviderForm
              ability={activeAbility}
              onClose={() => setShowAddForm(false)}
              onAdded={() => { setShowAddForm(false); fetchKeys(); }}
              t={t}
            />
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12 text-[#a89070] animate-pulse">{t("loading_keys")}</div>
        ) : keys.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-[#e8dfc8]">
            <p className="text-lg font-semibold text-[#a89070] mb-1">{t("no_keys")}</p>
            <p className="text-sm text-[#c8b898]">{t("add_first")}</p>
          </div>
        ) : (
          /* Provider cards grid */
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {keys.map((k) => (
              <ProviderCard
                key={k.id}
                keyRecord={k}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={handleEdit}
                toggling={!!toggling[k.id]}
                deleting={!!deleting[k.id]}
                editing={editingKey?.id === k.id}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Edit form — shown below cards when editing */}
        {editingKey && (
          <div className="mt-4">
            <AddProviderForm
              ability={editingKey.ability as Ability}
              editKey={editingKey}
              onClose={() => setEditingKey(null)}
              onAdded={() => { setEditingKey(null); fetchKeys(); }}
              t={t}
            />
          </div>
        )}
      </div>
    </div>
  );
}
