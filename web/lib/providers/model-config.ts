/**
 * Model Configuration — persists per-provider, per-ability model name overrides.
 *
 * DB values take precedence over env vars (e.g. IMAGE_MODEL_ARK).
 * On server start, defaults are seeded from env vars if no DB row exists.
 */

import { db } from "@/lib/db";
import { providerModels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Env var defaults
// ---------------------------------------------------------------------------

/** Map: flat provider name → default model name for each ability */
const MODEL_ENV_MAP: Record<string, string> = {
  // Ark
  ark: process.env.LLM_MODEL_ARK ?? "ep-20260408230057-cgq9s",
  // Gemini
  gemini: process.env.LLM_MODEL_GEMINI ?? "gemini-3-flash-preview",
};

/** All known provider × ability combinations */
export const ALL_PROVIDER_ABILITIES: Array<{ provider: string; ability: string; label: string }> = [
  { provider: "ark", ability: "image", label: "Ark Image" },
  { provider: "ark", ability: "llm", label: "Ark LLM" },
  { provider: "ark", ability: "vision", label: "Ark Vision" },
  { provider: "gemini", ability: "image", label: "Gemini Image" },
  { provider: "gemini", ability: "llm", label: "Gemini LLM" },
  { provider: "gemini", ability: "vision", label: "Gemini Vision" },
];

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Get the default model name for a provider + ability from env vars.
 * Only LLM has a single env var; image/vision use hard-coded defaults.
 */
export function getModelName(provider: string, ability: string): string {
  return MODEL_ENV_MAP[provider] ?? "unknown";
}

/**
 * Set a custom model name (upsert). Pass empty string to clear custom value.
 */
export async function setModelConfig(
  provider: string,
  ability: string,
  modelName: string
): Promise<void> {
  if (!modelName) {
    // Clear — delete the DB row so env var is used
    await db
      .delete(providerModels)
      .where(and(eq(providerModels.provider, provider), eq(providerModels.ability, ability)));
    return;
  }

  await db
    .insert(providerModels)
    .values({ provider, ability, modelName, isDefault: false })
    .onConflictDoUpdate({
      target: [providerModels.provider, providerModels.ability],
      set: { modelName, updatedAt: new Date() },
    });
}

/** List all model configs from DB, with env-default for each combo */
export async function listModelConfigs(): Promise<
  Array<{
    id: number;
    provider: string;
    ability: string;
    modelName: string;
    isDefault: boolean;
    updatedAt: Date;
    envDefault: string;
  }>
> {
  const rows = await db.select().from(providerModels).orderBy(providerModels.provider);
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    ability: row.ability,
    modelName: row.modelName,
    isDefault: Boolean(row.isDefault),
    updatedAt: row.updatedAt,
    envDefault: getModelName(row.provider, row.ability),
  }));
}

/**
 * Initialize model config from env vars (idempotent — only inserts if missing).
 * Called on server start.
 */
const MODEL_ENV_DEFAULTS: Array<{ provider: string; ability: string; envKey: string; fallback: string }> = [
  { provider: "ark", ability: "image", envKey: "IMAGE_MODEL_ARK", fallback: "doubao-seedream-5-0-260128" },
  { provider: "ark", ability: "llm", envKey: "LLM_MODEL_ARK", fallback: "ep-20260408230057-cgq9s" },
  { provider: "ark", ability: "vision", envKey: "VISION_MODEL_ARK", fallback: "ep-20260408230057-cgq9s" },
  { provider: "gemini", ability: "image", envKey: "IMAGE_MODEL_GEMINI", fallback: "gemini-3.1-flash-image-preview" },
  { provider: "gemini", ability: "llm", envKey: "LLM_MODEL_GEMINI", fallback: "gemini-3-flash-preview" },
  { provider: "gemini", ability: "vision", envKey: "VISION_MODEL_GEMINI", fallback: "gemini-2.0-flash" },
];

export async function initModelConfigFromEnv(): Promise<void> {
  for (const { provider, ability, envKey, fallback } of MODEL_ENV_DEFAULTS) {
    const defaultModel = process.env[envKey] ?? fallback;

    const existing = await db
      .select({ id: providerModels.id })
      .from(providerModels)
      .where(and(eq(providerModels.provider, provider), eq(providerModels.ability, ability)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(providerModels).values({
        provider,
        ability,
        modelName: defaultModel,
        isDefault: true,
      }).onConflictDoNothing();
    }
  }
}

// Auto-init on first import (idempotent, one per process)
const _alreadyInit = (globalThis as Record<string, unknown>).__clawplay_model_config_init as Promise<void> | undefined;
if (!_alreadyInit) {
  const p = initModelConfigFromEnv();
  (globalThis as Record<string, unknown>).__clawplay_model_config_init = p;
  p.catch((err: unknown) => console.error("[model-config] init failed:", err));
}
