"use server";

import { hash } from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import {
  users,
  households,
  householdMembers,
  householdInvites,
  transactionCategories,
} from "@/db/schema";

const DEFAULT_CATEGORIES: { name: string; kind: "income" | "expense" | "transfer" }[] = [
  { name: "Salary", kind: "income" },
  { name: "Other Income", kind: "income" },
  { name: "Housing", kind: "expense" },
  { name: "Groceries", kind: "expense" },
  { name: "Dining Out", kind: "expense" },
  { name: "Transportation", kind: "expense" },
  { name: "Utilities", kind: "expense" },
  { name: "Subscriptions", kind: "expense" },
  { name: "Health", kind: "expense" },
  { name: "Shopping", kind: "expense" },
  { name: "Travel", kind: "expense" },
  { name: "Transfer", kind: "transfer" },
];

/** Makes sure the shared default categories exist (first signup creates them). */
async function ensureDefaultCategories() {
  const existing = await db.query.transactionCategories.findFirst();
  if (!existing) {
    await db
      .insert(transactionCategories)
      .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, householdId: null })));
  }
}

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signup(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) return { error: "An account with this email already exists." };

  const passwordHash = await hash(parsed.data.password, 12);
  await ensureDefaultCategories();

  const [user] = await db
    .insert(users)
    .values({ name: parsed.data.name, email, passwordHash })
    .returning();

  // If this email was invited to an existing household, join it.
  const invite = await db.query.householdInvites.findFirst({
    where: and(
      eq(householdInvites.email, email),
      eq(householdInvites.status, "pending")
    ),
  });

  if (invite) {
    await db.insert(householdMembers).values({
      householdId: invite.householdId,
      userId: user.id,
      role: "partner",
    });
    await db
      .update(householdInvites)
      .set({ status: "accepted" })
      .where(eq(householdInvites.id, invite.id));
  } else {
    const [household] = await db
      .insert(households)
      .values({ name: `${parsed.data.name.split(" ")[0]}'s Household` })
      .returning();
    await db.insert(householdMembers).values({
      householdId: household.id,
      userId: user.id,
      role: "owner",
    });
  }

  await signIn("credentials", {
    email,
    password: parsed.data.password,
    redirect: false,
  });
  redirect("/dashboard");
}

export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? "").toLowerCase(),
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
  redirect("/dashboard");
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
