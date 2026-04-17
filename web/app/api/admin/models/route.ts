import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { listModelConfigs, setModelConfig, ALL_PROVIDER_ABILITIES } from "@/lib/providers/model-config";
import { getT } from "@/lib/i18n";

/**
 * Admin API for managing per-provider, per-ability model name configurations.
 *
 * GET  /api/admin/models               — list all model configs
 * POST /api/admin/models               — set a model name { provider, ability, modelName }
 * DELETE /api/admin/models?provider=...&ability=... — clear a model config
 */

export async function GET() {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  if (auth.role !== "admin") return NextResponse.json({ error: t("forbidden") }, { status: 403 });

  try {
    const configs = await listModelConfigs();
    return NextResponse.json({ configs });
  } catch (err) {
    console.error("[admin/models] GET error:", err);
    return NextResponse.json({ error: t("model_list_failed") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  if (auth.role !== "admin") return NextResponse.json({ error: t("forbidden") }, { status: 403 });

  let body: { provider?: string; ability?: string; modelName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: t("invalid_json_body") }, { status: 400 });
  }

  const { provider, ability, modelName } = body;
  if (!provider || !ability || modelName === undefined) {
    return NextResponse.json(
      { error: t("missing_required_fields", { fields: "provider, ability, modelName" }) },
      { status: 400 }
    );
  }

  const validCombos = ALL_PROVIDER_ABILITIES.map((a) => `${a.provider}:${a.ability}`);
  if (!validCombos.includes(`${provider}:${ability}`)) {
    return NextResponse.json(
      { error: t("invalid_provider", { providers: validCombos.join(", ") }) },
      { status: 400 }
    );
  }

  try {
    await setModelConfig(provider, ability, modelName);
    return NextResponse.json({ ok: true, message: t("model_updated", { provider, ability }) });
  } catch (err) {
    console.error("[admin/models] POST error:", err);
    return NextResponse.json({ error: t("model_set_failed") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const t = await getT("errors");
  const auth = await getAuthFromCookies();
  if (!auth) return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
  if (auth.role !== "admin") return NextResponse.json({ error: t("forbidden") }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const ability = searchParams.get("ability");

  if (!provider || !ability) {
    return NextResponse.json({ error: t("missing_required_fields", { fields: "provider, ability" }) }, { status: 400 });
  }

  try {
    await setModelConfig(provider, ability, "");
    return NextResponse.json({ ok: true, message: t("model_reset", { provider, ability }) });
  } catch (err) {
    console.error("[admin/models] DELETE error:", err);
    return NextResponse.json({ error: t("model_reset_failed") }, { status: 500 });
  }
}
