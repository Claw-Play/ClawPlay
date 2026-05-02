"use client";
import { useState, useEffect, useCallback } from "react";
import { useT } from "@/lib/i18n/context";
import { EyeIcon, ImageIcon, MessageIcon, PencilIcon, SettingsIcon, TrashIcon, WarningIcon } from "@/components/icons";

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

const ABILITIES: { key: Ability; icon: typeof MessageIcon; color: string }[] = [
  { key: "llm", icon: MessageIcon, color: "#2d67f7" },
  { key: "image", icon: ImageIcon, color: "#2d67f7" },
  { key: "vision", icon: EyeIcon, color: "#2d67f7" },
];

const PROVIDER_META: Record<string, { labelKey: string; color: string; badge: string }> = {
  ark: { labelKey: "provider_ark", color: "#2d67f7", badge: "ark" },
  gemini: { labelKey: "provider_gemini", color: "#4285f4", badge: "gemini" },
};

function UsageBar({ used, quota, windowStart, totalCalls, t }: { used: number; quota: number; windowStart: number; totalCalls: number; t: (key: string) => string }) {
  // windowStart is Unix seconds; compare against current minute boundary
  const nowMinute = Math.floor(Date.now() / 60000);
  const windowMinute = Math.floor(windowStart / 60);
  const effectiveUsed = windowMinute < nowMinute ? 0 : used;
  const pct = quota > 0 ? Math.min(100, Math.round((effectiveUsed / quota) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-[999px] bg-[#e7eefc]">
          <div
            className="h-full rounded-[999px] bg-[#c9dafd] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="min-w-[126px] whitespace-nowrap text-right font-mono-custom text-[13px] text-[#6d7891]">
          {effectiveUsed.toLocaleString()} / {quota.toLocaleString()} <span className="text-[#2d67f7]">{t("per_minute")}</span>
        </span>
      </div>
      <div className="flex justify-end">
        <span className="font-mono-custom text-[12px] text-[#6d7891]">
          {t("total_calls")}: <span className="text-[#52617d]">{totalCalls.toLocaleString()}</span>
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
      className={`relative w-10 h-6 rounded-[999px] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
        enabled ? "bg-[#2d67f7] focus:ring-[#2d67f7]" : "bg-[#dbe5f7] focus:ring-[#dbe5f7]"
      }`}
    >
      <div
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(25,43,87,0.18)] transition-transform duration-200 ${
          enabled ? "translate-x-[18px]" : "translate-x-0.5"
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
      className="bg-[#f7faff] border border-[#dbe5f7] rounded-[12px] p-4 space-y-3"
    >
      {error && (
        <div className="px-3 py-2 rounded-[8px] bg-red-50 border border-red-200 text-red-600 text-xs">
          {error}
        </div>
      )}

      {/* Provider selector — only in add mode */}
      {!isEdit && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(["ark", "gemini"] as const).map((p) => {
            const meta = PROVIDER_META[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => { setProvider(p); setApiFormat(p); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-[8px] border-2 text-sm font-semibold transition-all ${
                  provider === p
                    ? "border-current text-white"
                    : "border-[#dbe5f7] text-[#6d7891] hover:border-[#2d67f7]"
                }`}
                style={provider === p ? { backgroundColor: meta.color, borderColor: meta.color } : {}}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>{t(meta.labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* API Key — only in add mode */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-semibold text-[#6d7891] mb-1 uppercase tracking-wide">
            {t("api_key")} <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t("api_key_placeholder")}
            className="w-full px-3 py-2 rounded-[8px] border border-[#dbe5f7] text-sm text-[#15213b] focus:outline-none focus:ring-2 focus:ring-[#2d67f7] bg-white"
            autoFocus
            required
          />
        </div>
      )}

      {/* Endpoint */}
      <div>
        <label className="block text-xs font-semibold text-[#6d7891] mb-1 uppercase tracking-wide">
          {t("endpoint")}
        </label>
        <input
          type="url"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder={t("endpoint_placeholder")}
          className="w-full px-3 py-2 rounded-[8px] border border-[#dbe5f7] text-sm text-[#15213b] focus:outline-none focus:ring-2 focus:ring-[#2d67f7] bg-white"
        />
      </div>

      {/* Model + Quota row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-[#6d7891] mb-1 uppercase tracking-wide">
            {t("model_name")}
          </label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder={t("model_name_placeholder")}
            className="w-full px-3 py-2 rounded-[8px] border border-[#dbe5f7] text-sm text-[#15213b] focus:outline-none focus:ring-2 focus:ring-[#2d67f7] bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#6d7891] mb-1 uppercase tracking-wide">
            {t("quota_rpm")}
          </label>
          <input
            type="number"
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            placeholder="500"
            min="1"
            className="w-full px-3 py-2 rounded-[8px] border border-[#dbe5f7] text-sm text-[#15213b] focus:outline-none focus:ring-2 focus:ring-[#2d67f7] bg-white"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse items-stretch gap-2 pt-1 sm:flex-row sm:justify-end sm:items-center">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-4 py-2 rounded-[8px] text-sm text-[#6d7891] hover:bg-[#eef4ff] transition-colors"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={loading || (!isEdit && !apiKey.trim())}
          className="min-h-11 px-5 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2d67f7] hover:bg-[#2457d4] transition-colors disabled:opacity-50"
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
  const meta = PROVIDER_META[k.provider] ?? { labelKey: k.provider, color: "#888", badge: "default" };
  const pct = k.quota > 0 ? Math.min(100, Math.round((k.windowUsed / k.quota) * 100)) : 0;
  const nearQuota = k.quota > 0 && pct >= 80;

  return (
    <div
      className={`overflow-hidden rounded-[16px] border border-[#dbe5f7] bg-white shadow-[0_2px_12px_rgba(25,43,87,0.04)] transition-opacity ${
        !k.enabled ? "opacity-50" : "opacity-100"
      }`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#dbe5f7] px-4 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white text-xs font-bold"
            style={{ backgroundColor: meta.color }}
          >
            {k.provider.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-[#15213b]">{t(meta.labelKey)}</span>
          {nearQuota && (
            <span className="inline-flex items-center gap-1 rounded-[999px] bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-500">
              <WarningIcon className="w-3 h-3" /> {t("near_quota")}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:gap-3">
          <Toggle enabled={k.enabled} onToggle={() => onToggle(k.id, k.enabled)} loading={toggling} />
          <button
            onClick={() => onEdit(k)}
            disabled={editing}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-xs text-[#6d7891] transition-colors hover:bg-[#f4f7fd] hover:text-[#15213b]"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            {editing ? "..." : t("edit")}
          </button>
          <button
            onClick={() => onDelete(k.id)}
            disabled={deleting}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-xs text-[#ff6b6b] transition-colors hover:bg-red-50 hover:text-[#ef4444]"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            {deleting ? "..." : t("delete_provider")}
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="space-y-2 px-4 py-3">
        {/* API Key */}
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 whitespace-nowrap text-xs text-[#6d7891] uppercase tracking-wide">{t("api_key")}</span>
          <span className="min-w-0 truncate font-mono-custom text-sm text-[#15213b]">{maskHash(k.keyHash)}</span>
        </div>

        {/* Endpoint */}
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 whitespace-nowrap text-xs text-[#6d7891] uppercase tracking-wide">{t("endpoint")}</span>
          <span className="min-w-0 max-w-[220px] truncate font-mono-custom text-xs text-[#15213b]" title={k.endpoint || "—"}>
            {k.endpoint || "—"}
          </span>
        </div>

        {/* Model Name */}
        <div className="flex items-center justify-between gap-3">
          <span className="shrink-0 whitespace-nowrap text-xs text-[#6d7891] uppercase tracking-wide">{t("model_name")}</span>
          <span className="min-w-0 max-w-[220px] truncate font-mono-custom text-xs text-[#15213b]" title={k.modelName}>
            {k.modelName || "—"}
          </span>
        </div>
      </div>

      {/* Usage bar */}
      <div className="border-t border-[#dbe5f7] bg-[#f7faff] px-4 py-3">
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
      <div className="flex gap-1 bg-white rounded-[8px] p-1 shadow-[0_4px_12px_rgba(25,43,87,0.04)] w-full overflow-x-auto sm:w-fit">
        {ABILITIES.map((a) => (
          <button
            key={a.key}
            onClick={() => { setActiveAbility(a.key); setShowAddForm(false); setEditingKey(null); }}
            className={`flex min-h-11 items-center gap-1.5 px-4 sm:px-5 py-2 rounded-[8px] text-sm font-semibold transition-all whitespace-nowrap ${
              activeAbility === a.key
                ? "bg-[#edf4ff] text-[#2d67f7] shadow-[inset_0_0_0_1px_rgba(45,103,247,0.14)]"
                : "text-[#6d7891] hover:text-[#15213b] hover:bg-[#dbe5f7]"
            }`}
          >
            <a.icon className="w-4 h-4" />
            <span>{t(`ability_${a.key}`)}</span>
          </button>
        ))}
      </div>

      {/* Ability section */}
      <div>
        {/* Section header */}
        <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#6d7891] uppercase tracking-wide font-semibold">
            {keys.length} {keys.length === 1 ? t("provider_singular") : t("provider_plural")}
          </p>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex min-h-11 items-center justify-center px-4 py-1.5 rounded-[8px] text-sm font-semibold text-white transition-all hover:opacity-90 w-full sm:w-auto"
            style={{ background: `linear-gradient(135deg, ${ABILITIES.find((a) => a.key === activeAbility)?.color ?? "#2d67f7"}, ${ABILITIES.find((a) => a.key === activeAbility)?.color ?? "#2d67f7"}dd)` }}
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
          <div className="text-center py-12 text-[#6d7891] animate-pulse">{t("loading_keys")}</div>
        ) : keys.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-[12px] border border-dashed border-[#dbe5f7]">
            <p className="text-lg font-semibold text-[#6d7891] mb-1">{t("no_keys")}</p>
            <p className="text-sm text-[#98a3bc]">{t("add_first")}</p>
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
