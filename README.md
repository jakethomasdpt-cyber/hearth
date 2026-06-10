# 🌿 Hearth

**Shared money, made clear.** A financial operating system for couples — one place to see your household's net worth, cash flow, bills, subscriptions, and savings opportunities.

Built with Next.js App Router, TypeScript, Tailwind CSS v4, Drizzle ORM, Neon Postgres, and Auth.js.

---

## Quick start

### 1. Create a free Neon Postgres database (~2 minutes)

1. Go to [neon.tech](https://neon.tech) and sign up (free tier is plenty).
2. Create a new project (any name, e.g. `hearth`).
3. On the project dashboard, click **Connect** and copy the **connection string**. It looks like:
   ```
   postgresql://user:password@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — paste your Neon connection string
- `AUTH_SECRET` — generate one: `openssl rand -base64 32`

### 3. Install, push schema, seed, run

```bash
npm install
npm run db:push     # creates all tables in Neon
npm run db:seed     # optional: demo household with realistic data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo logins** (after seeding):

| Partner | Email | Password |
|---|---|---|
| Alex | `demo@hearth.app` | `demo1234` |
| Sam | `partner@hearth.app` | `demo1234` |

Both log into the same household and see the same shared finances.

---

## What's included (Phase 1)

- **Auth** — email/password signup and login (Auth.js v5, bcrypt-hashed passwords, JWT sessions). Middleware protects every page.
- **Household workspace** — each user belongs to a household. All data is scoped by `household_id` (this is the data-separation boundary — see `src/lib/session.ts`).
- **Partner invites** — invite your partner by email from Household settings. When they sign up with that email, they join your household automatically instead of creating a new one.
- **Dashboard** — net worth hero card with trend chart, cash on hand, monthly income/spending with month-over-month deltas, monthly recurring total, upcoming bills, subscriptions, savings opportunities, recent activity.
- **Accounts** — manual entry for checking, savings, investment, credit card, loan, and property accounts. Liabilities are tracked as "amount owed" and subtracted from net worth.
- **Transactions** — deposits, withdrawals, transfers with categories, tags, partner notes, search and filtering. Creating/deleting a transaction automatically adjusts the account balance.
- **Bills & subscriptions** — recurring bills with due dates, frequencies, autopay flags, mark paid/unpaid per cycle, monthly recurring total (weekly/quarterly/yearly bills normalized to monthly), and duplicate-subscription flagging.
- **Net worth history** — a snapshot is recorded whenever balances change; the dashboard chart reads from `net_worth_snapshots`.
- **Savings insights** — schema and dashboard UI in place; seed data shows examples (cancel / negotiate / reduce / review). Automated detection lands in Phase 2.

## What's included (Phase 2)

- **PDF statement import** (`/import`) — upload a bank statement PDF; text is extracted with `unpdf` and parsed with bank-format heuristics (`src/lib/statement-parser.ts`). Statements move through `uploaded → parsing → review → imported`.
- **Review before save** — every extracted transaction lands on an editable review screen: include/exclude rows, fix dates, descriptions, amounts, flip deposit/withdrawal, assign categories, pick the target account. Nothing is saved until you confirm. Imports don't adjust current balances (statement history is already reflected in them).
- **Subscription detection** — "Scan for savings" groups the last 120 days of withdrawals by normalized merchant and flags charges with stable amounts on a weekly/monthly/quarterly cadence into the `subscriptions` table (`source: detected`).
- **Savings Intelligence** (`/insights`) — generated insights with estimated monthly savings: rising category spend (MoM), recurring charges not in your bills list, possible duplicate subscriptions, and lapsed subscriptions. Mark each done or dismissed.
- **Reports** (`/reports`) — savings rate, 6-month income vs spending chart, spending by category with share-of-total bars, subscription total, and net worth trend.

## What's included (Phase 3)

### Teller bank sync

Automatic balance + transaction sync via [Teller](https://teller.io) (free up to 100 live connections; covers Chase, Capital One, Ally, and thousands more).

Setup:

1. Create a free account at [teller.io](https://teller.io) and create an application.
2. Copy your **Application ID** into `TELLER_APPLICATION_ID` in `.env`.
3. Start with `TELLER_ENVIRONMENT="sandbox"` to test (sandbox bank: username `username`, password `password`), then switch to `development` (100 free real connections).
4. For `development`/`production`, download the client certificate + private key from the Teller dashboard and add them base64-encoded (`base64 -i certificate.pem | tr -d '\n'`) to `TELLER_CERTIFICATE` / `TELLER_PRIVATE_KEY` — Teller requires mutual TLS.
5. Set `CRON_SECRET` (`openssl rand -hex 32`).
6. `npm run db:push` to create the new tables, then click **⚡ Link a bank** on the Accounts page.

How it works: linking creates a `teller_enrollments` row and immediately syncs — accounts are auto-created (with an `auto-sync` badge), balances refresh from Teller's ledger, transactions import deduped by Teller transaction id and auto-categorized via Teller's category data. "Sync now" on the Accounts page re-syncs on demand; `/api/sync` (Bearer `CRON_SECRET`) runs the daily sync — `vercel.json` schedules it at 11:00 UTC on Vercel, or point any scheduler at it. Unlinking keeps the accounts and history as manual data. Institutions Teller doesn't cover stay on manual entry + PDF import.

### Budgets

Monthly spending limits per category (`/budgets`). Set a budget inline on any expense category; both partners see shared progress bars (green → orange at 85% → red over budget), amount left this month, and totals across all budgeted categories. Spending is computed from the current month's withdrawals, so synced, imported, and manual transactions all count.

## Future

- **Plaid/SimpleFIN fallback** — the sync layer is provider-shaped (enrollments → accounts → deduped transactions); adding a second provider for institutions Teller misses is straightforward.

## Project structure

```
src/
├── auth.ts               # Auth.js config (credentials provider)
├── auth.config.ts        # Edge-safe config used by middleware
├── middleware.ts         # Route protection
├── db/
│   ├── schema.ts         # All 12 tables + enums + relations
│   ├── index.ts          # Neon + Drizzle client
│   └── seed.ts           # Demo household seeder
├── lib/
│   ├── session.ts        # getHouseholdContext() — auth + household scoping
│   ├── queries.ts        # Read queries (net worth, flow, bills, etc.)
│   ├── format.ts         # Money/date formatting (all money = integer cents)
│   └── actions/          # Server actions (accounts, transactions, bills, household, auth)
├── components/           # Sidebar, modal, charts, forms
└── app/
    ├── (auth)/           # /login, /signup
    └── (app)/            # /dashboard, /accounts, /transactions, /bills, /settings
```

## Design notes

- **Money is always integer cents** (`bigint` in Postgres) — no floating point.
- **Liability convention**: credit cards/loans store a positive "amount owed". A deposit (payment) on a liability reduces it; a withdrawal (charge) increases it.
- **Security**: every query goes through `getHouseholdContext()`, which resolves the session and scopes data to the user's household. Server actions re-verify ownership before any write.
- **Theme**: dark canvas (`#060807`), Robinhood green (`#00c805`) reserved for positive money movement, orange/red only for warnings and overspending. Tokens live in `globals.css` under `@theme`.

## Useful commands

```bash
npm run dev          # start dev server
npm run db:push      # push schema changes to Neon
npm run db:studio    # browse your data (Drizzle Studio)
npm run db:seed      # seed demo household (skips if already seeded)
npm run typecheck    # TypeScript check
npm run build        # production build
```
