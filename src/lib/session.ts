import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { householdMembers } from "@/db/schema";

/**
 * Returns the logged-in user and their household context.
 * Every data query in the app MUST be scoped by householdId —
 * this is the account-based data separation boundary.
 */
export const getHouseholdContext = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, session.user.id),
    with: { household: true, user: true },
  });
  if (!membership) redirect("/login");

  return {
    userId: session.user.id,
    userName: membership.user.name,
    userEmail: membership.user.email,
    householdId: membership.householdId,
    householdName: membership.household.name,
    role: membership.role,
  };
});
