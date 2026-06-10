"use client";

import { useState } from "react";
import { setBudget } from "@/lib/actions/budgets";
import { formatCents } from "@/lib/format";

export function BudgetRow({
  categoryId,
  categoryName,
  budgetCents,
  spentCents,
}: {
  categoryId: string;
  categoryName: string;
  budgetCents: number | null;
  spentCents: number;
}) {
  const [editing, setEditing] = useState(false);

  const pct = budgetCents ? Math.min(100, (spentCents / budgetCents) * 100) : 0;
  const over = budgetCents !== null && spentCents > budgetCents;
  const near = budgetCents !== null && !over && pct >= 85;
  const barColor = over ? "bg-neg" : near ? "bg-warn" : "bg-pos";

  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{categoryName}</p>
            <p className="tnum text-sm">
              <span className={over ? "font-semibold text-neg" : ""}>
                {formatCents(spentCents)}
              </span>
              {budgetCents !== null && (
                <span className="text-ink-muted"> / {formatCents(budgetCents)}</span>
              )}
            </p>
          </div>

          {budgetCents !== null ? (
            <>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              <p
                className={`mt-1.5 text-xs ${
                  over ? "text-neg" : near ? "text-warn" : "text-ink-faint"
                }`}
              >
                {over
                  ? `${formatCents(spentCents - budgetCents)} over budget`
                  : `${formatCents(budgetCents - spentCents)} left this month`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-ink-faint">
              No budget set{spentCents > 0 && " · spending untracked against a limit"}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {editing ? (
            <form
              action={async (fd) => {
                await setBudget(fd);
                setEditing(false);
              }}
              className="flex items-center gap-2"
            >
              <input type="hidden" name="categoryId" value={categoryId} />
              <input
                name="amount"
                inputMode="decimal"
                autoFocus
                defaultValue={budgetCents ? (budgetCents / 100).toFixed(2) : ""}
                placeholder="0 = remove"
                className="input w-28 px-2 py-1.5 text-sm"
              />
              <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn-ghost px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-ghost text-xs"
            >
              {budgetCents === null ? "Set budget" : "Edit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
