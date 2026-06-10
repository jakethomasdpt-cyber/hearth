import { NextResponse } from "next/server";
import { syncAllHouseholds } from "@/lib/teller-sync";

export const maxDuration = 120;

/**
 * Daily bank sync endpoint, hit by Vercel Cron (see vercel.json) or any
 * scheduler. Protected by CRON_SECRET:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/sync
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllHouseholds();
  return NextResponse.json({
    syncedAt: new Date().toISOString(),
    results,
  });
}
