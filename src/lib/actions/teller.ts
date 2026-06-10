"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, tellerEnrollments } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { syncHousehold, type SyncResult } from "@/lib/teller-sync";

const enrollmentSchema = z.object({
  accessToken: z.string().min(1),
  enrollmentId: z.string().min(1),
  institutionName: z.string().min(1),
});

/** Called from Teller Connect's onSuccess with the enrollment payload. */
export async function completeTellerEnrollment(input: {
  accessToken: string;
  enrollmentId: string;
  institutionName: string;
}): Promise<{ results?: SyncResult[]; error?: string }> {
  const { householdId, userId } = await getHouseholdContext();
  const parsed = enrollmentSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid enrollment data from Teller." };

  const existing = await db.query.tellerEnrollments.findFirst({
    where: and(
      eq(tellerEnrollments.householdId, householdId),
      eq(tellerEnrollments.enrollmentId, parsed.data.enrollmentId)
    ),
  });

  if (existing) {
    // Re-link / re-auth: refresh the token and reactivate
    await db
      .update(tellerEnrollments)
      .set({ accessToken: parsed.data.accessToken, status: "active" })
      .where(eq(tellerEnrollments.id, existing.id));
  } else {
    await db.insert(tellerEnrollments).values({
      householdId,
      accessToken: parsed.data.accessToken,
      enrollmentId: parsed.data.enrollmentId,
      institutionName: parsed.data.institutionName,
      linkedByUserId: userId,
    });
  }

  const results = await syncHousehold(householdId);
  revalidatePath("/", "layout");
  return { results };
}

export async function syncNow(): Promise<{ results: SyncResult[] }> {
  const { householdId } = await getHouseholdContext();
  const results = await syncHousehold(householdId);
  revalidatePath("/", "layout");
  return { results };
}

/**
 * Unlinks an institution. Synced accounts and their transactions are kept
 * (they become manual accounts) — they just stop updating.
 */
export async function unlinkEnrollment(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const id = String(formData.get("enrollmentId"));

  await db
    .update(accounts)
    .set({ tellerEnrollmentId: null, tellerAccountId: null })
    .where(
      and(eq(accounts.tellerEnrollmentId, id), eq(accounts.householdId, householdId))
    );
  await db
    .delete(tellerEnrollments)
    .where(
      and(eq(tellerEnrollments.id, id), eq(tellerEnrollments.householdId, householdId))
    );

  revalidatePath("/", "layout");
}
