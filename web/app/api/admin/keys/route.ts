import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { addProviderKey, listProviderKeys, removeProviderKey } from "@/lib/providers/key-pool";

/**
 * Admin API for managing provider API keys.
 *
 * GET  /api/admin/keys?provider=ark_image  — list keys (no plaintext)
 * POST /api/admin/keys                     — add a new key
 * DELETE /api/admin/keys                   — revoke a key by hash
 */

export async function GET(request: Request) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  if (!provider) {
    return NextResponse.json(
      { error: "Missing required query param: provider" },
      { status: 400 }
    );
  }

  const keys = await listProviderKeys(provider);
  return NextResponse.json({ provider, keys });
}

export async function POST(request: Request) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: { provider?: string; key?: string; quota?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { provider, key, quota } = body;
  if (!provider || !key) {
    return NextResponse.json(
      { error: "Missing required fields: provider, key" },
      { status: 400 }
    );
  }

  // Validate provider
  const validProviders = ["ark_image", "ark_vision", "gemini_image", "gemini_vision"];
  if (!validProviders.includes(provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
      { status: 400 }
    );
  }

  if (quota !== undefined && (typeof quota !== "number" || quota <= 0)) {
    return NextResponse.json(
      { error: "quota must be a positive number" },
      { status: 400 }
    );
  }

  try {
    const id = await addProviderKey(provider, key, quota ?? 500);
    return NextResponse.json({ ok: true, id, message: `Key added for ${provider}` }, { status: 201 });
  } catch (err: unknown) {
    const errStr = String(err);
    const nodeErr = err as NodeJS.ErrnoException;
    // Pre-check duplicate (explicit check in addProviderKey)
    if (
      nodeErr?.code === "DUPLICATE_KEY" ||
      errStr.includes("Duplicate key hash") ||
      errStr.includes("UNIQUE")
    ) {
      return NextResponse.json({ error: "This key already exists." }, { status: 409 });
    }
    console.error("[admin/keys] addProviderKey error:", err);
    return NextResponse.json({ error: (err as Error)?.message ?? "Failed to add key" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthFromCookies();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const keyHash = searchParams.get("keyHash");

  if (!provider || !keyHash) {
    return NextResponse.json(
      { error: "Missing required query params: provider, keyHash" },
      { status: 400 }
    );
  }

  try {
    await removeProviderKey(provider, keyHash);
    return NextResponse.json({ ok: true, message: `Key ${keyHash.slice(0, 8)}... revoked` });
  } catch (err: unknown) {
    console.error("[admin/keys] removeProviderKey error:", err);
    return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
  }
}
