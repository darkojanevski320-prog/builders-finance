# Builders Finance

A finance dashboard for small business owners: money in, money out, unpaid invoices, and the overall
health of the business, with date ranges and filters. Built live on a podcast with Claude Code.

Every visitor gets a private, editable copy of a sample business. No login. All data is made up.

**Live demo:** https://builders-finance.vercel.app

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdarkojanevski320-prog%2Fbuilders-finance&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY&envDescription=Run%20npm%20run%20setup%20to%20get%20both%20values&envLink=https%3A%2F%2Fgithub.com%2Fdarkojanevski320-prog%2Fbuilders-finance%23setup&project-name=builders-finance&repository-name=builders-finance)

## What it does

- **Dashboard:** income, expenses, net profit and margin, money owed to you, a monthly chart, expenses
  by category, and invoices that need attention.
- **Income and expenses:** tables with category, vendor, and text filters, plus forms to add entries.
- **Invoices:** draft, sent, overdue, and paid tabs; create invoices with line items; mark them sent
  and paid. Paying an invoice records the income automatically.
- **Your own copy:** each visitor gets a private sandbox. **Reset sample data** starts over. Copies are
  deleted after 7 days.

## Stack

Next.js (App Router) and TypeScript on Vercel, Supabase (Postgres, anonymous auth, row level security,
`pg_cron`), Tailwind CSS with shadcn/ui, Recharts, Zod, Vitest, pgTAP, and Playwright.

## Setup

You need Node.js 20.9 or later (24 recommended), a free [Supabase](https://supabase.com) account, and
a free [Vercel](https://vercel.com) account. Docker Desktop is only needed for the local database and
the database and end-to-end tests.

1. Get the code:

   ```bash
   git clone https://github.com/darkojanevski320-prog/builders-finance.git
   ```

   ```bash
   cd builders-finance && npm install
   ```

2. In Supabase, create a new project. Note its project ref: the 20 letters in the project URL.
3. Create a Supabase access token at https://supabase.com/dashboard/account/tokens, then run:

   ```bash
   npm run setup
   ```

   Setup asks for the token and the project ref. It turns on anonymous sign-in, applies the database
   migrations, and writes `.env.local`. It is safe to run again.

4. Start the app and open http://localhost:3000:

   ```bash
   npm run dev
   ```

5. To put it online, click **Deploy with Vercel** above and paste the two values from `.env.local`.

Never commit `.env.local` or share your access token. The app itself only uses the public URL and the
publishable key; row level security protects the data.

## Local development with Docker

To work against a local database instead of your hosted project:

```bash
npm run db:start
```

```bash
npm run env:local
```

```bash
npm run dev
```

`npm run env:local` points `.env.local` at the local stack. Run `npm run setup` again to switch back
to your hosted project.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on http://localhost:3000 |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Database tests (pgTAP), needs `npm run db:start` |
| `npm run test:e2e` | Browser tests (Playwright), needs the local database and `npm run env:local` |
| `npm run lint` and `npm run typecheck` | Lint and type checks |
| `npm run db:start`, `npm run db:stop`, `npm run db:reset` | Manage the local Supabase stack |
| `npm run setup` | Prepare your hosted Supabase project and write `.env.local` |
| `npm run smoke -- URL` | Check that a deployed copy serves the welcome screen |

## How it works

- Visiting the app shows a welcome screen. **Open your demo copy** signs you in anonymously, creates
  a business, and loads 18 months of generated sample data in one database transaction.
- Every table has row level security: you can only reach rows of a business you belong to.
- All money is stored as whole cents and all dates as plain calendar dates.
- A nightly `pg_cron` job deletes anonymous users older than 7 days, with their data.
- The full design is in [docs/specs](docs/specs) and the build plan in [docs/plans](docs/plans).

## License

[MIT](LICENSE)
