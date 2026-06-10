import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  recurringBills,
  savingsInsights,
  subscriptions,
  transactionCategories,
  transactions,
} from "@/db/schema";
import { formatCents } from "@/lib/format";
import { monthlyCostCents } from "@/lib/queries";

const DAY_MS = 86_400_000;

function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .replace(/\d{3,}/g, "") // strip long digit runs (store #, ref numbers)
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

/**
 * Scans the last 120 days of withdrawals for charges that repeat with a
 * stable amount and a weekly/monthly/quarterly cadence, and records them in
 * the subscriptions table with source = "detected".
 */
export async function detectSubscriptions(householdId: string) {
  const since = new Date(Date.now() - 120 * DAY_MS).toISOString().slice(0, 10);
  const txs = await db.query.transactions.findMany({
    where: and(
      eq(transactions.householdId, householdId),
      eq(transactions.type, "withdrawal"),
      gte(transactions.date, since)
    ),
    columns: { description: true, amountCents: true, date: true },
  });

  // Group by normalized merchant
  const groups = new Map<string, { amountCents: number; date: string }[]>();
  for (const tx of txs) {
    const key = normalizeMerchant(tx.description);
    if (key.length < 3) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ amountCents: tx.amountCents, date: tx.date });
  }

  let detected = 0;
  for (const [merchant, charges] of groups) {
    if (charges.length < 2) continue;

    // Stable amount: max deviation from median <= 15%
    const sorted = charges.map((c) => c.amountCents).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (sorted.some((a) => Math.abs(a - median) / median > 0.15)) continue;

    // Cadence: average gap between consecutive charges
    const dates = charges
      .map((c) => new Date(c.date + "T00:00:00").getTime())
      .sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / DAY_MS);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let frequency: "weekly" | "monthly" | "quarterly" | null = null;
    if (avgGap >= 5 && avgGap <= 9) frequency = "weekly";
    else if (avgGap >= 25 && avgGap <= 35) frequency = "monthly";
    else if (avgGap >= 80 && avgGap <= 100) frequency = "quarterly";
    if (!frequency) continue;

    // Upsert (skip if already detected)
    const existing = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.householdId, householdId),
        eq(subscriptions.merchant, merchant)
      ),
    });
    const firstSeenOn = new Date(dates[0]).toISOString().slice(0, 10);
    const lastSeenOn = new Date(dates[dates.length - 1]).toISOString().slice(0, 10);

    if (existing) {
      await db
        .update(subscriptions)
        .set({ amountCents: median, frequency, lastSeenOn })
        .where(eq(subscriptions.id, existing.id));
    } else {
      await db.insert(subscriptions).values({
        householdId,
        merchant,
        amountCents: median,
        frequency,
        firstSeenOn,
        lastSeenOn,
        source: "detected",
      });
      detected++;
    }
  }
  return detected;
}

async function insightExists(householdId: string, title: string) {
  const existing = await db.query.savingsInsights.findFirst({
    where: and(
      eq(savingsInsights.householdId, householdId),
      eq(savingsInsights.title, title)
    ),
  });
  return !!existing;
}

/**
 * Generates savings insights from current data:
 *  1. Categories with spending rising month-over-month
 *  2. Detected subscriptions not tracked as a recurring bill
 *  3. Duplicate subscriptions (same amount + frequency)
 *  4. Stale subscriptions (no charge seen in 45+ days)
 */
export async function generateInsights(householdId: string) {
  let created = 0;
  const add = async (insight: {
    type: "cancel" | "negotiate" | "reduce" | "review";
    title: string;
    body: string;
    estimatedMonthlySavingsCents: number;
  }) => {
    if (await insightExists(householdId, insight.title)) return;
    await db.insert(savingsInsights).values({ householdId, ...insight });
    created++;
  };

  // --- 1. Rising category spend (this month vs last) ---
  const monthExpr = sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1))
    .toISOString()
    .slice(0, 7);

  const byCategory = await db
    .select({
      categoryName: transactionCategories.name,
      month: monthExpr,
      total: sql<string>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .innerJoin(
      transactionCategories,
      eq(transactions.categoryId, transactionCategories.id)
    )
    .where(
      and(
        eq(transactions.householdId, householdId),
        eq(transactions.type, "withdrawal")
      )
    )
    .groupBy(transactionCategories.name, monthExpr);

  const catTotals = new Map<string, { current: number; previous: number }>();
  for (const row of byCategory) {
    if (!row.categoryName) continue;
    const entry = catTotals.get(row.categoryName) ?? { current: 0, previous: 0 };
    if (row.month === thisMonth) entry.current = Number(row.total);
    if (row.month === lastMonth) entry.previous = Number(row.total);
    catTotals.set(row.categoryName, entry);
  }

  for (const [name, { current, previous }] of catTotals) {
    if (previous >= 5_000 && current > previous * 1.25 && current - previous >= 5_000) {
      const rise = Math.round(((current - previous) / previous) * 100);
      await add({
        type: "reduce",
        title: `${name} spending is up ${rise}%`,
        body: `You've spent ${formatCents(current)} on ${name} this month vs ${formatCents(previous)} last month. Worth a quick look together to see what changed.`,
        estimatedMonthlySavingsCents: current - previous,
      });
    }
  }

  // --- 2 & 4. Detected subscriptions: untracked or stale ---
  const [detectedSubs, bills] = await Promise.all([
    db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.householdId, householdId),
        eq(subscriptions.status, "active")
      ),
    }),
    db.query.recurringBills.findMany({
      where: and(
        eq(recurringBills.householdId, householdId),
        eq(recurringBills.active, true)
      ),
    }),
  ]);

  const billNames = bills.map((b) => b.name.toLowerCase());
  const now = Date.now();

  for (const sub of detectedSubs) {
    const tracked = billNames.some(
      (n) => n.includes(sub.merchant.slice(0, 8)) || sub.merchant.includes(n.slice(0, 8))
    );
    if (sub.source === "detected" && !tracked) {
      await add({
        type: "review",
        title: `Recurring charge found: ${sub.merchant}`,
        body: `A ${sub.frequency} charge of about ${formatCents(sub.amountCents)} keeps appearing but isn't in your bills list. Add it if it's expected — or cancel it if it isn't.`,
        estimatedMonthlySavingsCents: monthlyCostCents(sub),
      });
    }
    if (
      sub.lastSeenOn &&
      now - new Date(sub.lastSeenOn + "T00:00:00").getTime() > 45 * DAY_MS
    ) {
      await add({
        type: "cancel",
        title: `${sub.merchant} may have lapsed`,
        body: `No charge from ${sub.merchant} in over 45 days. If you cancelled it — nice. If not, check whether you're still being billed elsewhere.`,
        estimatedMonthlySavingsCents: 0,
      });
    }
  }

  // --- 3. Duplicate subscription bills ---
  const subBills = bills.filter((b) => b.isSubscription);
  for (let i = 0; i < subBills.length; i++) {
    for (let j = i + 1; j < subBills.length; j++) {
      const a = subBills[i];
      const b = subBills[j];
      if (a.amountCents === b.amountCents && a.frequency === b.frequency) {
        await add({
          type: "review",
          title: `Possible duplicate: ${a.name} & ${b.name}`,
          body: `"${a.name}" and "${b.name}" both bill ${formatCents(a.amountCents)} ${a.frequency}. If they're the same service (or a shareable plan), one of them can probably go.`,
          estimatedMonthlySavingsCents: monthlyCostCents(a),
        });
      }
    }
  }

  return created;
}
