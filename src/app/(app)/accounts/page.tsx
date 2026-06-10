import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tellerEnrollments } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { getNetWorth } from "@/lib/queries";
import {
  AddAccountButton,
  DeleteAccountButton,
  UpdateBalanceButton,
} from "@/components/account-forms";
import { SyncNowButton, TellerConnectButton } from "@/components/teller-connect";
import { unlinkEnrollment } from "@/lib/actions/teller";
import { tellerEnvironment } from "@/lib/teller";
import { ACCOUNT_TYPE_LABELS, formatCents, formatDate } from "@/lib/format";

export default async function AccountsPage() {
  const ctx = await getHouseholdContext();
  const [{ accounts, assetsCents, liabilitiesCents, netWorthCents }, enrollments] =
    await Promise.all([
      getNetWorth(ctx.householdId),
      db.query.tellerEnrollments.findMany({
        where: eq(tellerEnrollments.householdId, ctx.householdId),
      }),
    ]);

  const assets = accounts.filter((a) => !a.isLiability);
  const liabilities = accounts.filter((a) => a.isLiability);

  return (
    <div className="space-y-6">
      <header className="fade-up flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Everything you both own and owe, in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AddAccountButton />
          <TellerConnectButton
            applicationId={process.env.TELLER_APPLICATION_ID ?? ""}
            environment={tellerEnvironment()}
          />
        </div>
      </header>

      {/* Linked institutions */}
      <section className="card fade-up fade-up-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Linked banks</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {enrollments.length === 0
                ? "No banks linked yet — link one to sync balances and transactions automatically every day."
                : "Balances and transactions sync automatically once a day."}
            </p>
          </div>
          {enrollments.length > 0 && <SyncNowButton />}
        </div>
        {enrollments.length > 0 && (
          <ul className="mt-4 space-y-2">
            {enrollments.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-xl bg-surface-raised px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{e.institutionName}</p>
                  <p className="text-xs text-ink-faint">
                    {e.status === "disconnected"
                      ? "Disconnected — re-link to resume syncing"
                      : e.lastSyncedAt
                        ? `Last synced ${formatDate(e.lastSyncedAt)}`
                        : "Not synced yet"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {e.status === "disconnected" && (
                    <span className="rounded-full bg-neg-dim px-2 py-0.5 text-[10px] font-medium uppercase text-neg">
                      re-link needed
                    </span>
                  )}
                  <form action={unlinkEnrollment}>
                    <input type="hidden" name="enrollmentId" value={e.id} />
                    <button
                      type="submit"
                      className="text-xs text-ink-faint transition-colors hover:text-neg"
                    >
                      Unlink
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <div className="card fade-up fade-up-1 p-5">
          <p className="text-xs font-medium text-ink-muted">TOTAL ASSETS</p>
          <p className="tnum mt-2 text-2xl font-semibold text-pos">
            {formatCents(assetsCents)}
          </p>
        </div>
        <div className="card fade-up fade-up-2 p-5">
          <p className="text-xs font-medium text-ink-muted">TOTAL OWED</p>
          <p className="tnum mt-2 text-2xl font-semibold text-neg">
            {formatCents(liabilitiesCents)}
          </p>
        </div>
        <div className="card fade-up fade-up-3 p-5">
          <p className="text-xs font-medium text-ink-muted">NET WORTH</p>
          <p className="tnum mt-2 text-2xl font-semibold">
            {formatCents(netWorthCents)}
          </p>
        </div>
      </section>

      {[
        { title: "Assets", list: assets },
        { title: "Liabilities", list: liabilities },
      ].map(
        ({ title, list }) =>
          list.length > 0 && (
            <section key={title} className="fade-up fade-up-2">
              <h2 className="mb-3 text-sm font-semibold text-ink-muted">
                {title}
              </h2>
              <div className="space-y-3">
                {list.map((account) => (
                  <div
                    key={account.id}
                    className="card card-hover flex items-center justify-between gap-4 p-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {account.name}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                        {account.institution && ` · ${account.institution}`}
                        {" · updated "}
                        {formatDate(account.updatedAt)}
                        {account.tellerAccountId && (
                          <span className="ml-2 rounded-full bg-pos-dim px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-pos">
                            auto-sync
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <p
                        className={`tnum text-base font-semibold ${
                          account.isLiability ? "text-neg" : ""
                        }`}
                      >
                        {account.isLiability && "−"}
                        {formatCents(account.balanceCents)}
                      </p>
                      <UpdateBalanceButton
                        accountId={account.id}
                        accountName={account.name}
                      />
                      <DeleteAccountButton accountId={account.id} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
      )}

      {accounts.length === 0 && (
        <div className="card fade-up p-12 text-center">
          <p className="text-sm text-ink-muted">
            No accounts yet. Add your checking, savings, credit cards, and
            loans to see your household net worth.
          </p>
        </div>
      )}
    </div>
  );
}
