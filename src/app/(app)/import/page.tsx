import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedStatements } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { getAccounts } from "@/lib/queries";
import { deleteStatement, uploadStatement } from "@/lib/actions/statements";
import { formatDate } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  review: "bg-pos-dim text-pos",
  imported: "border border-edge text-ink-muted",
  failed: "bg-neg-dim text-neg",
  parsing: "border border-edge text-warn",
  uploaded: "border border-edge text-ink-muted",
};

export default async function ImportPage() {
  const ctx = await getHouseholdContext();
  const [statements, accounts] = await Promise.all([
    db.query.uploadedStatements.findMany({
      where: eq(uploadedStatements.householdId, ctx.householdId),
      orderBy: [desc(uploadedStatements.createdAt)],
    }),
    getAccounts(ctx.householdId),
  ]);

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <h1 className="text-xl font-semibold tracking-tight">
          Import Statements
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Upload a PDF bank statement. We'll extract the transactions and you
          review everything before anything is saved.
        </p>
      </header>

      <section className="card fade-up fade-up-1 p-6">
        <h2 className="mb-4 text-sm font-semibold">Upload a statement</h2>
        <form action={uploadStatement} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className="label">PDF file</label>
            <input
              type="file"
              name="file"
              accept="application/pdf"
              required
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-surface-raised file:px-3 file:py-1 file:text-xs file:text-ink"
            />
          </div>
          <div className="min-w-48">
            <label className="label">Account (optional, can set later)</label>
            <select name="accountId" className="input" defaultValue="">
              <option value="">Choose later</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Upload & extract
          </button>
        </form>
        <p className="mt-3 text-xs text-ink-faint">
          Statement layouts vary by bank — extraction is best-effort and every
          transaction is staged for your review first. Nothing touches your
          data until you confirm. Imported history doesn't change current
          account balances.
        </p>
      </section>

      {statements.length > 0 && (
        <section className="fade-up fade-up-2 space-y-3">
          <h2 className="text-sm font-semibold text-ink-muted">History</h2>
          {statements.map((s) => (
            <div
              key={s.id}
              className="card card-hover flex items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.filename}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {formatDate(s.createdAt)}
                  {s.status === "review" &&
                    s.parsedData &&
                    ` · ${s.parsedData.length} transactions found`}
                  {s.status === "imported" &&
                    ` · ${s.importedCount ?? 0} transactions imported`}
                  {s.status === "failed" &&
                    " · couldn't extract transactions from this PDF"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLE[s.status]}`}
                >
                  {s.status}
                </span>
                {s.status === "review" && (
                  <Link href={`/import/${s.id}`} className="btn-primary text-xs">
                    Review →
                  </Link>
                )}
                <form action={deleteStatement}>
                  <input type="hidden" name="statementId" value={s.id} />
                  <button
                    type="submit"
                    className="text-xs text-ink-faint transition-colors hover:text-neg"
                  >
                    ✕
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card fade-up fade-up-3 border-dashed p-5">
        <p className="text-xs leading-relaxed text-ink-faint">
          <span className="font-medium text-ink-muted">
            Coming soon — secure bank linking.
          </span>{" "}
          Hearth's data model is ready for automatic sync via Plaid: accounts
          and transactions will populate themselves, and statement uploads
          become optional. Manual + PDF import keeps you fully in control
          until then.
        </p>
      </section>
    </div>
  );
}
