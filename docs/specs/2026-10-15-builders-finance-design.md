# Builders Finance: version 1 design

Status: written 2026-10-15, waiting for review.

## Summary

Builders Finance is a finance dashboard for small business owners. An owner sees money
coming in and going out, which invoices are due or overdue, and the overall financial
health of the business, with filters and date ranges.

Version 1 is a public demo built live on a podcast. Every visitor gets a private,
editable copy of one sample business with no login. The GitHub repository is the
deliverable for viewers: anyone can clone it and run or deploy their own copy on their
own free Vercel and Supabase accounts.

## Goals

- Show income and expense analysis, invoice status, and overall financial health on one
  dashboard with date range filters.
- Let each visitor edit their own copy: add expenses and income, create invoices, mark
  invoices sent and paid, and reset to the sample data.
- Keep visitors fully isolated from each other.
- Use a data model scoped by business and member, so a multi-business SaaS version needs
  no table changes.
- Make the repository easy to clone, set up, test, and deploy, with every step documented.

## Non-goals for version 1

- Real accounts, email login, or more than one member per business.
- A separate clients screen, settings, PDF export, dark mode, or multiple currencies. The
  demo uses US dollars.
- Bank connections or imports of real financial data. The app uses generated sample data
  only.
- Any feature that moves money. The app records payments; it never sends or receives them.

## Decisions

| Topic | Decision |
|---|---|
| Hosting | Next.js on Vercel, Supabase for database and auth |
| Language | TypeScript everywhere |
| Interface | Tailwind CSS, shadcn/ui components, Recharts charts |
| Demo storage | A private sandbox per visitor, created through Supabase anonymous sign-in |
| Isolation | Postgres row level security (RLS) on every table, checked through `business_members` |
| Sample data | Generated in TypeScript from a fixed seed, with dates relative to today |
| Cleanup | Nightly `pg_cron` job deletes anonymous users older than 7 days, with their data |
| License | MIT |
| Versions | Current stable releases at implementation time, pinned in the implementation plan |

## Architecture

One Next.js app (App Router) runs on Vercel and talks to one Supabase project. The app
needs only two public settings: the Supabase URL and the Supabase publishable key. It
never uses a secret Supabase key.

### Pieces

- **Next.js pages** load data on the server. Edits run through server actions.
- **Supabase Postgres** stores all data. RLS limits every row to members of its business.
- **Supabase Auth anonymous sign-in** gives each visitor a hidden session with no login
  screen. The session lives in a cookie managed by `@supabase/ssr`.
- **`pg_cron`** runs the nightly cleanup inside Postgres. No extra server runs.

### Code layout

| Path | Responsibility |
|---|---|
| `app/` | Routes, layouts, and server actions |
| `components/` | Dashboard, tables, forms, charts, and shared UI |
| `lib/finance/` | Pure calculation functions (totals, monthly series, margin, overdue status, date ranges). No database access. |
| `lib/sample-data/` | The sample business generator. Pure, no database access. |
| `lib/data/` | The only code that talks to Supabase. Pages and actions call these functions and never query directly. |
| `lib/validation/` | Zod schemas shared by forms and server actions, and money parsing |
| `supabase/migrations/` | Tables, view, functions, RLS policies, indexes, and the cleanup job, as versioned SQL |
| `supabase/tests/` | pgTAP database tests |
| `scripts/setup` | One command that prepares a Supabase project for this app |
| `e2e/` | Playwright end-to-end tests |
| `.github/workflows/` | CI, deploy, migrations, and the smoke test |

## Screens

A left sidebar links four screens. A shared top bar appears on every screen.

### Shared top bar

- A date range picker with presets (this month, last 3 months, last 12 months, year to
  date) and a custom range. The range lives in the URL as `?from=YYYY-MM-DD&to=YYYY-MM-DD`,
  so it stays the same across screens and filtered views can be shared. The default range
  is the last 12 months.
- A demo notice, "This is your private demo copy", with a **Reset sample data** button.
  Reset asks for confirmation.

### Welcome screen

Visitors without a session see a short welcome screen with one button: **Open your demo
copy**. The explicit click keeps crawlers and link previews from creating sandboxes.

### Dashboard (`/`)

- Four tiles: income, expenses, net profit with margin, and money owed to you, with the
  overdue part shown separately.
- A monthly chart of income against expenses with a net profit line.
- Expenses by category as a ranked bar list.
- **Needs attention:** overdue invoices and invoices due in the next 14 days, each with a
  **Mark paid** button.

Income, expenses, net profit, the chart, and the category list use transactions dated
inside the selected range. "Money owed to you" and "Needs attention" always show the
state as of today, because an unpaid invoice matters whatever range is selected.

### Income (`/income`)

- A table of money received: date, source, category, amount.
- Filters: date range, category, and search. Search matches source and note.
- Invoice payments appear here automatically. **Add income** records income that is not
  tied to an invoice.

### Expenses (`/expenses`)

- A table of expenses with the same filters plus vendor.
- **Add expense** opens a side panel: date, vendor, category, amount, note.

### Invoices (`/invoices`)

- Status tabs: All, Draft, Sent, Overdue, Paid. Overdue is derived: a sent invoice becomes
  overdue after its due date. The list shows invoices issued inside the selected range.
- **New invoice** opens a side panel: client (pick existing or type a new name), line
  items, issue date, due date.
- Selecting an invoice shows its details with **Mark sent** and **Mark paid**. Mark paid
  records the payment date and creates the matching income transaction.

## Data model

Every row belongs to a business. In version 1, each visitor owns exactly one business.

### Tables

| Table | Columns | Notes |
|---|---|---|
| `businesses` | `id` uuid, `name` text, `currency` text default `USD`, `created_by` uuid, `created_at` timestamptz | `created_by` references `auth.users` with `on delete cascade`. |
| `business_members` | `business_id` uuid, `user_id` uuid, `role` text | Primary key on both ids. Version 1 uses only `owner`. Cascades from both parents. |
| `categories` | `id`, `business_id`, `kind` (`income` or `expense`), `name` | Unique on `(business_id, kind, name)` and on `(id, kind)`. |
| `clients` | `id`, `business_id`, `name`, `email` | `email` is optional. |
| `transactions` | `id`, `business_id`, `kind`, `date` date, `amount_cents` bigint, `category_id`, `counterparty` text, `note` text, `invoice_id` uuid | `counterparty` is the payer for income and the vendor for expenses. `invoice_id` is optional and unique. |
| `invoices` | `id`, `business_id`, `client_id`, `number` text, `issue_date` date, `due_date` date, `status` (`draft`, `sent`, `paid`), `paid_date` date, `notes` text | `number` is unique per business, for example `INV-1042`. |
| `invoice_items` | `id`, `invoice_id`, `business_id`, `description`, `quantity` numeric(10,2), `unit_price_cents` bigint | `business_id` is repeated so RLS checks stay simple and fast. |

All child tables reference `businesses` with `on delete cascade`. Primary keys are uuids
generated by the database.

### View

`invoice_summaries` returns each invoice with:

- `total_cents`: the sum of `quantity * unit_price_cents` over its items, rounded to whole
  cents. Totals are never stored, so they cannot drift.
- `display_status`: `overdue` when `status = 'sent'` and `due_date < current_date`,
  otherwise `status`.

The view is created with `security_invoker = true`, so RLS applies to the caller.

### Constraints

- Money is stored as whole cents in `bigint`. No floating point amounts anywhere.
- Dates are plain `date` values with no time zone.
- `amount_cents > 0` and `unit_price_cents >= 0`; `quantity > 0`.
- `due_date >= issue_date`.
- `status = 'paid'` requires `paid_date`; other statuses require `paid_date` to be null.
- A transaction's category matches its kind, enforced by a composite foreign key from
  `transactions (category_id, kind)` to `categories (id, kind)`.

### Row level security

- RLS is enabled on every table.
- A `security definer` helper, `is_business_member(business_id)`, checks
  `business_members` for `auth.uid()`.
- Select, insert, update, and delete policies on every business-scoped table require
  `is_business_member(business_id)`.
- `business_members` rows are readable only by the member themselves and are written only
  through database functions.

### Indexes

- `transactions (business_id, date)`
- `invoices (business_id, status, due_date)`
- Foreign key columns used in joins.

### Database functions

All run as one transaction and check membership before changing anything.

| Function | What it does |
|---|---|
| `create_business(name)` | Creates a business and the caller's owner membership. Needed because RLS blocks the first insert before a membership exists. Returns the business id. |
| `load_sample_data(business_id, data jsonb)` | Deletes the business's transactions, invoices, items, clients, and categories, then inserts the supplied sample data. Used for first load and for Reset. |
| `create_invoice(data jsonb)` | Inserts an invoice and its items, creating the client if a new name is given, and assigns the next invoice number. |
| `mark_invoice_paid(invoice_id, paid_date)` | Sets the invoice to paid and inserts the matching income transaction in the "Client payments" category, creating that category if it is missing. Fails with a clear error if the invoice is already paid or still a draft. |

## Data flow

### First visit

1. A visitor without a session sees the welcome screen and clicks **Open your demo copy**.
2. One server action signs in anonymously, calls `create_business`, generates the sample
   data with `generateSampleBusiness`, and calls `load_sample_data` once.
3. The visitor lands on the dashboard. The session cookie brings them back to the same
   sandbox on later visits.

### Reading

1. Request middleware refreshes the Supabase session cookie on each request.
2. Each page parses the date range from the URL and calls a `lib/data` function, for
   example `getDashboard(range)`. Queries run as the visitor, so RLS scopes the results.
3. `lib/finance` turns the rows into totals, the monthly series, category breakdowns, and
   overdue lists. A sandbox holds about 2,000 rows, so this stays fast. If larger datasets
   need it later, aggregation moves into SQL behind the same `lib/data` functions.

### Writing

- Forms submit to server actions. Each action validates input with Zod, saves through
  `lib/data`, and revalidates the affected pages.
- Multi-row changes use the database functions above: `create_invoice`,
  `mark_invoice_paid`, and `load_sample_data` for Reset.
- Single-row changes (add expense, add income, mark sent) use plain inserts and updates.

### Cleanup

- A `pg_cron` job runs daily at 03:00 UTC and deletes anonymous users from `auth.users`
  whose `created_at` is more than 7 days old. Cascades remove their businesses and rows.
- A visitor who clears cookies or returns after 7 days gets a new sandbox.

## Sample data

### The business

Northfield Studio, a fictional 6-person design and marketing studio that bills clients
by invoice. All business, client, and vendor names are invented, and all email addresses
use `example.com`.

### Generator

- `lib/sample-data` exports `generateSampleBusiness({ today, seed })`, which returns plain
  data: categories, clients, transactions, and invoices with items.
- A seeded pseudo-random generator with a fixed default seed makes every sandbox identical
  for the same `today`.
- All dates are relative to `today`, so the latest month is always the current month.

### Content

- 18 months of history up to `today`, plus invoices due in the coming weeks.
- Income of about $25,000 to $45,000 per month, with a slight upward trend and seasonal
  dips in January and August. About 85% comes from invoice payments; the rest is small
  other income such as workshop fees and bank interest.
- 14 clients and about 12 invoices per month, $800 to $12,000 each, on 15-day or 30-day
  terms. About 70% are paid on time, 22% are paid late, and the rest are open. The current
  state always includes 4 to 6 overdue invoices, several due soon, and 2 drafts.
- Income in 3 categories: Client payments, Workshops, and Interest.
- Expenses in 9 categories: payroll (every two weeks, the largest cost), rent (on the
  1st), software subscriptions (fixed monthly), insurance (quarterly), utilities (higher in
  winter and summer), contractors and marketing (variable), equipment (a few large
  purchases a year), and travel and bank fees (small and occasional).
- A profit margin of about 15% to 25% over the full period, with at least one loss month.
- About 750 transactions, 215 invoices, and 500 invoice items per sandbox.

### Generator invariants

- The same seed and `today` produce identical output.
- Every paid invoice has exactly one income transaction equal to its total.
- No transaction is dated after `today`.
- The overdue count and the overall margin fall within the ranges above.

## Error handling

- **Forms:** one Zod schema per form, checked in the browser and in the server action.
  Field errors appear next to the field in plain words, for example "Enter an amount above
  $0".
- **Money input:** text converts to cents without floating point math. Invalid input is
  rejected, never stored as `NaN`.
- **Pending state:** a button shows a spinner and ignores extra clicks while its action
  runs.
- **Action results:** server actions return `{ ok: true }` or `{ ok: false, message }` and
  never throw to the page.
- **Database errors:** known Postgres error codes map to plain messages (for example,
  "That invoice number is already used"). Unknown errors show "Couldn't save. Try again."
  and log the error code on the server.
- **Double payment:** `mark_invoice_paid` rejects an already paid invoice, and the unique
  `invoice_id` on transactions blocks duplicates even under concurrent requests.
- **Expired session or sandbox:** the visitor returns to the welcome screen with "Your
  demo copy expired. Open a new one."
- **Failed sample load:** nothing is partly saved. The dashboard detects an empty business
  and offers **Load sample data**.
- **Anonymous sign-in limit:** when Supabase rate limits sign-ins, the welcome screen shows
  "Too many demo copies opened from your network. Try again in a few minutes." The setup
  script raises the limit to 300 per hour.
- **Bad URL parameters:** an invalid or reversed date range falls back to the last 12
  months.
- **Empty results:** filters that match nothing show an empty state with **Clear filters**.
- **Missing records:** an unknown invoice id shows a not found page linking to invoices.
- **Crashes:** each route segment has its own error boundary with **Try again**, so the
  sidebar and other screens keep working.
- **Missing configuration:** the app stops at startup and lists missing environment
  variables with a link to the README. The setup script validates the token and project
  before changing anything.

## Testing

Code is written test first.

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | `lib/finance`, money parsing, date range parsing, Zod schemas, sample data invariants |
| Database | pgTAP through `supabase test db`, local Supabase in Docker | RLS isolation between two users across every table and the view; each database function's success and rollback; constraints; the cleanup job |
| End to end | Playwright against the local app and local Supabase | Open a demo copy; add an expense and see totals change; create, send, and pay an invoice and see the income; reset; two browsers get separate sandboxes |
| Production smoke | A script run after deploy | The live welcome screen loads |

Commands for everyone: `npm test`, `npm run test:db`, `npm run test:e2e`.

## Deployment and setup

### The live demo

- GitHub Actions runs type checking, linting, unit, database, and end-to-end tests on every
  push and pull request, using its own local Supabase.
- A green run on `main` applies new migrations to the live Supabase project, deploys to
  Vercel with the Vercel CLI, and runs the smoke test.
- Tokens and ids live in GitHub Actions secrets, set from the command line. They never
  appear in the repository.

### Viewers running their own copy

The README walks through these steps:

1. Fork or clone the repository and run `npm install`.
2. Create a free Supabase project.
3. Run `npm run setup`. It asks for a Supabase access token and project ref, then turns on
   anonymous sign-in, raises its rate limit, enables `pg_cron`, applies the migrations,
   and writes `.env.local` with the URL and publishable key.
4. Run `npm run dev` to use it locally.
5. Click **Deploy with Vercel** in the README and enter the two environment variables.

## Before launch

- Add `LICENSE` (MIT) and a README with setup, commands, and architecture overview.
- Remove references to unrelated private projects from `CLAUDE.md` and `HANDOFF.md`.
- Confirm no secrets exist in the repository or its history.
