import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedStatements } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { getAccounts, getCategories } from "@/lib/queries";
import { ReviewTable } from "@/components/review-table";

export default async function ReviewStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getHouseholdContext();
  const { id } = await params;

  const statement = await db.query.uploadedStatements.findFirst({
    where: and(
      eq(uploadedStatements.id, id),
      eq(uploadedStatements.householdId, ctx.householdId)
    ),
  });
  if (!statement) notFound();
  if (statement.status !== "review" || !statement.parsedData) {
    redirect("/import");
  }

  const [accounts, categories] = await Promise.all([
    getAccounts(ctx.householdId),
    getCategories(ctx.householdId),
  ]);

  return (
    <div className="space-y-6">
      <header className="fade-up">
        <Link href="/import" className="text-xs text-ink-muted hover:text-ink">
          ← Back to imports
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Review: {statement.filename}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Check each transaction before importing. Uncheck anything that's
          wrong, fix descriptions and amounts, and assign categories.
        </p>
      </header>

      <div className="fade-up fade-up-1">
        <ReviewTable
          statementId={statement.id}
          initialRows={statement.parsedData}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          defaultAccountId={statement.accountId}
        />
      </div>
    </div>
  );
}
