"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  transactions,
  uploadedStatements,
  type ParsedTransaction,
} from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";
import { parseStatementText } from "@/lib/statement-parser";

export async function uploadStatement(formData: FormData) {
  const { householdId, userId } = await getHouseholdContext();

  const file = formData.get("file");
  const accountId = String(formData.get("accountId") || "") || null;
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a PDF file to upload.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("PDF is too large (10 MB max).");
  }

  const [statement] = await db
    .insert(uploadedStatements)
    .values({
      householdId,
      accountId,
      filename: file.name,
      status: "parsing",
      uploadedByUserId: userId,
    })
    .returning();

  try {
    const { extractText } = await import("unpdf");
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { text } = await extractText(buffer, { mergePages: true });
    const parsed = parseStatementText(Array.isArray(text) ? text.join("\n") : text);

    await db
      .update(uploadedStatements)
      .set({
        status: parsed.length > 0 ? "review" : "failed",
        parsedData: parsed,
      })
      .where(eq(uploadedStatements.id, statement.id));
  } catch {
    await db
      .update(uploadedStatements)
      .set({ status: "failed" })
      .where(eq(uploadedStatements.id, statement.id));
    revalidatePath("/import");
    return;
  }

  revalidatePath("/import");
  redirect(`/import/${statement.id}`);
}

const importRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(200),
  amountCents: z.number().int().positive(),
  type: z.enum(["deposit", "withdrawal"]),
  categoryId: z.string().uuid().nullable().optional(),
});

export async function importStatementTransactions(
  statementId: string,
  accountId: string,
  rowsJson: string
) {
  const { householdId, userId } = await getHouseholdContext();

  const statement = await db.query.uploadedStatements.findFirst({
    where: and(
      eq(uploadedStatements.id, statementId),
      eq(uploadedStatements.householdId, householdId)
    ),
  });
  if (!statement || statement.status !== "review") {
    throw new Error("Statement not found or already imported.");
  }

  const rows = z.array(importRowSchema).max(500).parse(JSON.parse(rowsJson));
  if (rows.length === 0) throw new Error("No transactions selected.");

  // Historical statement activity is already reflected in the account's
  // current balance, so importing does NOT adjust balances.
  await db.insert(transactions).values(
    rows.map((row) => ({
      householdId,
      accountId,
      type: row.type,
      amountCents: row.amountCents,
      categoryId: row.categoryId ?? null,
      description: row.description,
      date: row.date,
      notes: `Imported from ${statement.filename}`,
      createdByUserId: userId,
    }))
  );

  await db
    .update(uploadedStatements)
    .set({ status: "imported", importedCount: rows.length, accountId })
    .where(eq(uploadedStatements.id, statementId));

  revalidatePath("/", "layout");
  redirect("/transactions");
}

export async function deleteStatement(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const id = String(formData.get("statementId"));
  await db
    .delete(uploadedStatements)
    .where(
      and(
        eq(uploadedStatements.id, id),
        eq(uploadedStatements.householdId, householdId)
      )
    );
  revalidatePath("/import");
}
