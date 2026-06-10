"use client";

import { useMemo, useState, useTransition } from "react";
import type { ParsedTransaction } from "@/db/schema";
import { importStatementTransactions } from "@/lib/actions/statements";
import { formatCents } from "@/lib/format";

type Row = ParsedTransaction & {
  include: boolean;
  categoryId: string | null;
};

export function ReviewTable({
  statementId,
  initialRows,
  accounts,
  categories,
  defaultAccountId,
}: {
  statementId: string;
  initialRows: ParsedTransaction[];
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  defaultAccountId: string | null;
}) {
  const [rows, setRows] = useState<Row[]>(
    initialRows.map((r) => ({ ...r, include: true, categoryId: null }))
  );
  const [accountId, setAccountId] = useState(
    defaultAccountId ?? accounts[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const selected = useMemo(() => rows.filter((r) => r.include), [rows]);
  const totals = useMemo(() => {
    let inCents = 0;
    let outCents = 0;
    for (const r of selected) {
      if (r.type === "deposit") inCents += r.amountCents;
      else outCents += r.amountCents;
    }
    return { inCents, outCents };
  }, [selected]);

  const submit = () => {
    if (!accountId) {
      setError("Choose which account this statement belongs to.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await importStatementTransactions(
          statementId,
          accountId,
          JSON.stringify(
            selected.map(({ date, description, amountCents, type, categoryId }) => ({
              date,
              description,
              amountCents,
              type,
              categoryId,
            }))
          )
        );
      } catch (e) {
        // Next.js redirect() throws — let it through
        if (e && typeof e === "object" && "digest" in e) throw e;
        setError(e instanceof Error ? e.message : "Import failed.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card flex flex-wrap items-end justify-between gap-4 p-5">
        <div className="min-w-56">
          <label className="label">Import into account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="input"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <p className="text-ink-muted">
            <span className="font-semibold text-ink">{selected.length}</span> of{" "}
            {rows.length} selected
          </p>
          <p className="tnum text-pos">+{formatCents(totals.inCents)}</p>
          <p className="tnum text-neg">−{formatCents(totals.outCents)}</p>
          <button
            type="button"
            onClick={submit}
            disabled={pending || selected.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            {pending ? "Importing…" : `Import ${selected.length} transactions`}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-neg">{error}</p>}

      {/* Rows */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs text-ink-muted">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  className="accent-[#00c805]"
                  checked={selected.length === rows.length}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) => ({ ...r, include: e.target.checked }))
                    )
                  }
                />
              </th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-edge/50 last:border-0 ${
                  row.include ? "" : "opacity-40"
                }`}
              >
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="accent-[#00c805]"
                    checked={row.include}
                    onChange={(e) => update(i, { include: e.target.checked })}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => update(i, { date: e.target.value })}
                    className="input w-36 px-2 py-1.5 text-xs"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    value={row.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    className="input min-w-48 px-2 py-1.5 text-xs"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={row.type}
                    onChange={(e) =>
                      update(i, { type: e.target.value as Row["type"] })
                    }
                    className={`input w-32 px-2 py-1.5 text-xs ${
                      row.type === "deposit" ? "text-pos" : ""
                    }`}
                  >
                    <option value="withdrawal">Withdrawal</option>
                    <option value="deposit">Deposit</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={row.categoryId ?? ""}
                    onChange={(e) =>
                      update(i, { categoryId: e.target.value || null })
                    }
                    className="input w-36 px-2 py-1.5 text-xs"
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <input
                    value={(row.amountCents / 100).toFixed(2)}
                    onChange={(e) => {
                      const v = Math.round(parseFloat(e.target.value || "0") * 100);
                      if (!isNaN(v) && v >= 0) update(i, { amountCents: v });
                    }}
                    inputMode="decimal"
                    className={`input tnum w-28 px-2 py-1.5 text-right text-xs ${
                      row.type === "deposit" ? "text-pos" : ""
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
