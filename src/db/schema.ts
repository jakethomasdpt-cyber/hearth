import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
  date,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------

export const memberRoleEnum = pgEnum("member_role", ["owner", "partner"]);
export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "revoked",
]);
export const accountTypeEnum = pgEnum("account_type", [
  "checking",
  "savings",
  "investment",
  "credit_card",
  "loan",
  "property",
  "other",
]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "withdrawal",
  "transfer",
]);
export const categoryKindEnum = pgEnum("category_kind", [
  "income",
  "expense",
  "transfer",
]);
export const billFrequencyEnum = pgEnum("bill_frequency", [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "flagged",
  "cancelled",
]);
export const subscriptionSourceEnum = pgEnum("subscription_source", [
  "manual",
  "detected",
]);
export const statementStatusEnum = pgEnum("statement_status", [
  "uploaded",
  "parsing",
  "review",
  "imported",
  "failed",
]);
export const insightTypeEnum = pgEnum("insight_type", [
  "cancel",
  "negotiate",
  "reduce",
  "review",
]);
export const insightStatusEnum = pgEnum("insight_status", [
  "open",
  "done",
  "dismissed",
]);

// ---------- Core identity ----------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("partner"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("household_member_unique").on(t.householdId, t.userId)]
);

export const householdInvites = pgTable("household_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  status: inviteStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Bank sync (Teller) ----------

export const tellerEnrollments = pgTable("teller_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  /** Teller access token — used as Basic auth username against api.teller.io */
  accessToken: text("access_token").notNull(),
  enrollmentId: text("enrollment_id").notNull(),
  institutionName: text("institution_name").notNull(),
  linkedByUserId: uuid("linked_by_user_id").references(() => users.id),
  status: text("status").notNull().default("active"), // active | disconnected
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Money ----------
// All monetary values are stored as integer cents (bigint) to avoid
// floating-point errors. Liability balances (credit cards, loans) are
// stored as positive numbers and subtracted during net worth calculation.

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: accountTypeEnum("type").notNull(),
    institution: text("institution"),
    balanceCents: bigint("balance_cents", { mode: "number" })
      .notNull()
      .default(0),
    isLiability: boolean("is_liability").notNull().default(false),
    /** Set when this account is synced from a Teller enrollment. */
    tellerAccountId: text("teller_account_id").unique(),
    tellerEnrollmentId: uuid("teller_enrollment_id").references(
      () => tellerEnrollments.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("accounts_household_idx").on(t.householdId)]
);

export const transactionCategories = pgTable("transaction_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => households.id, {
    onDelete: "cascade",
  }), // null = built-in default category
  name: text("name").notNull(),
  kind: categoryKindEnum("kind").notNull().default("expense"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(), // always positive; sign derived from type
    categoryId: uuid("category_id").references(
      () => transactionCategories.id,
      { onDelete: "set null" }
    ),
    description: text("description").notNull(),
    notes: text("notes"),
    tags: text("tags"), // comma-separated for v1
    date: date("date").notNull(),
    /** Teller transaction id — dedupe key for bank sync. */
    tellerTransactionId: text("teller_transaction_id"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("transactions_household_date_idx").on(t.householdId, t.date),
    index("transactions_account_idx").on(t.accountId),
    uniqueIndex("transactions_teller_id_unique").on(t.tellerTransactionId),
  ]
);

// ---------- Bills & subscriptions ----------

export const recurringBills = pgTable(
  "recurring_bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    frequency: billFrequencyEnum("frequency").notNull().default("monthly"),
    dueDay: integer("due_day").notNull().default(1), // day of month (1-31)
    isSubscription: boolean("is_subscription").notNull().default(false),
    autopay: boolean("autopay").notNull().default(false),
    lastPaidOn: date("last_paid_on"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("bills_household_idx").on(t.householdId)]
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  merchant: text("merchant").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  frequency: billFrequencyEnum("frequency").notNull().default("monthly"),
  firstSeenOn: date("first_seen_on"),
  lastSeenOn: date("last_seen_on"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  source: subscriptionSourceEnum("source").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Budgets ----------

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => transactionCategories.id, { onDelete: "cascade" }),
    /** Monthly budget amount in cents. */
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("budget_unique").on(t.householdId, t.categoryId)]
);

export const budgetsRelations = relations(budgets, ({ one }) => ({
  category: one(transactionCategories, {
    fields: [budgets.categoryId],
    references: [transactionCategories.id],
  }),
}));

// ---------- Statements (Phase 2: PDF import) ----------

export const uploadedStatements = pgTable("uploaded_statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  filename: text("filename").notNull(),
  status: statementStatusEnum("status").notNull().default("uploaded"),
  /** Transactions extracted from the PDF, staged for review before import. */
  parsedData: jsonb("parsed_data").$type<ParsedTransaction[]>(),
  importedCount: integer("imported_count"),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ParsedTransaction = {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number; // always positive
  type: "deposit" | "withdrawal";
};

// ---------- History & intelligence ----------

export const netWorthSnapshots = pgTable(
  "net_worth_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    assetsCents: bigint("assets_cents", { mode: "number" }).notNull(),
    liabilitiesCents: bigint("liabilities_cents", { mode: "number" }).notNull(),
    netWorthCents: bigint("net_worth_cents", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("snapshot_unique").on(t.householdId, t.date)]
);

export const savingsInsights = pgTable("savings_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  type: insightTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  estimatedMonthlySavingsCents: bigint("estimated_monthly_savings_cents", {
    mode: "number",
  })
    .notNull()
    .default(0),
  status: insightStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Relations ----------

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(householdMembers),
}));

export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  accounts: many(accounts),
  transactions: many(transactions),
  bills: many(recurringBills),
}));

export const householdMembersRelations = relations(
  householdMembers,
  ({ one }) => ({
    household: one(households, {
      fields: [householdMembers.householdId],
      references: [households.id],
    }),
    user: one(users, {
      fields: [householdMembers.userId],
      references: [users.id],
    }),
  })
);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  household: one(households, {
    fields: [accounts.householdId],
    references: [households.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  category: one(transactionCategories, {
    fields: [transactions.categoryId],
    references: [transactionCategories.id],
  }),
  createdBy: one(users, {
    fields: [transactions.createdByUserId],
    references: [users.id],
  }),
}));

export const LIABILITY_TYPES = ["credit_card", "loan"] as const;
