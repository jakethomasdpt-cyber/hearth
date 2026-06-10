"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sum, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, netWorthSnapshots, LIABILITY_TYPES } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { dollarsToCents } from "@/lib/format";

const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "checking",
    "savings",
    "investment",
    "credit_card",
    "loan",
    "property",
    "other",
  ]),
  institution: z.string().optional(),
  balance: z.string(),
});

export async function createAccount(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const parsed = accountSchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    institution: formData.get("institution") || undefined,
    balance: formData.get("balance") || "0",
  });

  await db.insert(accounts).values({
    householdId,
    name: parsed.name,
    type: parsed.type,
    institution: parsed.institution,
    balanceCents: Math.abs(dollarsToCents(parsed.balance)),
    isLiability: (LIABILITY_TYPES as readonly string[]).includes(parsed.type),
  });

  await snapshotNetWorth(householdId);
  revalidatePath("/", "layout");
}

export async function updateAccountBalance(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const accountId = String(formData.get("accountId"));
  const balanceCents = Math.abs(dollarsToCents(String(formData.get("balance"))));

  await db
    .update(accounts)
    .set({ balanceCents, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), eq(accounts.householdId, householdId)));

  await snapshotNetWorth(householdId);
  revalidatePath("/", "layout");
}

export async function deleteAccount(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const accountId = String(formData.get("accountId"));

  await db
    .delete(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.householdId, householdId)));

  await snapshotNetWorth(householdId);
  revalidatePath("/", "layout");
}

/** Recompute today's net worth snapshot from current balances. */
export async function snapshotNetWorth(householdId: string) {
  const rows = await db
    .select({
      isLiability: accounts.isLiability,
      total: sum(accounts.balanceCents),
    })
    .from(accounts)
    .where(eq(accounts.householdId, householdId))
    .groupBy(accounts.isLiability);

  let assetsCents = 0;
  let liabilitiesCents = 0;
  for (const row of rows) {
    const total = Number(row.total ?? 0);
    if (row.isLiability) liabilitiesCents = total;
    else assetsCents = total;
  }

  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(netWorthSnapshots)
    .values({
      householdId,
      date: today,
      assetsCents,
      liabilitiesCents,
      netWorthCents: assetsCents - liabilitiesCents,
    })
    .onConflictDoUpdate({
      target: [netWorthSnapshots.householdId, netWorthSnapshots.date],
      set: {
        assetsCents,
        liabilitiesCents,
        netWorthCents: sql`${assetsCents - liabilitiesCents}`,
      },
    });
}
