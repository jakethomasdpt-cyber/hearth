/**
 * Seeds a demo household with two partners, accounts, three months of
 * transactions, recurring bills, net worth history, and savings insights.
 *
 * Run with: npm run db:seed
 * Demo logins: demo@hearth.app / partner@hearth.app  (password: demo1234)
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const {
  users,
  households,
  householdMembers,
  accounts,
  transactionCategories,
  transactions,
  recurringBills,
  netWorthSnapshots,
  savingsInsights,
} = schema;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

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

async function main() {
  console.log("Seeding demo household…");

  const existing = await db.query.users.findFirst({
    where: eq(users.email, "demo@hearth.app"),
  });
  if (existing) {
    console.log("Demo data already exists (demo@hearth.app). Skipping.");
    return;
  }

  const passwordHash = await hash("demo1234", 12);

  const [alex] = await db
    .insert(users)
    .values({ name: "Alex Rivera", email: "demo@hearth.app", passwordHash })
    .returning();
  const [sam] = await db
    .insert(users)
    .values({ name: "Sam Rivera", email: "partner@hearth.app", passwordHash })
    .returning();

  const [household] = await db
    .insert(households)
    .values({ name: "The Rivera Household" })
    .returning();

  await db.insert(householdMembers).values([
    { householdId: household.id, userId: alex.id, role: "owner" },
    { householdId: household.id, userId: sam.id, role: "partner" },
  ]);

  // Default (global) categories — created once, shared by all households
  const existingCats = await db.query.transactionCategories.findMany();
  let cats = existingCats;
  if (existingCats.length === 0) {
    cats = await db
      .insert(transactionCategories)
      .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, householdId: null })))
      .returning();
  }
  const cat = (name: string) => cats.find((c) => c.name === name)?.id;

  // Accounts
  const accountRows = await db
    .insert(accounts)
    .values([
      { householdId: household.id, name: "Joint Checking", type: "checking" as const, institution: "Chase", balanceCents: 842_350 },
      { householdId: household.id, name: "Emergency Fund", type: "savings" as const, institution: "Ally", balanceCents: 1_850_000 },
      { householdId: household.id, name: "Brokerage", type: "investment" as const, institution: "Fidelity", balanceCents: 4_625_000 },
      { householdId: household.id, name: "Alex's 401(k)", type: "investment" as const, institution: "Vanguard", balanceCents: 7_890_000 },
      { householdId: household.id, name: "Sapphire Card", type: "credit_card" as const, institution: "Chase", balanceCents: 234_575, isLiability: true },
      { householdId: household.id, name: "Car Loan", type: "loan" as const, institution: "Toyota Financial", balanceCents: 1_645_000, isLiability: true },
    ])
    .returning();
  const acct = (name: string) => accountRows.find((a) => a.name === name)!.id;

  // Three months of transactions
  const tx: (typeof transactions.$inferInsert)[] = [];
  for (let month = 0; month < 3; month++) {
    const base = month * 30;
    tx.push(
      // Income (two paychecks each)
      { type: "deposit", amountCents: 412_500, description: "Alex — Paycheck", categoryId: cat("Salary"), date: iso(daysAgo(base + 1)), accountId: acct("Joint Checking"), createdByUserId: alex.id, householdId: household.id },
      { type: "deposit", amountCents: 412_500, description: "Alex — Paycheck", categoryId: cat("Salary"), date: iso(daysAgo(base + 15)), accountId: acct("Joint Checking"), createdByUserId: alex.id, householdId: household.id },
      { type: "deposit", amountCents: 318_000, description: "Sam — Paycheck", categoryId: cat("Salary"), date: iso(daysAgo(base + 5)), accountId: acct("Joint Checking"), createdByUserId: sam.id, householdId: household.id },
      { type: "deposit", amountCents: 318_000, description: "Sam — Paycheck", categoryId: cat("Salary"), date: iso(daysAgo(base + 19)), accountId: acct("Joint Checking"), createdByUserId: sam.id, householdId: household.id },
      // Housing & utilities
      { type: "withdrawal", amountCents: 285_000, description: "Rent", categoryId: cat("Housing"), date: iso(daysAgo(base + 2)), accountId: acct("Joint Checking"), createdByUserId: alex.id, householdId: household.id },
      { type: "withdrawal", amountCents: 14_250 + month * 1_800, description: "Electric bill", categoryId: cat("Utilities"), date: iso(daysAgo(base + 8)), accountId: acct("Joint Checking"), createdByUserId: sam.id, householdId: household.id },
      { type: "withdrawal", amountCents: 8_999, description: "Internet — Xfinity", categoryId: cat("Utilities"), date: iso(daysAgo(base + 10)), accountId: acct("Joint Checking"), createdByUserId: alex.id, householdId: household.id },
      // Groceries & dining
      { type: "withdrawal", amountCents: 18_432, description: "Whole Foods", categoryId: cat("Groceries"), date: iso(daysAgo(base + 3)), accountId: acct("Sapphire Card"), createdByUserId: sam.id, householdId: household.id, tags: "groceries" },
      { type: "withdrawal", amountCents: 14_217, description: "Trader Joe's", categoryId: cat("Groceries"), date: iso(daysAgo(base + 11)), accountId: acct("Sapphire Card"), createdByUserId: alex.id, householdId: household.id, tags: "groceries" },
      { type: "withdrawal", amountCents: 16_980, description: "Costco run", categoryId: cat("Groceries"), date: iso(daysAgo(base + 20)), accountId: acct("Sapphire Card"), createdByUserId: sam.id, householdId: household.id, tags: "groceries,bulk" },
      { type: "withdrawal", amountCents: 9_850 + month * 2_400, description: "Date night — Luigi's", categoryId: cat("Dining Out"), date: iso(daysAgo(base + 6)), accountId: acct("Sapphire Card"), createdByUserId: alex.id, householdId: household.id, notes: "Anniversary of our first date 💚", tags: "date-night" },
      { type: "withdrawal", amountCents: 6_420, description: "DoorDash", categoryId: cat("Dining Out"), date: iso(daysAgo(base + 13)), accountId: acct("Sapphire Card"), createdByUserId: sam.id, householdId: household.id },
      // Subscriptions
      { type: "withdrawal", amountCents: 1_549, description: "Netflix", categoryId: cat("Subscriptions"), date: iso(daysAgo(base + 4)), accountId: acct("Sapphire Card"), createdByUserId: alex.id, householdId: household.id },
      { type: "withdrawal", amountCents: 1_099, description: "Spotify Premium", categoryId: cat("Subscriptions"), date: iso(daysAgo(base + 4)), accountId: acct("Sapphire Card"), createdByUserId: alex.id, householdId: household.id },
      { type: "withdrawal", amountCents: 1_099, description: "Spotify Premium", categoryId: cat("Subscriptions"), date: iso(daysAgo(base + 5)), accountId: acct("Sapphire Card"), createdByUserId: sam.id, householdId: household.id, notes: "Sam's separate account" },
      { type: "withdrawal", amountCents: 4_999, description: "Equinox… we never go", categoryId: cat("Subscriptions"), date: iso(daysAgo(base + 7)), accountId: acct("Joint Checking"), createdByUserId: sam.id, householdId: household.id },
      // Transport & misc
      { type: "withdrawal", amountCents: 5_240, description: "Shell gas", categoryId: cat("Transportation"), date: iso(daysAgo(base + 9)), accountId: acct("Sapphire Card"), createdByUserId: alex.id, householdId: household.id },
      { type: "withdrawal", amountCents: 38_000, description: "Car payment", categoryId: cat("Transportation"), date: iso(daysAgo(base + 12)), accountId: acct("Joint Checking"), createdByUserId: alex.id, householdId: household.id },
      { type: "withdrawal", amountCents: 12_300 + month * 4_100, description: "Target", categoryId: cat("Shopping"), date: iso(daysAgo(base + 17)), accountId: acct("Sapphire Card"), createdByUserId: sam.id, householdId: household.id },
      // Savings transfer
      { type: "transfer", amountCents: 100_000, description: "Monthly transfer to Emergency Fund", categoryId: cat("Transfer"), date: iso(daysAgo(base + 16)), accountId: acct("Joint Checking"), createdByUserId: alex.id, householdId: household.id, notes: "Automatic savings" },
      // Credit card payment
      { type: "deposit", amountCents: 180_000, description: "Card payment — thank you", categoryId: cat("Transfer"), date: iso(daysAgo(base + 22)), accountId: acct("Sapphire Card"), createdByUserId: alex.id, householdId: household.id }
    );
  }
  await db.insert(transactions).values(tx);

  // Recurring bills & subscriptions
  await db.insert(recurringBills).values([
    { householdId: household.id, name: "Rent", amountCents: 285_000, frequency: "monthly", dueDay: 1, autopay: true },
    { householdId: household.id, name: "Car payment", amountCents: 38_000, frequency: "monthly", dueDay: 12, autopay: true },
    { householdId: household.id, name: "Car insurance", amountCents: 31_400, frequency: "quarterly", dueDay: 15 },
    { householdId: household.id, name: "Electric", amountCents: 16_000, frequency: "monthly", dueDay: 8 },
    { householdId: household.id, name: "Internet — Xfinity", amountCents: 8_999, frequency: "monthly", dueDay: 10, autopay: true },
    { householdId: household.id, name: "Netflix", amountCents: 1_549, frequency: "monthly", dueDay: 4, isSubscription: true, autopay: true },
    { householdId: household.id, name: "Spotify (Alex)", amountCents: 1_099, frequency: "monthly", dueDay: 4, isSubscription: true, autopay: true },
    { householdId: household.id, name: "Spotify (Sam)", amountCents: 1_099, frequency: "monthly", dueDay: 5, isSubscription: true, autopay: true },
    { householdId: household.id, name: "Equinox gym", amountCents: 4_999, frequency: "monthly", dueDay: 7, isSubscription: true, notes: "Last visit: 3 months ago" },
    { householdId: household.id, name: "iCloud storage", amountCents: 299, frequency: "monthly", dueDay: 18, isSubscription: true, autopay: true },
    { householdId: household.id, name: "Amazon Prime", amountCents: 13_900, frequency: "yearly", dueDay: 22, isSubscription: true, autopay: true },
  ]);

  // Net worth history — gentle upward trend over ~6 months
  const todayNetWorth = 12_500_000 + 842_350 + 1_850_000 + 4_625_000 + 7_890_000 - 234_575 - 1_645_000 - 12_500_000; // = sum of accounts
  const finalNW = 842_350 + 1_850_000 + 4_625_000 + 7_890_000 - 234_575 - 1_645_000;
  const snapshots = [];
  for (let i = 26; i >= 0; i--) {
    const wobble = Math.sin(i * 1.7) * 95_000;
    const progress = (26 - i) / 26;
    const nw = Math.round(finalNW - 900_000 + 900_000 * progress + (i === 0 ? 0 : wobble));
    const assets = nw + 1_879_575; // liabilities held roughly constant
    snapshots.push({
      householdId: household.id,
      date: iso(daysAgo(i * 7)),
      assetsCents: assets,
      liabilitiesCents: 1_879_575,
      netWorthCents: nw,
    });
  }
  await db.insert(netWorthSnapshots).values(snapshots);
  void todayNetWorth;

  // Savings insights
  await db.insert(savingsInsights).values([
    {
      householdId: household.id,
      type: "cancel",
      title: "Two Spotify subscriptions",
      body: "You're both paying for individual Spotify Premium ($10.99 × 2). A Duo plan is $14.99/mo — switching saves about $7/mo.",
      estimatedMonthlySavingsCents: 700,
    },
    {
      householdId: household.id,
      type: "review",
      title: "Equinox membership looks unused",
      body: "No gym-related activity in 3 months while paying $49.99/mo. Worth a conversation: keep, pause, or cancel?",
      estimatedMonthlySavingsCents: 4_999,
    },
    {
      householdId: household.id,
      type: "negotiate",
      title: "Internet bill is above market",
      body: "Xfinity at $89.99/mo is ~$25 above promotional rates in most areas. A retention call usually gets the promo price.",
      estimatedMonthlySavingsCents: 2_500,
    },
    {
      householdId: household.id,
      type: "reduce",
      title: "Dining out is trending up",
      body: "Dining spend rose ~24% over the last two months. Setting a shared monthly dining number could free up ~$60/mo.",
      estimatedMonthlySavingsCents: 6_000,
    },
  ]);

  console.log("✓ Seeded demo household");
  console.log("  Login: demo@hearth.app / demo1234");
  console.log("  Partner: partner@hearth.app / demo1234");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
