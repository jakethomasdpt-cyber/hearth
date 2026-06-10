"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { dollarsToCents } from "@/lib/format";
import { snapshotNetWorth } from "./accounts";

const txSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["deposit", "withdrawal", "transfer"]),
  amount: z.string(),
  categoryId: z.string().uuid().optional(),
  description: z.string().min(1),
  notes: z.string().optional(),
  tags: z.string().optional(),
  date: z.string(),
});

/**
 * Creates a transaction and applies it to the account balance.
 * For liability accounts, a "deposit" (payment) reduces the balance owed
 * and a "withdrawal" (charge) increases it.
 */
export async function createTransaction(formData: FormData) {
  const { householdId, userId } = await getHouseholdContext();
  const parsed = txSchema.parse({
    accountId: formData.get("accountId"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId") || undefined,
    description: formData.get("description"),
    notes: formData.get("notes") || undefined,
    tags: formData.get("tags") || undefined,
    date: formData.get("date"),
  });

  const account = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.id, parsed.accountId),
      eq(accounts.householdId, householdId)
    ),
  });
  if (!account) throw new Error("Account not found in this household");

  const amountCents = Math.abs(dollarsToCents(parsed.amount));

  await db.insert(transactions).values({
    householdId,
    accountId: parsed.accountId,
    type: parsed.type,
    amountCents,
    categoryId: parsed.categoryId,
    description: parsed.description,
    notes: parsed.notes,
    tags: parsed.tags,
    date: parsed.date,
    createdByUserId: userId,
  });

  // Apply to balance
  if (parsed.type !== "transfer") {
    const direction = parsed.type === "deposit" ? 1 : -1;
    // On liability accounts the balance is "amount owed", so flip the sign.
    const delta = account.isLiability
      ? -direction * amountCents
      : direction * amountCents;
    await db
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));
  }

  await snapshotNetWorth(householdId);
  revalidatePath("/", "layout");
}

export async function deleteTransaction(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const id = String(formData.get("transactionId"));

  const tx = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), eq(transactions.householdId, householdId)),
    with: { account: true },
  });
  if (!tx) return;

  // Reverse the balance effect
  if (tx.type !== "transfer") {
    const direction = tx.type === "deposit" ? 1 : -1;
    const delta = tx.account.isLiability
      ? direction * tx.amountCents
      : -direction * tx.amountCents;
    await db
      .update(accounts)
      .set({
        balanceCents: sql`${accounts.balanceCents} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, tx.accountId));
  }

  await db.delete(transactions).where(eq(transactions.id, id));
  await snapshotNetWorth(householdId);
  revalidatePath("/", "layout");
}
