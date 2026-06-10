import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  budgets,
  netWorthSnapshots,
  recurringBills,
  savingsInsights,
  transactionCategories,
  transactions,
} from "@/db/schema";

function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function getAccounts(householdId: string) {
  return db.query.accounts.findMany({
    where: eq(accounts.householdId, householdId),
    orderBy: [asc(accounts.isLiability), desc(accounts.balanceCents)],
  });
}

export async function getNetWorth(householdId: string) {
  const all = await getAccounts(householdId);
  const assetsCents = all
    .filter((a) => !a.isLiability)
    .reduce((s, a) => s + a.balanceCents, 0);
  const liabilitiesCents = all
    .filter((a) => a.isLiability)
    .reduce((s, a) => s + a.balanceCents, 0);
  const cashCents = all
    .filter((a) => a.type === "checking" || a.type === "savings")
    .reduce((s, a) => s + a.balanceCents, 0);
  return {
    assetsCents,
    liabilitiesCents,
    netWorthCents: assetsCents - liabilitiesCents,
    cashCents,
    accounts: all,
  };
}

export async function getMonthlyFlow(householdId: string, offset = 0) {
  const { start, end } = monthRange(offset);
  const rows = await db
    .select({
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amountCents}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    )
    .groupBy(transactions.type);

  let incomeCents = 0;
  let spendingCents = 0;
  for (const r of rows) {
    if (r.type === "deposit") incomeCents = Number(r.total);
    if (r.type === "withdrawal") spendingCents = Number(r.total);
  }
  return { incomeCents, spendingCents, netCents: incomeCents - spendingCents };
}

export async function getNetWorthHistory(householdId: string, limit = 180) {
  const rows = await db.query.netWorthSnapshots.findMany({
    where: eq(netWorthSnapshots.householdId, householdId),
    orderBy: [desc(netWorthSnapshots.date)],
    limit,
  });
  return rows.reverse();
}

export async function getBills(householdId: string) {
  return db.query.recurringBills.findMany({
    where: and(
      eq(recurringBills.householdId, householdId),
      eq(recurringBills.active, true)
    ),
    orderBy: [asc(recurringBills.dueDay)],
  });
}

export type BillWithDue = Awaited<ReturnType<typeof getBills>>[number] & {
  nextDue: Date;
  daysUntilDue: number;
  paidThisCycle: boolean;
};

export function withDueDates(bills: Awaited<ReturnType<typeof getBills>>): BillWithDue[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return bills
    .map((bill) => {
      let nextDue = new Date(
        today.getFullYear(),
        today.getMonth(),
        Math.min(
          bill.dueDay,
          new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        )
      );
      if (nextDue < today) {
        nextDue = new Date(today.getFullYear(), today.getMonth() + 1, bill.dueDay);
      }
      const daysUntilDue = Math.round(
        (nextDue.getTime() - today.getTime()) / 86_400_000
      );
      const paidThisCycle = bill.lastPaidOn
        ? new Date(bill.lastPaidOn + "T00:00:00").getMonth() === today.getMonth() &&
          new Date(bill.lastPaidOn + "T00:00:00").getFullYear() === today.getFullYear()
        : false;
      return { ...bill, nextDue, daysUntilDue, paidThisCycle };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/** Normalize a bill to its monthly cost. */
export function monthlyCostCents(bill: { amountCents: number; frequency: string }) {
  switch (bill.frequency) {
    case "weekly":
      return Math.round((bill.amountCents * 52) / 12);
    case "quarterly":
      return Math.round(bill.amountCents / 3);
    case "yearly":
      return Math.round(bill.amountCents / 12);
    default:
      return bill.amountCents;
  }
}

export async function getOpenInsights(householdId: string) {
  return db.query.savingsInsights.findMany({
    where: and(
      eq(savingsInsights.householdId, householdId),
      eq(savingsInsights.status, "open")
    ),
    orderBy: [desc(savingsInsights.estimatedMonthlySavingsCents)],
  });
}

export async function getCategories(householdId: string) {
  return db.query.transactionCategories.findMany({
    where: or(
      eq(transactionCategories.householdId, householdId),
      sql`${transactionCategories.householdId} is null`
    ),
    orderBy: [asc(transactionCategories.name)],
  });
}

/** Income vs spending per month for the last `months` months. */
export async function getMonthlyFlowSeries(householdId: string, months = 6) {
  const start = new Date();
  start.setMonth(start.getMonth() - (months - 1));
  start.setDate(1);
  const startStr = start.toISOString().slice(0, 10);

  const monthExpr = sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`;
  const rows = await db
    .select({
      month: monthExpr,
      type: transactions.type,
      total: sql<string>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .where(
      and(eq(transactions.householdId, householdId), gte(transactions.date, startStr))
    )
    .groupBy(monthExpr, transactions.type)
    .orderBy(monthExpr);

  const series: { month: string; incomeCents: number; spendingCents: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    series.push({
      month: d.toISOString().slice(0, 7),
      incomeCents: 0,
      spendingCents: 0,
    });
  }
  for (const row of rows) {
    const entry = series.find((s) => s.month === row.month);
    if (!entry) continue;
    if (row.type === "deposit") entry.incomeCents = Number(row.total);
    if (row.type === "withdrawal") entry.spendingCents = Number(row.total);
  }
  return series;
}

/** Spending grouped by category for a given month offset (0 = this month). */
export async function getCategorySpend(householdId: string, offset = 0) {
  const { start, end } = monthRange(offset);
  const rows = await db
    .select({
      name: sql<string>`coalesce(${transactionCategories.name}, 'Uncategorized')`,
      total: sql<string>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .leftJoin(
      transactionCategories,
      eq(transactions.categoryId, transactionCategories.id)
    )
    .where(
      and(
        eq(transactions.householdId, householdId),
        eq(transactions.type, "withdrawal"),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    )
    .groupBy(sql`coalesce(${transactionCategories.name}, 'Uncategorized')`)
    .orderBy(sql`sum(${transactions.amountCents}) desc`);

  return rows.map((r) => ({ name: r.name, totalCents: Number(r.total) }));
}

/**
 * Every expense category with its monthly budget (if set) and actual
 * spending for the current month.
 */
export async function getBudgetStatus(householdId: string) {
  const [cats, householdBudgets, spend] = await Promise.all([
    getCategories(householdId),
    db.query.budgets.findMany({ where: eq(budgets.householdId, householdId) }),
    getCategorySpend(householdId, 0),
  ]);

  const budgetByCategory = new Map(householdBudgets.map((b) => [b.categoryId, b]));
  const spendByName = new Map(spend.map((s) => [s.name, s.totalCents]));

  return cats
    .filter((c) => c.kind === "expense")
    .map((c) => {
      const budget = budgetByCategory.get(c.id);
      return {
        categoryId: c.id,
        categoryName: c.name,
        budgetId: budget?.id ?? null,
        budgetCents: budget?.amountCents ?? null,
        spentCents: spendByName.get(c.name) ?? 0,
      };
    })
    .sort((a, b) => {
      // budgeted categories first, then by spend
      if (!!a.budgetCents !== !!b.budgetCents) return a.budgetCents ? -1 : 1;
      return b.spentCents - a.spentCents;
    });
}

export async function getTransactions(
  householdId: string,
  opts: { q?: string; type?: string; accountId?: string; limit?: number } = {}
) {
  const conditions = [eq(transactions.householdId, householdId)];
  if (opts.q) {
    conditions.push(
      or(
        ilike(transactions.description, `%${opts.q}%`),
        ilike(transactions.notes, `%${opts.q}%`),
        ilike(transactions.tags, `%${opts.q}%`)
      )!
    );
  }
  if (opts.type === "deposit" || opts.type === "withdrawal" || opts.type === "transfer") {
    conditions.push(eq(transactions.type, opts.type));
  }
  if (opts.accountId) {
    conditions.push(eq(transactions.accountId, opts.accountId));
  }

  return db.query.transactions.findMany({
    where: and(...conditions),
    with: { account: true, category: true, createdBy: true },
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    limit: opts.limit ?? 100,
  });
}
