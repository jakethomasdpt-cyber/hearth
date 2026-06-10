"use client";

import { Modal } from "@/components/modal";
import {
  createAccount,
  deleteAccount,
  updateAccountBalance,
} from "@/lib/actions/accounts";
import { ACCOUNT_TYPE_LABELS } from "@/lib/format";

export function AddAccountButton() {
  return (
    <Modal trigger="+ Add account" title="Add an account">
      {(close) => (
        <form
          action={async (fd) => {
            await createAccount(fd);
            close();
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Account name</label>
            <input name="name" required className="input" placeholder="Joint Checking" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="checking">
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Current balance</label>
              <input
                name="balance"
                required
                inputMode="decimal"
                className="input"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="label">Institution (optional)</label>
            <input name="institution" className="input" placeholder="Chase, Fidelity…" />
          </div>
          <p className="text-xs text-ink-faint">
            For credit cards and loans, enter the amount currently owed.
          </p>
          <button type="submit" className="btn-primary w-full">
            Add account
          </button>
        </form>
      )}
    </Modal>
  );
}

export function UpdateBalanceButton({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  return (
    <Modal
      trigger="Update balance"
      title={`Update ${accountName}`}
      triggerClassName="btn-ghost text-xs"
    >
      {(close) => (
        <form
          action={async (fd) => {
            await updateAccountBalance(fd);
            close();
          }}
          className="space-y-4"
        >
          <input type="hidden" name="accountId" value={accountId} />
          <div>
            <label className="label">New balance</label>
            <input
              name="balance"
              required
              inputMode="decimal"
              className="input"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            Save balance
          </button>
        </form>
      )}
    </Modal>
  );
}

export function DeleteAccountButton({ accountId }: { accountId: string }) {
  return (
    <form
      action={deleteAccount}
      onSubmit={(e) => {
        if (
          !confirm(
            "Delete this account and all of its transactions? This can't be undone."
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" className="text-xs text-ink-faint transition-colors hover:text-neg">
        Delete
      </button>
    </form>
  );
}
