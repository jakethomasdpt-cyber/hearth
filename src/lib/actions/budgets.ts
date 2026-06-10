"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { dollarsToCents } from "@/lib/format";

export async function setBudget(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const categoryId = z.string().uuid().parse(formData.get("categoryId"));
  const amountCents = Math.abs(dollarsToCents(String(formData.get("amount") ?? "0")));

  if (amountCents === 0) {
    await db
      .delete(budgets)
      .where(
        and(eq(budgets.householdId, householdId), eq(budgets.categoryId, categoryId))
      );
  } else {
    await db
      .insert(budgets)
      .values({ householdId, categoryId, amountCents })
      .onConflictDoUpdate({
        target: [budgets.householdId, budgets.categoryId],
        set: { amountCents },
      });
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}

export async function deleteBudget(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const budgetId = String(formData.get("budgetId"));

  await db
    .delete(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.householdId, householdId)));

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}
