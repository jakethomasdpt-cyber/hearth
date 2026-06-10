"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { householdInvites, households } from "@/db/schema";
import { getHouseholdContext } from "@/lib/session";

export async function invitePartner(
  _prev: { error?: string; success?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const { householdId, userId, userEmail } = await getHouseholdContext();

  const parsed = z.string().email().safeParse(
    String(formData.get("email") ?? "").toLowerCase()
  );
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (parsed.data === userEmail.toLowerCase())
    return { error: "That's your own email." };

  const existing = await db.query.householdInvites.findFirst({
    where: and(
      eq(householdInvites.householdId, householdId),
      eq(householdInvites.email, parsed.data),
      eq(householdInvites.status, "pending")
    ),
  });
  if (existing) return { error: "An invite for this email is already pending." };

  await db.insert(householdInvites).values({
    householdId,
    email: parsed.data,
    invitedByUserId: userId,
  });

  revalidatePath("/settings");
  return {
    success: `Invite created. When ${parsed.data} signs up, they'll automatically join your household.`,
  };
}

export async function revokeInvite(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const inviteId = String(formData.get("inviteId"));

  await db
    .update(householdInvites)
    .set({ status: "revoked" })
    .where(
      and(
        eq(householdInvites.id, inviteId),
        eq(householdInvites.householdId, householdId)
      )
    );

  revalidatePath("/settings");
}

export async function renameHousehold(formData: FormData) {
  const { householdId } = await getHouseholdContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await db
    .update(households)
    .set({ name })
    .where(eq(households.id, householdId));

  revalidatePath("/", "layout");
}
