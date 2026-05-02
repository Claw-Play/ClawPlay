"use client";
import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n/context";

interface ModelConfigRecord {
  id: number;
  provider: string;
  ability: string;
  modelName: string;
  isDefault: boolean;
  updatedAt: string;
  envDefault: string;
}

const PROVIDER_GROUPS = [
  { key: "ark", label: "Ark", color: "#2d67f7", abilities: ["image", "llm", "vision"] },
  { key: "gemini", label: "Gemini", color: "#2d67f7", abilities: ["image", "llm", "vision"] },
];

const ABILITY_LABELS: Record<string, string> = {
  image: "ability_image",
  llm: "ability_llm",
  vision: "ability_vision",
};

function getProviderAbilityKey(provider: string, ability: string): string {
  return `${provider}_${ability}`;
}

export default function ModelsClient() {
  const t = useT("admin_settings");
  const [configs, setConfigs] = useState<Record<string, ModelConfigRecord>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [resetting, setResetting] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        const map: Record<string, ModelConfigRecord> = {};
        for (const c of data.configs ?? []) {
          map[getProviderAbilityKey(c.provider, c.ability)] = c;
        }
        setConfigs(map);
        // Initialize editing state with current model names
        const init: Record<string, string> = {};
        for (const c of data.configs ?? []) {
          init[getProviderAbilityKey(c.provider, c.ability)] = c.modelName;
        }
        setEditing(init);
      })
      .catch(() => setError("Failed to load model configs."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (provider: string, ability: string) => {
    const key = getProviderAbilityKey(provider, ability);
    const modelName = editing[key] ?? "";
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ability, modelName }),
      });
      if (res.ok) {
        setConfigs((prev) => ({
          ...prev,
          [key]: prev[key]
            ? { ...prev[key], modelName }
            : { id: 0, provider, ability, modelName, isDefault: false, updatedAt: new Date().toISOString(), envDefault: "" },
        }));
      }
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleReset = async (provider: string, ability: string) => {
    const key = getProviderAbilityKey(provider, ability);
    const envDefault = configs[key]?.envDefault ?? "";
    setResetting((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/admin/models?provider=${provider}&ability=${ability}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEditing((prev) => ({ ...prev, [key]: envDefault }));
        setConfigs((prev) => {
          const next = { ...prev };
          if (next[key]) {
            next[key] = { ...next[key], modelName: envDefault, isDefault: true };
          }
          return next;
        });
      }
    } finally {
      setResetting((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-[#6d7891] font-body animate-pulse">{t("loading") || "Loading..."}</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-[#e53e3e] font-body">{error}</div>;
  }

  return (
    <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-[0_8px_24px_rgba(25,43,87,0.04)] overflow-hidden">
      <div className="grid gap-3 p-4 md:hidden">
        {PROVIDER_GROUPS.flatMap((pg) =>
          pg.abilities.map((ability) => {
            const key = getProviderAbilityKey(pg.key, ability);
            const config = configs[key];
            const currentName = editing[key] ?? config?.modelName ?? "";
            const envDefault = config?.envDefault ?? "";
            const isCustom = config && !config.isDefault;
            const isSaving = !!saving[key];
            const isResetting = !!resetting[key];

            return (
              <div key={key} className="rounded-[24px] border border-[#dbe5f7] bg-[#f7faff] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded bg-[#2d67f710] flex items-center justify-center text-xs font-bold" style={{ color: pg.color }}>
                      {pg.label.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#15213b]">{pg.label}</p>
                      <p className="text-xs text-[#6d7891]">{t(ABILITY_LABELS[ability])}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono-custom text-[#6d7891]">{envDefault || "—"}</span>
                </div>

                <input
                  type="text"
                  value={currentName}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-[8px] border border-[#dbe5f7] text-sm font-mono-custom text-[#15213b] focus:outline-none focus:ring-2 focus:ring-[#2d67f7] bg-white"
                  placeholder={envDefault || t("type_here")}
                />

                {isCustom && (
                  <span className="inline-flex w-fit px-1.5 py-0.5 rounded-[8px] text-xs bg-[#2d67f710] text-[#2d67f7] whitespace-nowrap">
                    {t("custom_model")}
                  </span>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSave(pg.key, ability)}
                    disabled={isSaving || isResetting || currentName === config?.modelName}
                    className="min-h-11 px-4 py-2 rounded-[8px] text-xs font-semibold font-body text-white bg-[#2d67f7] hover:bg-[#2457d4] transition-colors disabled:opacity-40"
                  >
                    {isSaving ? "..." : t("save")}
                  </button>
                  <button
                    onClick={() => handleReset(pg.key, ability)}
                    disabled={isResetting || isSaving || !config}
                    className="min-h-11 px-4 py-2 rounded-[8px] text-xs font-semibold font-body text-[#6d7891] bg-[#dbe5f7] hover:bg-[#dbe5f7] transition-colors disabled:opacity-40"
                  >
                    {isResetting ? "..." : t("reset")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-[#dbe5f7] text-left">
              <th className="px-4 py-3 text-xs text-[#6d7891] font-semibold">{t("provider")}</th>
              <th className="px-4 py-3 text-xs text-[#6d7891] font-semibold">{t("ability")}</th>
              <th className="px-4 py-3 text-xs text-[#6d7891] font-semibold">{t("model_name")}</th>
              <th className="px-4 py-3 text-xs text-[#6d7891] font-semibold">{t("default_model")}</th>
              <th className="px-4 py-3 text-xs text-[#6d7891] font-semibold w-48">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {PROVIDER_GROUPS.map((pg) =>
              pg.abilities.map((ability) => {
                const key = getProviderAbilityKey(pg.key, ability);
                const config = configs[key];
                const currentName = editing[key] ?? config?.modelName ?? "";
                const envDefault = config?.envDefault ?? "";
                const isCustom = config && !config.isDefault;
                const isSaving = !!saving[key];
                const isResetting = !!resetting[key];

                return (
                  <tr key={key} className="border-b border-[#dbe5f7] hover:bg-[#f7faff] transition-colors">
                    {/* Provider */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#2d67f710] flex items-center justify-center text-xs font-bold" style={{ color: pg.color }}>
                          {pg.label.slice(0, 2)}
                        </div>
                        <span className="text-sm font-semibold text-[#15213b]">{pg.label}</span>
                      </div>
                    </td>

                    {/* Ability */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#6d7891]">
                        {(ABILITY_LABELS[ability] as unknown as string)}
                      </span>
                    </td>

                    {/* Model name input */}
                    <td className="px-4 py-3 min-w-64">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={currentName}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="flex-1 px-3 py-1.5 rounded-[8px] border border-[#dbe5f7] text-sm font-mono-custom text-[#15213b] focus:outline-none focus:ring-2 focus:ring-[#2d67f7] bg-white"
                          placeholder={envDefault || t("type_here")}
                        />
                        {isCustom && (
                          <span className="px-1.5 py-0.5 rounded-[8px] text-xs bg-[#2d67f710] text-[#2d67f7] whitespace-nowrap">
                            {t("custom_model")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Default */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono-custom text-[#6d7891]">{envDefault || "—"}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave(pg.key, ability)}
                          disabled={isSaving || isResetting || currentName === config?.modelName}
                          className="px-3 py-1.5 rounded-[8px] text-xs font-semibold font-body text-white bg-[#2d67f7] hover:bg-[#2457d4] transition-colors disabled:opacity-40"
                        >
                          {isSaving ? "..." : t("save")}
                        </button>
                        <button
                          onClick={() => handleReset(pg.key, ability)}
                          disabled={isResetting || isSaving || !config}
                          className="px-3 py-1.5 rounded-[8px] text-xs font-semibold font-body text-[#6d7891] bg-[#dbe5f7] hover:bg-[#dbe5f7] transition-colors disabled:opacity-40"
                        >
                          {isResetting ? "..." : t("reset")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
