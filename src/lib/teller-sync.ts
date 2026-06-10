import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { accounts, tellerEnrollments, transactions } from "@/db/schema";
import {
  mapTellerAccountType,
  parseTellerAmountCents,
  teller,
  TELLER_CATEGORY_MAP,
} from "@/lib/teller";
import { getCategories } from "@/lib/queries";
import { snapshotNetWorth } from "@/lib/actions/accounts";

export type SyncResult = {
  institution: string;
  accounts: number;
  newTransactions: number;
  error?: string;
};

/**
 * Syncs one Teller enrollment: refreshes balances, imports new posted
 * transactions (deduped by Teller transaction id), auto-categorizes.
 */
async function syncEnrollment(
  enrollment: typeof tellerEnrollments.$inferSelect
): Promise<SyncResult> {
  const householdId = enrollment.householdId;
  const result: SyncResult = {
    institution: enrollment.institutionName,
    accounts: 0,
    newTransactions: 0,
  };

  const categories = await getCategories(householdId);
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const remoteAccounts = await teller.accounts(enrollment.accessToken);

  for (const remote of remoteAccounts.filter((a) => a.status === "open")) {
    // Find or create the local account
    let local = await db.query.accounts.findFirst({
      where: eq(accounts.tellerAccountId, remote.id),
    });
    const mapped = mapTellerAccountType(remote);

    if (!local) {
      [local] = await db
        .insert(accounts)
        .values({
          householdId,
          name: `${remote.name} ••${remote.last_four}`,
          type: mapped.type,
          institution: remote.institution.name,
          isLiability: mapped.isLiability,
          tellerAccountId: remote.id,
          tellerEnrollmentId: enrollment.id,
        })
        .returning();
    }
    result.accounts++;

    // Balance — Teller's ledger balance; liabilities tracked as amount owed
    try {
      const balance = await teller.balance(enrollment.accessToken, remote.id);
      const cents = Math.abs(parseTellerAmountCents(balance.ledger));
      await db
        .update(accounts)
        .set({ balanceCents: cents, updatedAt: new Date() })
        .where(eq(accounts.id, local.id));
    } catch {
      // Balance fetch can fail independently; transactions may still work
    }

    // Transactions — posted only, deduped by teller id
    const remoteTxs = (
      await teller.transactions(enrollment.accessToken, remote.id)
    ).filter((t) => t.status === "posted");
    if (remoteTxs.length === 0) continue;

    const existing = await db
      .select({ id: transactions.tellerTransactionId })
      .from(transactions)
      .where(
        and(
          isNotNull(transactions.tellerTransactionId),
          inArray(
            transactions.tellerTransactionId,
            remoteTxs.map((t) => t.id)
          )
        )
      );
    const seen = new Set(existing.map((e) => e.id));
    const fresh = remoteTxs.filter((t) => !seen.has(t.id));
    if (fresh.length === 0) continue;

    await db.insert(transactions).values(
      fresh.map((t) => {
        const cents = parseTellerAmountCents(t.amount);
        const categoryName = t.details.category
          ? TELLER_CATEGORY_MAP[t.details.category]
          : undefined;
        return {
          householdId,
          accountId: local.id,
          // Teller: negative amount = money out of the account
          type: (cents < 0 ? "withdrawal" : "deposit") as "withdrawal" | "deposit",
          amountCents: Math.abs(cents),
          categoryId: categoryName ? (categoryIdByName.get(categoryName) ?? null) : null,
          description:
            t.details.counterparty?.name || t.description.slice(0, 120),
          date: t.date,
          tellerTransactionId: t.id,
          notes: null,
        };
      })
    );
    result.newTransactions += fresh.length;
  }

  await db
    .update(tellerEnrollments)
    .set({ lastSyncedAt: new Date(), status: "active" })
    .where(eq(tellerEnrollments.id, enrollment.id));

  await snapshotNetWorth(householdId);
  return result;
}

/** Syncs all active enrollments for a household. */
export async function syncHousehold(householdId: string): Promise<SyncResult[]> {
  const enrollments = await db.query.tellerEnrollments.findMany({
    where: and(
      eq(tellerEnrollments.householdId, householdId),
      eq(tellerEnrollments.status, "active")
    ),
  });

  const results: SyncResult[] = [];
  for (const enrollment of enrollments) {
    try {
      results.push(await syncEnrollment(enrollment));
    } catch (e) {
      results.push({
        institution: enrollment.institutionName,
        accounts: 0,
        newTransactions: 0,
        error: e instanceof Error ? e.message : "Sync failed",
      });
      await db
        .update(tellerEnrollments)
        .set({ status: "disconnected" })
        .where(eq(tellerEnrollments.id, enrollment.id));
    }
  }
  return results;
}

/** Syncs every household with active enrollments (used by the daily cron). */
export async function syncAllHouseholds(): Promise<SyncResult[]> {
  const enrollments = await db.query.tellerEnrollments.findMany({
    where: eq(tellerEnrollments.status, "active"),
    columns: { householdId: true },
  });
  const householdIds = [...new Set(enrollments.map((e) => e.householdId))];

  const results: SyncResult[] = [];
  for (const id of householdIds) {
    results.push(...(await syncHousehold(id)));
  }
  return results;
}
