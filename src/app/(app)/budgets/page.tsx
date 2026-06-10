import { getHouseholdContext } from "@/lib/session";
import { getBudgetStatus } from "@/lib/queries";
import { BudgetRow } from "@/components/budget-row";
import { formatCents } from "@/lib/format";

export default async function BudgetsPage() {
  const ctx = await getHouseholdContext();
  const rows = await getBudgetStatus(ctx.householdId);

  const budgeted = rows.filter((r) => r.budgetCents !== null);
  const unbudgeted = rows.filter((r) => r.budgetCents === null);

  const totalBudget = budgeted.reduce((s, r) => s + (r.budgetCents ?? 0), 0);
  const totalSpent = budgeted.reduce((s, r) => s + r.spentCents, 0);
  const overCount = budgeted.filter(
    (r) => r.budgetCents !== null && r.spentCents > r.budgetCents
  ).length;

  const monthName = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <h1 className="text-xl font-semibold tracking-tight">Budgets</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Shared spending limits by category · {monthName}
        </p>
      </header>

      {budgeted.length > 0 && (
        <section className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          <div className="card fade-up fade-up-1 p-5">
            <p className="text-xs font-medium text-ink-muted">TOTAL BUDGETED</p>
            <p className="tnum mt-2 text-2xl font-semibold">
              {formatCents(totalBudget)}
            </p>
          </div>
          <div className="card fade-up fade-up-2 p-5">
            <p className="text-xs font-medium text-ink-muted">SPENT SO FAR</p>
            <p
              className={`tnum mt-2 text-2xl font-semibold ${
                totalSpent > totalBudget ? "text-neg" : ""
              }`}
            >
              {formatCents(totalSpent)}
            </p>
          </div>
          <div className="card fade-up fade-up-3 p-5">
            <p className="text-xs font-medium text-ink-muted">OVER BUDGET</p>
            <p
              className={`tnum mt-2 text-2xl font-semibold ${
                overCount > 0 ? "text-warn" : "text-pos"
              }`}
            >
              {overCount === 0 ? "None 🎉" : `${overCount} categor${overCount === 1 ? "y" : "ies"}`}
            </p>
          </div>
        </section>
      )}

      <section className="fade-up fade-up-2 space-y-3">
        {budgeted.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-sm text-ink-muted">
              No budgets yet. Set a monthly limit on the categories below —
              you'll both see progress update as transactions come in.
            </p>
          </div>
        )}
        {budgeted.map((row) => (
          <BudgetRow key={row.categoryId} {...row} />
        ))}
      </section>

      {unbudgeted.length > 0 && (
        <section className="fade-up fade-up-3 space-y-3">
          <h2 className="text-sm font-semibold text-ink-muted">
            Not budgeted yet
          </h2>
          {unbudgeted.map((row) => (
            <BudgetRow key={row.categoryId} {...row} />
          ))}
        </section>
      )}
    </div>
  );
}
