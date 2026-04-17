import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { providerKeys } from "@/lib/db/schema";
import { getAuthFromCookies } from "@/lib/auth";
import { addProviderKey, listProviderKeys, removeProviderKey, toggleProviderKey } from "@/lib/providers/key-pool";
import { getT } from "@/lib/i18n";

/**
 * Admin API for managing provider API keys.
 *
 * GET  /api/admin/keys?ability=llm      — list keys for an ability
 * POST /api/admin/keys                   — add a new key
 * PATCH /api/admin/keys                 — toggle enabled state
 * DELETE /api/admin/keys?id=...          — soft-delete a key by id
 */

const VALID_PROVIDERS = ["ark", "gemini"] as const;
const VALID_ABILITIES = ["llm", "image", "vision"] as const;

export async function GET(request: Request) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  if (auth.role !== "admin") return NextResponse.json({ error: t("forbidden") }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const ability = searchParams.get("ability");

  if (ability && !VALID_ABILITIES.includes(ability as typeof VALID_ABILITIES[number])) {
    return NextResponse.json(
      { error: t("invalid_ability", { abilities: VALID_ABILITIES.join(", ") }) },
      { status: 400 }
    );
  }

  const keys = await listProviderKeys(ability ?? undefined);

  // Group by ability
  const grouped: Record<string, typeof keys> = {};
  for (const key of keys) {
    if (!grouped[key.ability]) grouped[key.ability] = [];
    grouped[key.ability].push(key);
  }

  return NextResponse.json({ keys, grouped });
}

export async function POST(request: Request) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  if (auth.role !== "admin") return NextResponse.json({ error: t("forbidden") }, { status: 403 });

  let body: {
    provider?: string;
    ability?: string;
    key?: string;
    endpoint?: string;
    apiFormat?: string;
    modelName?: string;
    quota?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("invalid_json_body") }, { status: 400 });
  }

  const { provider, ability, key, endpoint, apiFormat, modelName, quota } = body;

  if (!provider || !ability || !key) {
    return NextResponse.json(
      { error: t("missing_required_fields", { fields: "provider, ability, key" }) },
      { status: 400 }
    );
  }

  if (!VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
    return NextResponse.json(
      { error: t("invalid_provider", { providers: VALID_PROVIDERS.join(", ") }) },
      { status: 400 }
    );
  }

  if (!VALID_ABILITIES.includes(ability as typeof VALID_ABILITIES[number])) {
    return NextResponse.json(
      { error: t("invalid_ability", { abilities: VALID_ABILITIES.join(", ") }) },
      { status: 400 }
    );
  }

  if (quota !== undefined && (typeof quota !== "number" || quota <= 0)) {
    return NextResponse.json({ error: t("quota_must_be_positive") }, { status: 400 });
  }

  try {
    const id = await addProviderKey(provider, ability, key, {
      endpoint: endpoint || undefined,
      apiFormat: apiFormat || undefined,
      modelName: modelName || undefined,
      quota: quota ?? 500,
    });
    return NextResponse.json({ ok: true, id, message: t("key_added", { provider, ability }) }, { status: 201 });
  } catch (err: unknown) {
    const errStr = String(err);
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr?.code === "DUPLICATE_KEY" || errStr.includes("Duplicate key")) {
      return NextResponse.json({ error: t("key_already_exists") }, { status: 409 });
    }
    console.error("[admin/keys] addProviderKey error:", err);
    return NextResponse.json({ error: t("failed_to_add_key") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  if (auth.role !== "admin") return NextResponse.json({ error: t("forbidden") }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: t("missing_query_param", { param: "id" }) }, { status: 400 });
  }

  const keyId = parseInt(id, 10);
  if (isNaN(keyId)) {
    return NextResponse.json({ error: t("invalid_id") }, { status: 400 });
  }

  try {
    await removeProviderKey(keyId);
    return NextResponse.json({ ok: true, message: t("key_revoked", { id: String(keyId) }) });
  } catch (err) {
    console.error("[admin/keys] removeProviderKey error:", err);
    return NextResponse.json({ error: t("failed_to_revoke_key") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  if (auth.role !== "admin") return NextResponse.json({ error: t("forbidden") }, { status: 403 });

  let body: {
    id?: number;
    enabled?: boolean;
    endpoint?: string;
    apiFormat?: string;
    modelName?: string;
    quota?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("invalid_json_body") }, { status: 400 });
  }

  const { id, enabled, endpoint, apiFormat, modelName, quota } = body;

  // Full update: id + any of endpoint/apiFormat/modelName/quota
  if (typeof id !== "number") {
    return NextResponse.json({ error: t("invalid_id") }, { status: 400 });
  }

  // If enabled is present but not a boolean → 400
  if (enabled !== undefined && typeof enabled !== "boolean") {
    return NextResponse.json({ error: t("id_and_enabled_required") }, { status: 400 });
  }

  // If only toggling enabled state (no other fields)
  if (typeof id === "number" && typeof enabled === "boolean" && Object.keys(body).length === 2) {
    try {
      await toggleProviderKey(id, enabled);
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[admin/keys] toggleProviderKey error:", err);
      return NextResponse.json({ error: t("failed_to_toggle_key") }, { status: 500 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (endpoint !== undefined) updates.endpoint = endpoint;
  if (apiFormat !== undefined) updates.apiFormat = apiFormat;
  if (modelName !== undefined) updates.modelName = modelName;
  if (quota !== undefined) {
    if (typeof quota !== "number" || quota <= 0) {
      return NextResponse.json({ error: t("quota_must_be_positive") }, { status: 400 });
    }
    updates.quota = quota;
  }

  // No fields to update
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: t("id_and_enabled_required") }, { status: 400 });
  }

  try {
    await db.update(providerKeys).set(updates).where(eq(providerKeys.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/keys] update key error:", err);
    return NextResponse.json({ error: t("failed_to_update_key") }, { status: 500 });
  }
}
