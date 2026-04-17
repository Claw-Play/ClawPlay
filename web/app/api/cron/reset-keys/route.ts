/**
 * Cron endpoint: resets all key windows.
 *
 * Used by:
 * 1. Local/server cron: first request triggers startCronTimer() which schedules
 *    resetKeyWindow() every 60s via setInterval
 * 2. Upstash QStash (serverless): calls this endpoint every minute
 *
 * GET is for manual/debug use; QStash sends POST.
 */
import { NextResponse } from "next/server";
import { startCronTimer } from "@/lib/cron";
import { resetKeyWindow } from "@/lib/providers/key-pool";

export async function GET() {
  // Start timer on first call (singleton, no-op if already running)
  startCronTimer();

  try {
    await resetKeyWindow();
    return NextResponse.json({ ok: true, reset: Date.now() });
  } catch (err) {
    console.error("[cron/reset-keys] error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  startCronTimer();

  try {
    await resetKeyWindow();
    return NextResponse.json({ ok: true, reset: Date.now() });
  } catch (err) {
    console.error("[cron/reset-keys] POST error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
