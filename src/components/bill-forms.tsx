"use client";

import { Modal } from "@/components/modal";
import { createBill, deleteBill, markBillPaid } from "@/lib/actions/bills";

export function AddBillButton() {
  return (
    <Modal trigger="+ Add bill" title="Add a recurring bill">
      {(close) => (
        <form
          action={async (fd) => {
            await createBill(fd);
            close();
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Rent, Netflix, Car insurance…" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Amount</label>
              <input name="amount" required inputMode="decimal" className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="label">Frequency</label>
              <select name="frequency" className="input" defaultValue="monthly">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="label">Due day</label>
              <input
                name="dueDay"
                type="number"
                min={1}
                max={31}
                defaultValue={1}
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" name="isSubscription" className="accent-[#00c805]" />
              Subscription
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" name="autopay" className="accent-[#00c805]" />
              Autopay
            </label>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input name="notes" className="input" placeholder="Shared with roommate…" />
          </div>
          <button type="submit" className="btn-primary w-full">
            Add bill
          </button>
        </form>
      )}
    </Modal>
  );
}

export function MarkPaidButton({
  billId,
  paid,
}: {
  billId: string;
  paid: boolean;
}) {
  return (
    <form action={markBillPaid}>
      <input type="hidden" name="billId" value={billId} />
      <input type="hidden" name="unpay" value={paid ? "true" : "false"} />
      <button
        type="submit"
        className={
          paid
            ? "rounded-full bg-pos-dim px-3 py-1 text-xs font-medium text-pos transition-opacity hover:opacity-75"
            : "btn-ghost text-xs"
        }
      >
        {paid ? "✓ Paid" : "Mark paid"}
      </button>
    </form>
  );
}

export function DeleteBillButton({ billId }: { billId: string }) {
  return (
    <form
      action={deleteBill}
      onSubmit={(e) => {
        if (!confirm("Remove this recurring bill?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="billId" value={billId} />
      <button type="submit" className="text-xs text-ink-faint transition-colors hover:text-neg">
        ✕
      </button>
    </form>
  );
}
