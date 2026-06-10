import { getHouseholdContext } from "@/lib/session";
import { getBills, monthlyCostCents, withDueDates } from "@/lib/queries";
import {
  AddBillButton,
  DeleteBillButton,
  MarkPaidButton,
} from "@/components/bill-forms";
import { formatCents } from "@/lib/format";

const FREQ_LABEL: Record<string, string> = {
  weekly: "weekly",
  monthly: "monthly",
  quarterly: "quarterly",
  yearly: "yearly",
};

export default async function BillsPage() {
  const ctx = await getHouseholdContext();
  const bills = withDueDates(await getBills(ctx.householdId));

  const recurringTotal = bills.reduce((s, b) => s + monthlyCostCents(b), 0);
  const subscriptions = bills.filter((b) => b.isSubscription);
  const subsTotal = subscriptions.reduce((s, b) => s + monthlyCostCents(b), 0);
  const unpaidDueSoon = bills.filter((b) => !b.paidThisCycle && b.daysUntilDue <= 7);

  // Flag potential duplicates: same name prefix or same amount + frequency
  const flagged = new Set<string>();
  for (let i = 0; i < subscriptions.length; i++) {
    for (let j = i + 1; j < subscriptions.length; j++) {
      const a = subscriptions[i];
      const b = subscriptions[j];
      if (
        a.amountCents === b.amountCents &&
        a.frequency === b.frequency
      ) {
        flagged.add(a.id);
        flagged.add(b.id);
      }
    }
  }

  return (
    <div className="space-y-6">
      <header className="fade-up flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Bills & Subscriptions
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            What leaves your accounts every month, and when.
          </p>
        </div>
        <AddBillButton />
      </header>

      <section className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <div className="card fade-up fade-up-1 p-5">
          <p className="text-xs font-medium text-ink-muted">MONTHLY RECURRING TOTAL</p>
          <p className="tnum mt-2 text-2xl font-semibold">
            {formatCents(recurringTotal)}
          </p>
        </div>
        <div className="card fade-up fade-up-2 p-5">
          <p className="text-xs font-medium text-ink-muted">SUBSCRIPTIONS</p>
          <p className="tnum mt-2 text-2xl font-semibold">
            {formatCents(subsTotal)}
            <span className="text-sm text-ink-muted">/mo</span>
          </p>
        </div>
        <div className="card fade-up fade-up-3 p-5">
          <p className="text-xs font-medium text-ink-muted">DUE THIS WEEK</p>
          <p
            className={`tnum mt-2 text-2xl font-semibold ${
              unpaidDueSoon.length > 0 ? "text-warn" : ""
            }`}
          >
            {unpaidDueSoon.length}
          </p>
        </div>
      </section>

      <section className="fade-up fade-up-2 space-y-3">
        {bills.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-sm text-ink-muted">
              No recurring bills yet. Add rent, utilities, insurance, and
              subscriptions to see your true monthly cost.
            </p>
          </div>
        ) : (
          bills.map((bill) => (
            <div
              key={bill.id}
              className="card card-hover flex items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{bill.name}</p>
                  {bill.isSubscription && (
                    <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                      sub
                    </span>
                  )}
                  {flagged.has(bill.id) && (
                    <span
                      className="rounded-full bg-neg-dim px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warn"
                      title="Same price and frequency as another subscription — possible duplicate"
                    >
                      possible duplicate
                    </span>
                  )}
                </div>
                <p
                  className={`mt-0.5 text-xs ${
                    !bill.paidThisCycle && bill.daysUntilDue <= 3
                      ? "text-warn"
                      : "text-ink-muted"
                  }`}
                >
                  {bill.paidThisCycle
                    ? "Paid this cycle"
                    : bill.daysUntilDue === 0
                      ? "Due today"
                      : `Due in ${bill.daysUntilDue} day${bill.daysUntilDue === 1 ? "" : "s"}`}
                  {" · "}
                  {FREQ_LABEL[bill.frequency]}
                  {bill.autopay && " · autopay"}
                  {bill.notes && ` · ${bill.notes}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <p className="tnum text-base font-semibold">
                  {formatCents(bill.amountCents)}
                </p>
                <MarkPaidButton billId={bill.id} paid={bill.paidThisCycle} />
                <DeleteBillButton billId={bill.id} />
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
