"use client";

import { Modal } from "@/components/modal";
import {
  createTransaction,
  deleteTransaction,
} from "@/lib/actions/transactions";

type Option = { id: string; name: string };

export function AddTransactionButton({
  accounts,
  categories,
}: {
  accounts: Option[];
  categories: { id: string; name: string; kind: string }[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal trigger="+ Add transaction" title="Add a transaction">
      {(close) => (
        <form
          action={async (fd) => {
            await createTransaction(fd);
            close();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="withdrawal">
                <option value="withdrawal">Withdrawal</option>
                <option value="deposit">Deposit</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input
                name="amount"
                required
                inputMode="decimal"
                className="input"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="label">Account</label>
            <select name="accountId" required className="input">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input
              name="description"
              required
              className="input"
              placeholder="Groceries at Trader Joe's"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select name="categoryId" className="input" defaultValue="">
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input name="date" type="date" defaultValue={today} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Tags (comma-separated, optional)</label>
            <input name="tags" className="input" placeholder="groceries, weekly" />
          </div>
          <div>
            <label className="label">Note for your partner (optional)</label>
            <input name="notes" className="input" placeholder="Split this one?" />
          </div>
          <button type="submit" className="btn-primary w-full">
            Save transaction
          </button>
        </form>
      )}
    </Modal>
  );
}

export function DeleteTransactionButton({ transactionId }: { transactionId: string }) {
  return (
    <form
      action={deleteTransaction}
      onSubmit={(e) => {
        if (!confirm("Delete this transaction? The account balance will be adjusted."))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="transactionId" value={transactionId} />
      <button
        type="submit"
        className="text-xs text-ink-faint transition-colors hover:text-neg"
        title="Delete transaction"
      >
        ✕
      </button>
    </form>
  );
}
