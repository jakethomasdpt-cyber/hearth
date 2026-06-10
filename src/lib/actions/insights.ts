"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savingsInsights } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { detectSubscriptions, generateInsights } from "@/lib/intelligence";

/** Re-scans transactions for subscriptions and regenerates insights. */
export async function runSavingsScan() {
  const { householdId } = await getHouseholdContext();
  await detectSubscriptions(householdId);
  await generateInsights(householdId);
  revalidatePath("/", "layout");
}

export async function updateInsightStatus(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const id = String(formData.get("insightId"));
  const status = String(formData.get("status"));
  if (status !== "done" && status !== "dismissed" && status !== "open") return;

  await db
    .update(savingsInsights)
    .set({ status })
    .where(
      and(eq(savingsInsights.id, id), eq(savingsInsights.householdId, householdId))
    );

  revalidatePath("/", "layout");
}
