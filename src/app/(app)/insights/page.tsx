import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { savingsInsights, subscriptions } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { runSavingsScan, updateInsightStatus } from "@/lib/actions/insights";
import { formatCents, formatDate } from "@/lib/format";
import { monthlyCostCents } from "@/lib/queries";

const TYPE_STYLE: Record<string, string> = {
  cancel: "bg-neg-dim text-neg",
  negotiate: "bg-pos-dim text-pos",
  reduce: "text-warn border border-edge",
  review: "border border-edge text-ink-muted",
};

export default async function InsightsPage() {
  const ctx = await getHouseholdContext();

  const [insights, detectedSubs] = await Promise.all([
    db.query.savingsInsights.findMany({
      where: eq(savingsInsights.householdId, ctx.householdId),
      orderBy: [desc(savingsInsights.createdAt)],
    }),
    db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.householdId, ctx.householdId),
        eq(subscriptions.source, "detected")
      ),
      orderBy: [desc(subscriptions.lastSeenOn)],
    }),
  ]);

  const open = insights.filter((i) => i.status === "open");
  const resolved = insights.filter((i) => i.status !== "open");
  const potential = open.reduce((s, i) => s + i.estimatedMonthlySavingsCents, 0);

  return (
    <div className="space-y-6">
      <header className="fade-up flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Savings Intelligence
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Where your household money is leaking — and what to do about it.
          </p>
        </div>
        <form action={runSavingsScan}>
          <button type="submit" className="btn-primary">
            ↻ Scan for savings
          </button>
        </form>
      </header>

      <section className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <div className="card fade-up fade-up-1 p-5">
          <p className="text-xs font-medium text-ink-muted">
            POTENTIAL MONTHLY SAVINGS
          </p>
          <p className="tnum mt-2 text-2xl font-semibold text-pos">
            {formatCents(potential)}
          </p>
        </div>
        <div className="card fade-up fade-up-2 p-5">
          <p className="text-xs font-medium text-ink-muted">OPEN OPPORTUNITIES</p>
          <p className="tnum mt-2 text-2xl font-semibold">{open.length}</p>
        </div>
        <div className="card fade-up fade-up-3 p-5">
          <p className="text-xs font-medium text-ink-muted">
            DETECTED SUBSCRIPTIONS
          </p>
          <p className="tnum mt-2 text-2xl font-semibold">{detectedSubs.length}</p>
        </div>
      </section>

      <section className="fade-up fade-up-2 space-y-3">
        <h2 className="text-sm font-semibold text-ink-muted">Opportunities</h2>
        {open.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-ink-muted">
              No open opportunities. Hit “Scan for savings” after adding
              transactions or importing statements.
            </p>
          </div>
        ) : (
          open.map((insight) => (
            <div key={insight.id} className="card card-hover p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_STYLE[insight.type]}`}
                    >
                      {insight.type}
                    </span>
                    <p className="text-sm font-semibold">{insight.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {insight.body}
                  </p>
                </div>
                {insight.estimatedMonthlySavingsCents > 0 && (
                  <p className="tnum shrink-0 rounded-full bg-pos-dim px-3 py-1 text-xs font-medium text-pos">
                    ~{formatCents(insight.estimatedMonthlySavingsCents)}/mo
                  </p>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <form action={updateInsightStatus}>
                  <input type="hidden" name="insightId" value={insight.id} />
                  <input type="hidden" name="status" value="done" />
                  <button type="submit" className="btn-ghost text-xs">
                    ✓ Done
                  </button>
                </form>
                <form action={updateInsightStatus}>
                  <input type="hidden" name="insightId" value={insight.id} />
                  <input type="hidden" name="status" value="dismissed" />
                  <button type="submit" className="btn-ghost text-xs">
                    Dismiss
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </section>

      {detectedSubs.length > 0 && (
        <section className="card fade-up fade-up-3 p-6">
          <h2 className="mb-1 text-sm font-semibold">Detected subscriptions</h2>
          <p className="mb-4 text-xs text-ink-muted">
            Recurring charges found automatically in your transaction history.
          </p>
          <ul className="space-y-2.5">
            {detectedSubs.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium capitalize">{sub.merchant}</p>
                  <p className="text-xs text-ink-faint">
                    {sub.frequency}
                    {sub.lastSeenOn && ` · last seen ${formatDate(sub.lastSeenOn)}`}
                  </p>
                </div>
                <span className="tnum text-ink-muted">
                  {formatCents(monthlyCostCents(sub))}/mo
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resolved.length > 0 && (
        <section className="fade-up fade-up-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-muted">Resolved</h2>
          <ul className="space-y-2">
            {resolved.slice(0, 10).map((insight) => (
              <li
                key={insight.id}
                className="flex items-center justify-between rounded-xl border border-edge/50 px-4 py-3 text-sm text-ink-faint"
              >
                <span className="line-through">{insight.title}</span>
                <span className="text-xs uppercase">{insight.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
