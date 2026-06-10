import Link from "next/link";
import { getHouseholdContext } from "@/lib/session";
import {
  getBills,
  getMonthlyFlow,
  getNetWorth,
  getNetWorthHistory,
  getOpenInsights,
  getTransactions,
  monthlyCostCents,
  withDueDates,
} from "@/lib/queries";
import { NetWorthChart } from "@/components/net-worth-chart";
import { StatCard } from "@/components/stat-card";
import { formatCents, formatDate } from "@/lib/format";

export default async function DashboardPage() {
  const ctx = await getHouseholdContext();

  const [netWorth, thisMonth, lastMonth, history, bills, insights, recentTx] =
    await Promise.all([
      getNetWorth(ctx.householdId),
      getMonthlyFlow(ctx.householdId, 0),
      getMonthlyFlow(ctx.householdId, -1),
      getNetWorthHistory(ctx.householdId),
      getBills(ctx.householdId),
      getOpenInsights(ctx.householdId),
      getTransactions(ctx.householdId, { limit: 6 }),
    ]);

  const dueBills = withDueDates(bills);
  const upcoming = dueBills.filter((b) => !b.paidThisCycle && b.daysUntilDue <= 30);
  const subscriptions = dueBills.filter((b) => b.isSubscription);
  const recurringTotal = dueBills.reduce((s, b) => s + monthlyCostCents(b), 0);
  const potentialSavings = insights.reduce(
    (s, i) => s + i.estimatedMonthlySavingsCents,
    0
  );

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <h1 className="text-xl font-semibold tracking-tight">
          {ctx.householdName}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Here's how your shared money looks today.
        </p>
      </header>

      {/* Hero: net worth */}
      <section className="card fade-up fade-up-1 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-muted">
              HOUSEHOLD NET WORTH
            </p>
            <p className="tnum mt-1 text-4xl font-semibold tracking-tight">
              {formatCents(netWorth.netWorthCents)}
            </p>
            <p className="tnum mt-2 text-sm text-ink-muted">
              <span className="text-pos">{formatCents(netWorth.assetsCents)}</span>{" "}
              assets ·{" "}
              <span className="text-neg">
                {formatCents(netWorth.liabilitiesCents)}
              </span>{" "}
              owed
            </p>
          </div>
          <Link href="/accounts" className="btn-ghost">
            Manage accounts →
          </Link>
        </div>
        <div className="mt-6">
          <NetWorthChart
            data={history.map((h) => ({
              date: h.date,
              netWorthCents: h.netWorthCents,
            }))}
          />
        </div>
      </section>

      {/* Stat row */}
      <section className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <StatCard
          className="fade-up fade-up-1"
          label="CASH ON HAND"
          valueCents={netWorth.cashCents}
        />
        <StatCard
          className="fade-up fade-up-2"
          label="INCOME THIS MONTH"
          valueCents={thisMonth.incomeCents}
          previousCents={lastMonth.incomeCents}
        />
        <StatCard
          className="fade-up fade-up-3"
          label="SPENDING THIS MONTH"
          valueCents={thisMonth.spendingCents}
          previousCents={lastMonth.spendingCents}
          invertColor
        />
        <StatCard
          className="fade-up fade-up-4"
          label="MONTHLY RECURRING"
          valueCents={recurringTotal}
        />
      </section>

      <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        {/* Upcoming bills */}
        <section className="card fade-up fade-up-2 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Upcoming Bills</h2>
            <Link href="/bills" className="text-xs text-ink-muted hover:text-ink">
              View all →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">
              Nothing due in the next 30 days. 🎉
            </p>
          ) : (
            <ul className="space-y-3">
              {upcoming.slice(0, 5).map((bill) => (
                <li key={bill.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{bill.name}</p>
                    <p
                      className={`text-xs ${
                        bill.daysUntilDue <= 3 ? "text-warn" : "text-ink-muted"
                      }`}
                    >
                      {bill.daysUntilDue === 0
                        ? "Due today"
                        : `Due in ${bill.daysUntilDue} day${bill.daysUntilDue === 1 ? "" : "s"}`}
                      {bill.autopay && " · autopay"}
                    </p>
                  </div>
                  <span className="tnum text-sm font-medium">
                    {formatCents(bill.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Savings opportunities */}
        <section className="card fade-up fade-up-3 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Savings Opportunities</h2>
            {potentialSavings > 0 && (
              <span className="tnum rounded-full bg-pos-dim px-2.5 py-1 text-xs font-medium text-pos">
                {formatCents(potentialSavings)}/mo possible
              </span>
            )}
          </div>
          {insights.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">
              No open opportunities. We'll flag anything worth reviewing.
            </p>
          ) : (
            <ul className="space-y-3">
              {insights.slice(0, 4).map((insight) => (
                <li key={insight.id} className="rounded-xl bg-surface-raised p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{insight.title}</p>
                    <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                      {insight.type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    {insight.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Subscriptions */}
        <section className="card fade-up fade-up-3 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Subscriptions</h2>
            <span className="tnum text-xs text-ink-muted">
              {formatCents(
                subscriptions.reduce((s, b) => s + monthlyCostCents(b), 0)
              )}
              /mo
            </span>
          </div>
          {subscriptions.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">
              No subscriptions tracked yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {subscriptions.slice(0, 6).map((sub) => (
                <li key={sub.id} className="flex items-center justify-between">
                  <p className="text-sm">{sub.name}</p>
                  <span className="tnum text-sm text-ink-muted">
                    {formatCents(sub.amountCents)}
                    <span className="text-ink-faint">
                      /{sub.frequency === "monthly" ? "mo" : sub.frequency.slice(0, 2)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="card fade-up fade-up-4 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Activity</h2>
            <Link
              href="/transactions"
              className="text-xs text-ink-muted hover:text-ink"
            >
              View all →
            </Link>
          </div>
          {recentTx.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">
              No transactions yet. Add one to get started.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentTx.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {tx.description}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(tx.date)} · {tx.account.name}
                    </p>
                  </div>
                  <span
                    className={`tnum shrink-0 text-sm font-medium ${
                      tx.type === "deposit" ? "text-pos" : ""
                    }`}
                  >
                    {tx.type === "deposit" ? "+" : tx.type === "withdrawal" ? "−" : ""}
                    {formatCents(tx.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
