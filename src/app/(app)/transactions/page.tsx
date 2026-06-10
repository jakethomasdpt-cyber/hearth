import Form from "next/form";
import { getHouseholdContext } from "@/lib/session";
import { getAccounts, getCategories, getTransactions } from "@/lib/queries";
import {
  AddTransactionButton,
  DeleteTransactionButton,
} from "@/components/transaction-forms";
import { formatCents, formatDate } from "@/lib/format";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; account?: string }>;
}) {
  const ctx = await getHouseholdContext();
  const params = await searchParams;

  const [transactions, accounts, categories] = await Promise.all([
    getTransactions(ctx.householdId, {
      q: params.q,
      type: params.type,
      accountId: params.account,
    }),
    getAccounts(ctx.householdId),
    getCategories(ctx.householdId),
  ]);

  return (
    <div className="space-y-6">
      <header className="fade-up flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every deposit, withdrawal, and transfer — visible to both of you.
          </p>
        </div>
        <AddTransactionButton
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          categories={categories}
        />
      </header>

      {/* Filters */}
      <Form action="/transactions" className="fade-up fade-up-1 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={params.q}
          className="input max-w-xs"
          placeholder="Search description, notes, tags…"
        />
        <select name="type" defaultValue={params.type ?? ""} className="input max-w-40">
          <option value="">All types</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
          <option value="transfer">Transfers</option>
        </select>
        <select
          name="account"
          defaultValue={params.account ?? ""}
          className="input max-w-48"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-ghost">
          Filter
        </button>
      </Form>

      {/* List */}
      <section className="card fade-up fade-up-2 overflow-hidden">
        {transactions.length === 0 ? (
          <p className="p-12 text-center text-sm text-ink-faint">
            No transactions match. Try clearing your filters or add one.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-xs text-ink-muted">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium max-md:hidden">Account</th>
                <th className="px-5 py-3 font-medium max-md:hidden">Category</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-edge/50 transition-colors last:border-0 hover:bg-surface-raised/40"
                >
                  <td className="tnum whitespace-nowrap px-5 py-3.5 text-ink-muted">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{tx.description}</p>
                    {(tx.notes || tx.tags) && (
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {tx.notes}
                        {tx.notes && tx.tags && " · "}
                        {tx.tags &&
                          tx.tags
                            .split(",")
                            .map((t) => `#${t.trim()}`)
                            .join(" ")}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted max-md:hidden">
                    {tx.account.name}
                  </td>
                  <td className="px-5 py-3.5 max-md:hidden">
                    {tx.category ? (
                      <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
                        {tx.category.name}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </td>
                  <td
                    className={`tnum whitespace-nowrap px-5 py-3.5 text-right font-medium ${
                      tx.type === "deposit"
                        ? "text-pos"
                        : tx.type === "transfer"
                          ? "text-ink-muted"
                          : ""
                    }`}
                  >
                    {tx.type === "deposit" ? "+" : tx.type === "withdrawal" ? "−" : "⇄ "}
                    {formatCents(tx.amountCents)}
                  </td>
                  <td className="px-2 py-3.5">
                    <DeleteTransactionButton transactionId={tx.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
