import { getHouseholdContext } from "@/lib/session";
import {
  getBills,
  getCategorySpend,
  getMonthlyFlow,
  getMonthlyFlowSeries,
  getNetWorthHistory,
  monthlyCostCents,
  withDueDates,
} from "@/lib/queries";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { NetWorthChart } from "@/components/net-worth-chart";
import { formatCents } from "@/lib/format";

export default async function ReportsPage() {
  const ctx = await getHouseholdContext();

  const [flowSeries, thisMonth, categories, history, bills] = await Promise.all([
    getMonthlyFlowSeries(ctx.householdId, 6),
    getMonthlyFlow(ctx.householdId, 0),
    getCategorySpend(ctx.householdId, 0),
    getNetWorthHistory(ctx.householdId),
    getBills(ctx.householdId),
  ]);

  const dueBills = withDueDates(bills);
  const subsTotal = dueBills
    .filter((b) => b.isSubscription)
    .reduce((s, b) => s + monthlyCostCents(b), 0);

  const savingsRate =
    thisMonth.incomeCents > 0
      ? ((thisMonth.incomeCents - thisMonth.spendingCents) / thisMonth.incomeCents) * 100
      : null;

  const maxCategory = Math.max(1, ...categories.map((c) => c.totalCents));
  const totalSpend = categories.reduce((s, c) => s + c.totalCents, 0);

  // 6-month averages
  const avgIncome =
    flowSeries.reduce((s, m) => s + m.incomeCents, 0) / Math.max(1, flowSeries.length);
  const avgSpending =
    flowSeries.reduce((s, m) => s + m.spendingCents, 0) / Math.max(1, flowSeries.length);

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The bigger picture of how money moves through your household.
        </p>
      </header>

      {/* Headline stats */}
      <section className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <div className="card fade-up fade-up-1 p-5">
          <p className="text-xs font-medium text-ink-muted">SAVINGS RATE (THIS MONTH)</p>
          <p
            className={`tnum mt-2 text-2xl font-semibold ${
              savingsRate !== null && savingsRate < 0 ? "text-neg" : "text-pos"
            }`}
          >
            {savingsRate === null ? "—" : `${savingsRate.toFixed(1)}%`}
          </p>
        </div>
        <div className="card fade-up fade-up-2 p-5">
          <p className="text-xs font-medium text-ink-muted">AVG MONTHLY INCOME (6 MO)</p>
          <p className="tnum mt-2 text-2xl font-semibold">{formatCents(avgIncome)}</p>
        </div>
        <div className="card fade-up fade-up-3 p-5">
          <p className="text-xs font-medium text-ink-muted">AVG MONTHLY SPENDING (6 MO)</p>
          <p className="tnum mt-2 text-2xl font-semibold">{formatCents(avgSpending)}</p>
        </div>
        <div className="card fade-up fade-up-4 p-5">
          <p className="text-xs font-medium text-ink-muted">SUBSCRIPTION TOTAL</p>
          <p className="tnum mt-2 text-2xl font-semibold">
            {formatCents(subsTotal)}
            <span className="text-sm text-ink-muted">/mo</span>
          </p>
        </div>
      </section>

      {/* Income vs expenses */}
      <section className="card fade-up fade-up-2 p-6">
        <h2 className="mb-1 text-sm font-semibold">Income vs Spending</h2>
        <p className="mb-4 text-xs text-ink-muted">
          Monthly cash flow over the last 6 months.
        </p>
        <CashFlowChart data={flowSeries} />
      </section>

      <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        {/* Spending by category */}
        <section className="card fade-up fade-up-3 p-6">
          <h2 className="mb-1 text-sm font-semibold">Spending by Category</h2>
          <p className="mb-5 text-xs text-ink-muted">
            This month · {formatCents(totalSpend)} total
          </p>
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-faint">
              No spending recorded this month yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {categories.slice(0, 8).map((c) => (
                <li key={c.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="tnum text-ink-muted">
                      {formatCents(c.totalCents)}
                      <span className="text-ink-faint">
                        {" "}
                        · {Math.round((c.totalCents / Math.max(1, totalSpend)) * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className="h-full rounded-full bg-pos transition-all duration-500"
                      style={{ width: `${(c.totalCents / maxCategory) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Net worth trend */}
        <section className="card fade-up fade-up-4 p-6">
          <h2 className="mb-1 text-sm font-semibold">Net Worth Trend</h2>
          <p className="mb-4 text-xs text-ink-muted">
            Snapshots recorded as balances change.
          </p>
          <NetWorthChart
            data={history.map((h) => ({
              date: h.date,
              netWorthCents: h.netWorthCents,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
