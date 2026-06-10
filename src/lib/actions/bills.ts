"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { recurringBills } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { dollarsToCents } from "@/lib/format";

const billSchema = z.object({
  name: z.string().min(1),
  amount: z.string(),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  dueDay: z.coerce.number().min(1).max(31),
  isSubscription: z.coerce.boolean(),
  autopay: z.coerce.boolean(),
  notes: z.string().optional(),
});

export async function createBill(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const parsed = billSchema.parse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    frequency: formData.get("frequency"),
    dueDay: formData.get("dueDay"),
    isSubscription: formData.get("isSubscription") === "on",
    autopay: formData.get("autopay") === "on",
    notes: formData.get("notes") || undefined,
  });

  await db.insert(recurringBills).values({
    householdId,
    name: parsed.name,
    amountCents: Math.abs(dollarsToCents(parsed.amount)),
    frequency: parsed.frequency,
    dueDay: parsed.dueDay,
    isSubscription: parsed.isSubscription,
    autopay: parsed.autopay,
    notes: parsed.notes,
  });

  revalidatePath("/", "layout");
}

export async function markBillPaid(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const billId = String(formData.get("billId"));
  const unpay = formData.get("unpay") === "true";

  await db
    .update(recurringBills)
    .set({ lastPaidOn: unpay ? null : new Date().toISOString().slice(0, 10) })
    .where(
      and(eq(recurringBills.id, billId), eq(recurringBills.householdId, householdId))
    );

  revalidatePath("/", "layout");
}

export async function deleteBill(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const billId = String(formData.get("billId"));

  await db
    .delete(recurringBills)
    .where(
      and(eq(recurringBills.id, billId), eq(recurringBills.householdId, householdId))
    );

  revalidatePath("/", "layout");
}
