import { NextResponse } from "next/server";
import { resetKeyWindow } from "@/lib/providers/key-pool";

/**
 * Cron endpoint to reset all key window counters every minute.
 *
 * Called by Upstash QStash, Cloudflare Cron, or any cron scheduler.
 * Set up a recurring job: every 1 minute → GET /api/cron/reset-keys
 *
 * Optionally pass ?provider=ark_image to reset only a specific provider.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") ?? undefined;

  // Basic secret check to prevent unauthorized resets
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await resetKeyWindow(provider);
    return NextResponse.json({ ok: true, provider: provider ?? "all" });
  } catch (err) {
    console.error("[cron/reset-keys] error:", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
