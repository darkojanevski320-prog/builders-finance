# Builders Finance version 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Builders Finance demo: a finance dashboard where every visitor gets a private, editable sandbox of a sample business, deployable by anyone from the public repository.

**Architecture:** One Next.js 16 App Router app on Vercel talks to one Supabase project. Visitors get an anonymous Supabase session; Postgres row level security limits every row to members of its business. Pure TypeScript modules hold all finance math and the sample data generator; one data layer (`lib/data`) is the only code that queries Supabase.

**Tech Stack:** Next.js 16.4.1, React 19, TypeScript, Tailwind CSS 4, shadcn/ui 4, Recharts 3, Zod 4, `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.118, Supabase CLI 2.121 (dev dependency), Vitest 5, Playwright 1.64, pgTAP, GitHub Actions, Vercel CLI 56.

**Spec:** `docs/specs/2026-10-15-builders-finance-design.md`

## Global Constraints

- Every task's requirements include this section. Read the spec before starting a task.
- Money is integer cents everywhere (`bigint` in Postgres, `number` in TypeScript). No floating point amounts are stored or summed.
- Dates are plain calendar dates as `YYYY-MM-DD` strings. "Today" is the UTC date (`todayISO()`), matching Postgres `current_date` on Supabase.
- The app uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never add a secret or service role key to the app.
- Sample data only. All names are invented; all email addresses use `example.com`.
- No feature moves money.
- RLS is enabled on every table. Grant table access to `authenticated` explicitly; new Supabase tables are not exposed to the Data API automatically.
- `SECURITY DEFINER` functions live only in the `private` schema, set `search_path = ''`, and have `EXECUTE` revoked from `public`.
- Request middleware is `proxy.ts` (Next.js 16 name). Server code reads the user with `supabase.auth.getClaims()`, never `getSession()`.
- User-facing copy: sentence case, plain words, no "please", no exclamation marks, no em or en dashes.
- Pin exact versions in `package.json` (no `^` or `~`) and commit `package-lock.json`.
- Never print, log, or commit tokens. `.env*` files stay ignored except `.env.example`.
- Commit after every task with a message ending in the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commits use the repo-local identity already configured; do not change git config.

## Review Focus

1. **More than 1,000 rows in one query.** Supabase returns at most 1,000 rows per request by default; a long custom range must still total every row. Pinned by the `fetchAll` paging test in Task 8.
2. **Visitors in other time zones.** A visitor in Honolulu at 6 pm or in Kiritimati at 8 am must see the same dates the database stores; a date typed in a form must never shift by a day. Pinned by running all unit tests with `TZ=Pacific/Honolulu` (Task 1) and the date round trip tests in Task 2.
3. **A session cookie that outlives its sandbox.** After the nightly cleanup deletes a user, their access token stays valid for up to an hour; the app must send them to the welcome screen with the expired message, not crash. Pinned by the `resolveSandboxState` tests in Task 8.
4. **Fractional quantities on invoices.** `1.5 x $33.33` must total the same in the form preview, the database view, and the income transaction. Pinned by the `lineTotalCents` tests in Task 2 and the rounding test in Task 6.
5. **A typed client name that already exists with different case or spacing.** Typing ` northwind cafe ` must reuse "Northwind Cafe", not create a duplicate client. Pinned by the client matching test in Task 6.

---

## File structure

| Path | Responsibility |
|---|---|
| `app/layout.tsx` | Root HTML, fonts, toast container |
| `app/welcome/page.tsx`, `app/welcome/start-form.tsx`, `app/welcome/actions.ts` | Welcome screen and the start demo server action |
| `app/(app)/layout.tsx` | Requires a sandbox; renders sidebar and top bar |
| `app/(app)/page.tsx` | Dashboard |
| `app/(app)/income/page.tsx`, `app/(app)/expenses/page.tsx` | Transaction screens |
| `app/(app)/invoices/page.tsx`, `app/(app)/invoices/[id]/page.tsx`, `app/(app)/invoices/[id]/not-found.tsx` | Invoice list and detail |
| `app/(app)/actions.ts` | Server actions for all edits |
| `app/(app)/error.tsx`, `app/(app)/loading.tsx` | Per-screen error boundary and loading state |
| `components/shell/*` | Sidebar, top bar, date range picker, reset button |
| `components/dashboard/*` | Tiles, chart, category bars, attention list |
| `components/transactions/*` | Transaction table, filters, add form |
| `components/invoices/*` | Invoice table, status tabs, new invoice form, status badge, invoice actions |
| `components/ui/*` | shadcn/ui generated components |
| `lib/env.ts` | Reads and validates environment variables |
| `lib/finance/*` | Pure dates, money, ranges, summaries, filters |
| `lib/sample-data/*` | Pure seeded sample business generator |
| `lib/validation/*` | Zod schemas and form helpers |
| `lib/supabase/server.ts` | Server Supabase client |
| `lib/data/*` | All Supabase queries, sandbox resolution, error mapping |
| `lib/actions/result.ts` | `ActionResult` type |
| `proxy.ts` | Session refresh on each request |
| `instrumentation.ts` | Startup environment check |
| `supabase/config.toml`, `supabase/migrations/*`, `supabase/tests/database/*` | Database config, schema, tests |
| `scripts/setup.ts`, `scripts/setup-lib.ts`, `scripts/local-env.ts`, `scripts/smoke.ts` | Viewer setup, local env writer, smoke test |
| `e2e/*` | Playwright tests |
| `.github/workflows/ci.yml` | Tests, then migrations, deploy, smoke test |

---

### Task 1: Scaffold the app and test tooling

**Files:**
- Create: Next.js scaffold files (`app/`, `public/`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `package.json`, `package-lock.json`, `next-env.d.ts`)
- Create: `vitest.config.mts`, `lib/smoke.test.ts`, `LICENSE`, `.env.example`, `.nvmrc`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`; path alias `@/*` to the repo root.

- [ ] **Step 1: Scaffold into a temporary folder**

`create-next-app` refuses a folder that already has files, so scaffold elsewhere and copy in.

```bash
npx create-next-app@16.4.1 /tmp/bf-scaffold --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

Expected: `Success! Created bf-scaffold at /tmp/bf-scaffold`.

- [ ] **Step 2: Copy the scaffold into the repo without its git folder or README**

```bash
rsync -a --exclude .git --exclude README.md --exclude .gitignore /tmp/bf-scaffold/ ./
```

Then append the scaffold's ignore rules to the repo's `.gitignore` (keep the existing `.env*` rules at the top):

```bash
cat /tmp/bf-scaffold/.gitignore >> .gitignore
```

Open `.gitignore` and delete any duplicate `.env*` line the scaffold added, so the file still contains exactly:

```gitignore
# Local secrets. Never commit.
.env*
!.env.example
```

followed by the scaffold rules. Also add these lines at the end:

```gitignore
# Supabase local
supabase/.branches
supabase/.temp
# Playwright
/test-results/
/playwright-report/
/playwright/.cache/
```

- [ ] **Step 3: Pin versions and add dev dependencies**

```bash
npm install --save-exact @supabase/ssr@0.12.7 @supabase/supabase-js@2.118.0 zod@4.6.7 recharts@3.10.1 server-only@0.0.1
```

```bash
npm install --save-exact --save-dev vitest@5.0.5 vite-tsconfig-paths@6.1.1 supabase@2.121.0 tsx@4.23.15 @playwright/test@1.64.1
```

Open `package.json` and remove every `^` and `~` left by the scaffold so every version is exact. Then run:

```bash
npm install
```

- [ ] **Step 4: Add scripts and engines to `package.json`**

Replace the `scripts` block and add `engines`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:db": "supabase test db",
  "test:e2e": "playwright test",
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "env:local": "tsx scripts/local-env.ts",
  "setup": "tsx scripts/setup.ts",
  "smoke": "tsx scripts/smoke.ts"
},
"engines": {
  "node": ">=20.9"
}
```

Create `.nvmrc`:

```text
24
```

- [ ] **Step 5: Configure Vitest with a non-UTC time zone**

Create `vitest.config.mts`:

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'scripts/**/*.test.ts'],
    // Runs every unit test in a time zone far from UTC so date bugs show up.
    env: { TZ: 'Pacific/Honolulu' },
  },
});
```

- [ ] **Step 6: Write a smoke test that proves the time zone setting works**

Create `lib/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test environment', () => {
  it('runs in Pacific/Honolulu', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Pacific/Honolulu');
  });
});
```

- [ ] **Step 7: Run tests, lint, typecheck, and build**

```bash
npm test
```

Expected: `1 passed`.

```bash
npm run lint && npm run typecheck && npm run build
```

Expected: all three succeed. If `eslint .` scans `/tmp` or `.next`, confirm `eslint.config.mjs` ignores `.next/**` (the scaffold config does).

- [ ] **Step 8: Add the license and example env file**

Create `LICENSE` with the standard MIT text, year `2026`, holder `Darko Janevski`:

```text
MIT License

Copyright (c) 2026 Darko Janevski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Create `.env.example`:

```bash
# Copy to .env.local, or run `npm run setup` (hosted) or `npm run env:local` (local Supabase).
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

- [ ] **Step 9: Commit**

```bash
git add -A
git status --short | grep -E '\.env($|\.local)' && echo "STOP: env file staged" || true
git commit -m "Scaffold Next.js app with Vitest, license, and env example

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dates, money, and date ranges

**Files:**
- Create: `lib/finance/types.ts`, `lib/finance/dates.ts`, `lib/finance/money.ts`, `lib/finance/date-range.ts`
- Test: `lib/finance/dates.test.ts`, `lib/finance/money.test.ts`, `lib/finance/date-range.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `types.ts`: `TransactionKind = 'income' | 'expense'`, `InvoiceStatus = 'draft' | 'sent' | 'paid'`, `DisplayStatus = InvoiceStatus | 'overdue'`, `DateRange { from: string; to: string }`, `Category`, `Transaction`, `InvoiceSummary`, `InvoiceItem` (shapes below).
  - `dates.ts`: `isValidISODate(v: string): boolean`, `toUTCDate(iso: string): Date`, `fromUTCDate(d: Date): string`, `todayISO(now?: Date): string`, `addDays(iso: string, n: number): string`, `addMonths(iso: string, n: number): string`, `startOfMonth(iso: string): string`, `endOfMonth(iso: string): string`, `monthKey(iso: string): string`, `diffDays(a: string, b: string): number`, `monthsBetween(from: string, to: string): string[]`, `daysInMonth(iso: string): number`.
  - `money.ts`: `parseMoneyToCents(input: string): number | null`, `formatCents(cents: number, opts?: { whole?: boolean }): string`, `parseQuantity(input: string): number | null`, `lineTotalCents(quantity: number, unitPriceCents: number): number`, `invoiceTotalCents(items: { quantity: number; unitPriceCents: number }[]): number`.
  - `date-range.ts`: `RangePreset`, `RANGE_PRESETS`, `presetRange(p: RangePreset, today: string): DateRange`, `parseRangeParams(params: Record<string, string | string[] | undefined>, today: string): DateRange`, `matchPreset(range: DateRange, today: string): RangePreset | 'custom'`.

- [ ] **Step 1: Write the domain types**

Create `lib/finance/types.ts`:

```ts
export type TransactionKind = 'income' | 'expense';
export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type DisplayStatus = InvoiceStatus | 'overdue';

/** Inclusive calendar date range, both ends `YYYY-MM-DD`. */
export interface DateRange {
  from: string;
  to: string;
}

export interface Category {
  id: string;
  kind: TransactionKind;
  name: string;
}

export interface Transaction {
  id: string;
  kind: TransactionKind;
  date: string;
  amountCents: number;
  categoryId: string;
  counterparty: string;
  note: string | null;
  invoiceId: string | null;
}

export interface InvoiceSummary {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidDate: string | null;
  notes: string | null;
  totalCents: number;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  position: number;
}
```

- [ ] **Step 2: Write failing date tests**

Create `lib/finance/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, daysInMonth, diffDays, endOfMonth, fromUTCDate, isValidISODate,
  monthKey, monthsBetween, startOfMonth, toUTCDate, todayISO,
} from './dates';

describe('isValidISODate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidISODate('2026-10-15')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
  });
  it('rejects impossible or malformed dates', () => {
    for (const v of ['2026-02-29', '2026-13-01', '2026-10-32', '2026-1-05', '15-10-2026', '', 'abc']) {
      expect(isValidISODate(v)).toBe(false);
    }
  });
});

describe('UTC round trip', () => {
  it('never shifts a date in a non-UTC time zone', () => {
    for (const iso of ['2026-01-01', '2026-03-08', '2026-11-01', '2026-12-31']) {
      expect(fromUTCDate(toUTCDate(iso))).toBe(iso);
    }
  });
  it('todayISO uses the UTC calendar date', () => {
    // 2026-10-15 23:30 in Honolulu is 2026-10-16 09:30 UTC.
    expect(todayISO(new Date('2026-10-16T09:30:00Z'))).toBe('2026-10-16');
  });
  it('toUTCDate throws on invalid input', () => {
    expect(() => toUTCDate('2026-02-30')).toThrow('Invalid date: 2026-02-30');
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('adds months and clamps to the month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-10-15', -17)).toBe('2025-05-15');
  });
  it('finds month boundaries', () => {
    expect(startOfMonth('2026-10-15')).toBe('2026-10-01');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(daysInMonth('2026-04-03')).toBe(30);
  });
  it('computes day differences and month keys', () => {
    expect(diffDays('2026-10-15', '2026-10-01')).toBe(14);
    expect(diffDays('2026-03-09', '2026-03-08')).toBe(1);
    expect(monthKey('2026-10-15')).toBe('2026-10');
  });
  it('lists months between two dates inclusive', () => {
    expect(monthsBetween('2025-11-20', '2026-02-03')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsBetween('2026-10-01', '2026-10-31')).toEqual(['2026-10']);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run lib/finance/dates.test.ts
```

Expected: FAIL, `Failed to resolve import "./dates"`.

- [ ] **Step 4: Implement `lib/finance/dates.ts`**

```ts
// All dates are calendar dates as YYYY-MM-DD. Math runs on UTC midnight so the
// local time zone of the server or browser never shifts a date.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isValidISODate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function toUTCDate(iso: string): Date {
  if (!isValidISODate(iso)) throw new Error(`Invalid date: ${iso}`);
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function fromUTCDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date()): string {
  return fromUTCDate(now);
}

export function addDays(iso: string, days: number): string {
  const date = toUTCDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTCDate(date);
}

export function daysInMonth(iso: string): number {
  const date = toUTCDate(iso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function addMonths(iso: string, months: number): string {
  const date = toUTCDate(iso);
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = daysInMonth(fromUTCDate(firstOfTarget));
  firstOfTarget.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return fromUTCDate(firstOfTarget);
}

export function startOfMonth(iso: string): string {
  toUTCDate(iso);
  return `${iso.slice(0, 8)}01`;
}

export function endOfMonth(iso: string): string {
  return `${iso.slice(0, 8)}${String(daysInMonth(iso)).padStart(2, '0')}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTCDate(a).getTime() - toUTCDate(b).getTime()) / DAY_MS);
}

export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let cursor = startOfMonth(from); cursor <= to; cursor = addMonths(cursor, 1)) {
    months.push(monthKey(cursor));
  }
  return months;
}
```

- [ ] **Step 5: Run the date tests**

```bash
npx vitest run lib/finance/dates.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write failing money tests**

Create `lib/finance/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatCents, invoiceTotalCents, lineTotalCents, parseMoneyToCents, parseQuantity } from './money';

describe('parseMoneyToCents', () => {
  it.each([
    ['12', 1200], ['12.3', 1230], ['12.30', 1230], [' 12.05 ', 1205], ['$12', 1200],
    ['1,234.50', 123450], ['$1,234,567', 123456700], ['0.01', 1], ['0', 0],
  ])('parses %j as %i cents', (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it.each(['', ' ', '-5', '12.345', 'abc', '1e5', '12,34', '1,2345.00', '$', '.5', '12.', '1234567890'])(
    'rejects %j',
    (input) => {
      expect(parseMoneyToCents(input)).toBeNull();
    },
  );
});

describe('formatCents', () => {
  it('formats US dollars with cents', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(-5000)).toBe('-$50.00');
  });
  it('formats whole dollars when asked', () => {
    expect(formatCents(123456, { whole: true })).toBe('$1,235');
  });
});

describe('parseQuantity', () => {
  it.each([['1', 1], ['1.5', 1.5], ['2.25', 2.25], [' 3 ', 3]])('parses %j', (input, q) => {
    expect(parseQuantity(input)).toBe(q);
  });
  it.each(['0', '-1', '1.234', 'abc', '', '10000'])('rejects %j', (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe('invoice math', () => {
  it('rounds each line half away from zero, like Postgres round()', () => {
    expect(lineTotalCents(1.5, 3333)).toBe(5000);
    expect(lineTotalCents(0.33, 1000)).toBe(330);
    expect(lineTotalCents(2.25, 1999)).toBe(4498); // 4497.75
  });
  it('sums rounded lines', () => {
    expect(invoiceTotalCents([
      { quantity: 1.5, unitPriceCents: 3333 },
      { quantity: 1, unitPriceCents: 10000 },
    ])).toBe(15000);
    expect(invoiceTotalCents([])).toBe(0);
  });
});
```

- [ ] **Step 7: Run to verify it fails**

```bash
npx vitest run lib/finance/money.test.ts
```

Expected: FAIL, `Failed to resolve import "./money"`.

- [ ] **Step 8: Implement `lib/finance/money.ts`**

```ts
const PLAIN = /^\d{1,9}(\.\d{1,2})?$/;
const GROUPED = /^\d{1,3}(,\d{3}){1,2}(\.\d{1,2})?$/;
const QUANTITY = /^\d{1,4}(\.\d{1,2})?$/;

/** Parses user-typed dollars into integer cents without floating point math. */
export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, '');
  if (!PLAIN.test(trimmed) && !GROUPED.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.replace(/,/g, '').split('.');
  if (whole.length > 9) return null;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

const formatters = {
  cents: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  whole: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
};

export function formatCents(cents: number, opts: { whole?: boolean } = {}): string {
  return (opts.whole ? formatters.whole : formatters.cents).format(cents / 100);
}

/** Quantity above 0 and below 10,000 with at most 2 decimals. */
export function parseQuantity(input: string): number | null {
  const trimmed = input.trim();
  if (!QUANTITY.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** quantity x unit price, rounded half away from zero to match Postgres round(numeric). */
export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  const hundredths = Math.round(quantity * 100);
  return Math.round((hundredths * unitPriceCents) / 100);
}

export function invoiceTotalCents(items: { quantity: number; unitPriceCents: number }[]): number {
  return items.reduce((sum, item) => sum + lineTotalCents(item.quantity, item.unitPriceCents), 0);
}
```

- [ ] **Step 9: Run the money tests**

```bash
npx vitest run lib/finance/money.test.ts
```

Expected: PASS.

- [ ] **Step 10: Write failing date range tests**

Create `lib/finance/date-range.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchPreset, parseRangeParams, presetRange } from './date-range';

const today = '2026-10-15';

describe('presetRange', () => {
  it('builds each preset ending today', () => {
    expect(presetRange('this-month', today)).toEqual({ from: '2026-10-01', to: today });
    expect(presetRange('last-3-months', today)).toEqual({ from: '2026-08-01', to: today });
    expect(presetRange('last-12-months', today)).toEqual({ from: '2025-11-01', to: today });
    expect(presetRange('year-to-date', today)).toEqual({ from: '2026-01-01', to: today });
  });
});

describe('parseRangeParams', () => {
  it('uses valid from and to', () => {
    expect(parseRangeParams({ from: '2026-01-01', to: '2026-03-31' }, today)).toEqual({ from: '2026-01-01', to: '2026-03-31' });
  });
  it('falls back to the last 12 months for missing, invalid, or reversed ranges', () => {
    const fallback = presetRange('last-12-months', today);
    expect(parseRangeParams({}, today)).toEqual(fallback);
    expect(parseRangeParams({ from: '2026-02-30', to: '2026-03-01' }, today)).toEqual(fallback);
    expect(parseRangeParams({ from: '2026-05-01', to: '2026-04-01' }, today)).toEqual(fallback);
    expect(parseRangeParams({ from: ['2026-01-01', 'x'], to: '2026-02-01' }, today)).toEqual(fallback);
  });
});

describe('matchPreset', () => {
  it('recognizes presets and custom ranges', () => {
    expect(matchPreset(presetRange('year-to-date', today), today)).toBe('year-to-date');
    expect(matchPreset({ from: '2026-02-01', to: '2026-02-28' }, today)).toBe('custom');
  });
});
```

- [ ] **Step 11: Run to verify it fails**

```bash
npx vitest run lib/finance/date-range.test.ts
```

Expected: FAIL, `Failed to resolve import "./date-range"`.

- [ ] **Step 12: Implement `lib/finance/date-range.ts`**

```ts
import { addMonths, isValidISODate, startOfMonth } from './dates';
import type { DateRange } from './types';

export const RANGE_PRESETS = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-3-months', label: 'Last 3 months' },
  { value: 'last-12-months', label: 'Last 12 months' },
  { value: 'year-to-date', label: 'Year to date' },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]['value'];

export const DEFAULT_PRESET: RangePreset = 'last-12-months';

export function presetRange(preset: RangePreset, today: string): DateRange {
  switch (preset) {
    case 'this-month':
      return { from: startOfMonth(today), to: today };
    case 'last-3-months':
      return { from: startOfMonth(addMonths(today, -2)), to: today };
    case 'last-12-months':
      return { from: startOfMonth(addMonths(today, -11)), to: today };
    case 'year-to-date':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** Reads ?from=&to= from the URL. Anything invalid falls back to the default preset. */
export function parseRangeParams(params: Record<string, string | string[] | undefined>, today: string): DateRange {
  const { from, to } = params;
  if (typeof from === 'string' && typeof to === 'string' && isValidISODate(from) && isValidISODate(to) && from <= to) {
    return { from, to };
  }
  return presetRange(DEFAULT_PRESET, today);
}

export function matchPreset(range: DateRange, today: string): RangePreset | 'custom' {
  const match = RANGE_PRESETS.find(({ value }) => {
    const preset = presetRange(value, today);
    return preset.from === range.from && preset.to === range.to;
  });
  return match ? match.value : 'custom';
}
```

- [ ] **Step 13: Run all unit tests**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 14: Commit**

```bash
git add lib/finance
git commit -m "Add date, money, and date range utilities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Finance summaries and filters

**Files:**
- Create: `lib/finance/summary.ts`, `lib/finance/filters.ts`
- Test: `lib/finance/summary.test.ts`, `lib/finance/filters.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `dates.ts` from Task 2.
- Produces:
  - `summary.ts`:
    - `filterByRange(txs: Transaction[], range: DateRange): Transaction[]`
    - `totals(txs: Transaction[]): { incomeCents: number; expenseCents: number; netCents: number; marginPct: number | null }`
    - `monthlySeries(txs: Transaction[], range: DateRange): MonthPoint[]` where `MonthPoint { month: string; label: string; incomeCents: number; expenseCents: number; netCents: number }`
    - `expensesByCategory(txs: Transaction[], categories: Category[]): { categoryId: string; name: string; totalCents: number }[]`
    - `displayStatus(status: InvoiceStatus, dueDate: string, today: string): DisplayStatus`
    - `receivables(invoices: InvoiceSummary[], today: string): { owedCents: number; overdueCents: number }`
    - `needsAttention(invoices: InvoiceSummary[], today: string, windowDays?: number): AttentionItem[]` where `AttentionItem = InvoiceSummary & { displayStatus: DisplayStatus; daysFromDue: number }`
  - `filters.ts`: `filterTransactions(txs: Transaction[], f: { categoryId?: string; search?: string; vendor?: string }): Transaction[]`, `distinctCounterparties(txs: Transaction[]): string[]`, `filterInvoicesByTab(invoices: InvoiceSummary[], tab: InvoiceTab, today: string): InvoiceSummary[]`, `INVOICE_TABS`, `InvoiceTab = 'all' | 'draft' | 'sent' | 'overdue' | 'paid'`, `parseInvoiceTab(v: unknown): InvoiceTab`.

- [ ] **Step 1: Write failing summary tests**

Create `lib/finance/summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { displayStatus, expensesByCategory, filterByRange, monthlySeries, needsAttention, receivables, totals } from './summary';
import type { Category, InvoiceSummary, Transaction } from './types';

let n = 0;
function tx(kind: Transaction['kind'], date: string, amountCents: number, categoryId = 'c1'): Transaction {
  n += 1;
  return { id: `t${n}`, kind, date, amountCents, categoryId, counterparty: 'X', note: null, invoiceId: null };
}

function inv(partial: Partial<InvoiceSummary>): InvoiceSummary {
  n += 1;
  return {
    id: `i${n}`, number: `INV-${1000 + n}`, clientId: 'cl', clientName: 'Client', issueDate: '2026-09-01',
    dueDate: '2026-10-01', status: 'sent', paidDate: null, notes: null, totalCents: 10000, ...partial,
  };
}

describe('filterByRange', () => {
  it('keeps both ends inclusive', () => {
    const rows = [tx('income', '2026-01-31', 1), tx('income', '2026-02-01', 2), tx('income', '2026-02-28', 3), tx('income', '2026-03-01', 4)];
    expect(filterByRange(rows, { from: '2026-02-01', to: '2026-02-28' }).map((t) => t.amountCents)).toEqual([2, 3]);
  });
});

describe('totals', () => {
  it('sums income, expenses, net, and margin', () => {
    expect(totals([tx('income', '2026-01-01', 100000), tx('expense', '2026-01-02', 75000)])).toEqual({
      incomeCents: 100000, expenseCents: 75000, netCents: 25000, marginPct: 25,
    });
  });
  it('rounds margin to one decimal and returns null without income', () => {
    expect(totals([tx('income', '2026-01-01', 30000), tx('expense', '2026-01-01', 20000)]).marginPct).toBe(33.3);
    expect(totals([tx('expense', '2026-01-01', 500)]).marginPct).toBeNull();
  });
});

describe('monthlySeries', () => {
  it('zero-fills every month in the range', () => {
    const series = monthlySeries([tx('income', '2026-01-15', 500), tx('expense', '2026-03-02', 200)], { from: '2026-01-01', to: '2026-03-31' });
    expect(series.map((p) => [p.month, p.incomeCents, p.expenseCents, p.netCents])).toEqual([
      ['2026-01', 500, 0, 500], ['2026-02', 0, 0, 0], ['2026-03', 0, 200, -200],
    ]);
    expect(series[0].label).toBe('Jan 2026');
  });
});

describe('expensesByCategory', () => {
  it('ranks expense categories by total and skips income', () => {
    const categories: Category[] = [
      { id: 'rent', kind: 'expense', name: 'Rent' }, { id: 'pay', kind: 'expense', name: 'Payroll' }, { id: 'inc', kind: 'income', name: 'Client payments' },
    ];
    const rows = [tx('expense', '2026-01-01', 300, 'rent'), tx('expense', '2026-01-02', 900, 'pay'), tx('income', '2026-01-03', 5000, 'inc')];
    expect(expensesByCategory(rows, categories)).toEqual([
      { categoryId: 'pay', name: 'Payroll', totalCents: 900 },
      { categoryId: 'rent', name: 'Rent', totalCents: 300 },
    ]);
  });
});

describe('displayStatus', () => {
  it('marks sent invoices overdue only after the due date', () => {
    expect(displayStatus('sent', '2026-10-14', '2026-10-15')).toBe('overdue');
    expect(displayStatus('sent', '2026-10-15', '2026-10-15')).toBe('sent');
    expect(displayStatus('paid', '2026-01-01', '2026-10-15')).toBe('paid');
    expect(displayStatus('draft', '2026-01-01', '2026-10-15')).toBe('draft');
  });
});

describe('receivables and needsAttention', () => {
  const today = '2026-10-15';
  const invoices = [
    inv({ dueDate: '2026-10-03', totalCents: 4800 }),
    inv({ dueDate: '2026-10-20', totalCents: 6250 }),
    inv({ dueDate: '2026-11-30', totalCents: 1000 }),
    inv({ status: 'paid', paidDate: '2026-10-01', dueDate: '2026-09-01', totalCents: 9999 }),
    inv({ status: 'draft', dueDate: '2026-10-01', totalCents: 7777 }),
  ];
  it('counts only sent invoices', () => {
    expect(receivables(invoices, today)).toEqual({ owedCents: 12050, overdueCents: 4800 });
  });
  it('lists overdue and due-soon invoices, earliest due first', () => {
    const items = needsAttention(invoices, today);
    expect(items.map((i) => [i.totalCents, i.displayStatus, i.daysFromDue])).toEqual([
      [4800, 'overdue', 12],
      [6250, 'sent', -5],
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/finance/summary.test.ts
```

Expected: FAIL, `Failed to resolve import "./summary"`.

- [ ] **Step 3: Implement `lib/finance/summary.ts`**

```ts
import { diffDays, monthKey, monthsBetween, toUTCDate } from './dates';
import type { Category, DateRange, DisplayStatus, InvoiceStatus, InvoiceSummary, Transaction } from './types';

export interface MonthPoint {
  month: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

export type AttentionItem = InvoiceSummary & { displayStatus: DisplayStatus; daysFromDue: number };

const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function filterByRange(txs: Transaction[], range: DateRange): Transaction[] {
  return txs.filter((t) => t.date >= range.from && t.date <= range.to);
}

export function totals(txs: Transaction[]) {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const t of txs) {
    if (t.kind === 'income') incomeCents += t.amountCents;
    else expenseCents += t.amountCents;
  }
  const netCents = incomeCents - expenseCents;
  const marginPct = incomeCents === 0 ? null : Math.round((netCents / incomeCents) * 1000) / 10;
  return { incomeCents, expenseCents, netCents, marginPct };
}

export function monthlySeries(txs: Transaction[], range: DateRange): MonthPoint[] {
  const points = new Map<string, MonthPoint>(
    monthsBetween(range.from, range.to).map((month) => [
      month,
      { month, label: monthLabel.format(toUTCDate(`${month}-01`)), incomeCents: 0, expenseCents: 0, netCents: 0 },
    ]),
  );
  for (const t of filterByRange(txs, range)) {
    const point = points.get(monthKey(t.date));
    if (!point) continue;
    if (t.kind === 'income') point.incomeCents += t.amountCents;
    else point.expenseCents += t.amountCents;
    point.netCents = point.incomeCents - point.expenseCents;
  }
  return [...points.values()];
}

export function expensesByCategory(txs: Transaction[], categories: Category[]) {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const sums = new Map<string, number>();
  for (const t of txs) {
    if (t.kind !== 'expense') continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amountCents);
  }
  return [...sums.entries()]
    .map(([categoryId, totalCents]) => ({ categoryId, name: names.get(categoryId) ?? 'Uncategorized', totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function displayStatus(status: InvoiceStatus, dueDate: string, today: string): DisplayStatus {
  return status === 'sent' && dueDate < today ? 'overdue' : status;
}

export function receivables(invoices: InvoiceSummary[], today: string) {
  let owedCents = 0;
  let overdueCents = 0;
  for (const invoice of invoices) {
    if (invoice.status !== 'sent') continue;
    owedCents += invoice.totalCents;
    if (invoice.dueDate < today) overdueCents += invoice.totalCents;
  }
  return { owedCents, overdueCents };
}

/** Overdue invoices plus invoices due within `windowDays`, earliest due first. */
export function needsAttention(invoices: InvoiceSummary[], today: string, windowDays = 14): AttentionItem[] {
  return invoices
    .filter((i) => i.status === 'sent' && diffDays(i.dueDate, today) <= windowDays)
    .map((i) => ({ ...i, displayStatus: displayStatus(i.status, i.dueDate, today), daysFromDue: diffDays(today, i.dueDate) }))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.number.localeCompare(b.number)));
}
```

- [ ] **Step 4: Run the summary tests**

```bash
npx vitest run lib/finance/summary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing filter tests**

Create `lib/finance/filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { distinctCounterparties, filterInvoicesByTab, filterTransactions, parseInvoiceTab } from './filters';
import type { InvoiceSummary, Transaction } from './types';

const rows: Transaction[] = [
  { id: '1', kind: 'expense', date: '2026-10-01', amountCents: 100, categoryId: 'rent', counterparty: 'Harborview Properties', note: 'October rent', invoiceId: null },
  { id: '2', kind: 'expense', date: '2026-10-02', amountCents: 200, categoryId: 'soft', counterparty: 'Pixelboard', note: null, invoiceId: null },
  { id: '3', kind: 'expense', date: '2026-10-03', amountCents: 300, categoryId: 'soft', counterparty: 'Cloudnest (storage), Inc.', note: '50% off', invoiceId: null },
];

describe('filterTransactions', () => {
  it('filters by category, vendor, and case-insensitive search over counterparty and note', () => {
    expect(filterTransactions(rows, { categoryId: 'soft' }).map((r) => r.id)).toEqual(['2', '3']);
    expect(filterTransactions(rows, { vendor: 'Pixelboard' }).map((r) => r.id)).toEqual(['2']);
    expect(filterTransactions(rows, { search: 'OCTOBER' }).map((r) => r.id)).toEqual(['1']);
  });
  it('treats special characters in search as plain text', () => {
    expect(filterTransactions(rows, { search: '(storage), inc' }).map((r) => r.id)).toEqual(['3']);
    expect(filterTransactions(rows, { search: '50%' }).map((r) => r.id)).toEqual(['3']);
  });
  it('ignores empty filters', () => {
    expect(filterTransactions(rows, { search: '  ', categoryId: '', vendor: '' })).toHaveLength(3);
  });
});

describe('distinctCounterparties', () => {
  it('returns sorted unique names', () => {
    expect(distinctCounterparties([...rows, rows[1]])).toEqual(['Cloudnest (storage), Inc.', 'Harborview Properties', 'Pixelboard']);
  });
});

describe('invoice tabs', () => {
  const base = { clientId: 'c', clientName: 'C', issueDate: '2026-09-01', paidDate: null, notes: null, totalCents: 1 };
  const invoices: InvoiceSummary[] = [
    { ...base, id: 'a', number: 'INV-1', status: 'draft', dueDate: '2026-09-15' },
    { ...base, id: 'b', number: 'INV-2', status: 'sent', dueDate: '2026-09-15' },
    { ...base, id: 'c', number: 'INV-3', status: 'sent', dueDate: '2026-12-15' },
    { ...base, id: 'd', number: 'INV-4', status: 'paid', dueDate: '2026-09-15', paidDate: '2026-09-10' },
  ];
  const today = '2026-10-15';
  it('splits sent into sent and overdue tabs', () => {
    expect(filterInvoicesByTab(invoices, 'all', today)).toHaveLength(4);
    expect(filterInvoicesByTab(invoices, 'overdue', today).map((i) => i.id)).toEqual(['b']);
    expect(filterInvoicesByTab(invoices, 'sent', today).map((i) => i.id)).toEqual(['c']);
    expect(filterInvoicesByTab(invoices, 'draft', today).map((i) => i.id)).toEqual(['a']);
    expect(filterInvoicesByTab(invoices, 'paid', today).map((i) => i.id)).toEqual(['d']);
  });
  it('parses unknown tabs as all', () => {
    expect(parseInvoiceTab('overdue')).toBe('overdue');
    expect(parseInvoiceTab('nope')).toBe('all');
    expect(parseInvoiceTab(['paid'])).toBe('all');
  });
});
```

- [ ] **Step 6: Run to verify it fails**

```bash
npx vitest run lib/finance/filters.test.ts
```

Expected: FAIL, `Failed to resolve import "./filters"`.

- [ ] **Step 7: Implement `lib/finance/filters.ts`**

```ts
import { displayStatus } from './summary';
import type { InvoiceSummary, Transaction } from './types';

export const INVOICE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
] as const;

export type InvoiceTab = (typeof INVOICE_TABS)[number]['value'];

export function parseInvoiceTab(value: unknown): InvoiceTab {
  return INVOICE_TABS.some((t) => t.value === value) ? (value as InvoiceTab) : 'all';
}

export function filterTransactions(
  txs: Transaction[],
  filters: { categoryId?: string; search?: string; vendor?: string },
): Transaction[] {
  const search = filters.search?.trim().toLowerCase() ?? '';
  return txs.filter((t) => {
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.vendor && t.counterparty !== filters.vendor) return false;
    if (search) {
      const haystack = `${t.counterparty} ${t.note ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function distinctCounterparties(txs: Transaction[]): string[] {
  return [...new Set(txs.map((t) => t.counterparty))].sort((a, b) => a.localeCompare(b));
}

export function filterInvoicesByTab(invoices: InvoiceSummary[], tab: InvoiceTab, today: string): InvoiceSummary[] {
  if (tab === 'all') return invoices;
  return invoices.filter((i) => displayStatus(i.status, i.dueDate, today) === tab);
}
```

- [ ] **Step 8: Run all unit tests**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/finance
git commit -m "Add finance summaries and list filters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Sample data generator

**Files:**
- Create: `lib/sample-data/types.ts`, `lib/sample-data/random.ts`, `lib/sample-data/catalog.ts`, `lib/sample-data/generate.ts`
- Test: `lib/sample-data/random.test.ts`, `lib/sample-data/generate.test.ts`

**Interfaces:**
- Consumes: `dates.ts`, `money.ts` (`invoiceTotalCents`), `summary.ts` (`totals`, `monthlySeries`) from Tasks 2 and 3.
- Produces:
  - `types.ts`: `SampleCategory { key: string; kind: TransactionKind; name: string }`, `SampleClient { key: string; name: string; email: string }`, `SampleInvoiceItem { description: string; quantity: number; unitPriceCents: number }`, `SampleInvoice { key: string; number: string; clientKey: string; issueDate: string; dueDate: string; status: InvoiceStatus; paidDate: string | null; notes: string | null; items: SampleInvoiceItem[] }`, `SampleTransaction { kind: TransactionKind; date: string; amountCents: number; categoryKey: string; counterparty: string; note: string | null; invoiceKey: string | null }`, `SampleBusiness { name: string; categories: SampleCategory[]; clients: SampleClient[]; invoices: SampleInvoice[]; transactions: SampleTransaction[] }`. This JSON shape is the `p_data` payload of `load_sample_data` in Task 6.
  - `generate.ts`: `generateSampleBusiness(opts: { today: string; seed?: number }): SampleBusiness`, `SAMPLE_SEED = 20261015`, `SAMPLE_BUSINESS_NAME = 'Northfield Studio'`, `HISTORY_MONTHS = 18`, `CLIENT_PAYMENTS_CATEGORY = 'Client payments'`.

- [ ] **Step 1: Write the payload types**

Create `lib/sample-data/types.ts`:

```ts
import type { InvoiceStatus, TransactionKind } from '@/lib/finance/types';

// Plain JSON sent to the load_sample_data database function. Keys link rows
// together; the database replaces them with real ids.

export interface SampleCategory {
  key: string;
  kind: TransactionKind;
  name: string;
}

export interface SampleClient {
  key: string;
  name: string;
  email: string;
}

export interface SampleInvoiceItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface SampleInvoice {
  key: string;
  number: string;
  clientKey: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidDate: string | null;
  notes: string | null;
  items: SampleInvoiceItem[];
}

export interface SampleTransaction {
  kind: TransactionKind;
  date: string;
  amountCents: number;
  categoryKey: string;
  counterparty: string;
  note: string | null;
  invoiceKey: string | null;
}

export interface SampleBusiness {
  name: string;
  categories: SampleCategory[];
  clients: SampleClient[];
  invoices: SampleInvoice[];
  transactions: SampleTransaction[];
}
```

- [ ] **Step 2: Write failing random generator tests**

Create `lib/sample-data/random.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chance, createRandom, pick, randInt } from './random';

describe('createRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('returns numbers in [0, 1)', () => {
    const rng = createRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });
});

describe('helpers', () => {
  it('randInt stays inside inclusive bounds and hits both ends', () => {
    const rng = createRandom(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(randInt(rng, 1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
  it('pick and chance use the generator', () => {
    const rng = createRandom(5);
    expect(['a', 'b', 'c']).toContain(pick(rng, ['a', 'b', 'c']));
    expect(chance(createRandom(5), 0)).toBe(false);
    expect(chance(createRandom(5), 1)).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npx vitest run lib/sample-data/random.test.ts
```

Expected: FAIL, `Failed to resolve import "./random"`.

- [ ] **Step 4: Implement `lib/sample-data/random.ts`**

```ts
export type Random = () => number;

/** mulberry32: a tiny seeded generator. Same seed, same sequence, on every machine. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randInt(rng: Random, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Random, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function chance(rng: Random, probability: number): boolean {
  return rng() < probability;
}
```

- [ ] **Step 5: Run the random tests**

```bash
npx vitest run lib/sample-data/random.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write the catalog of invented names**

Create `lib/sample-data/catalog.ts`:

```ts
import type { SampleCategory, SampleClient } from './types';

// Every name here is invented. Emails use example.com only.

export const CATEGORIES: SampleCategory[] = [
  { key: 'client-payments', kind: 'income', name: 'Client payments' },
  { key: 'workshops', kind: 'income', name: 'Workshops' },
  { key: 'interest', kind: 'income', name: 'Interest' },
  { key: 'payroll', kind: 'expense', name: 'Payroll' },
  { key: 'rent', kind: 'expense', name: 'Rent' },
  { key: 'software', kind: 'expense', name: 'Software' },
  { key: 'insurance', kind: 'expense', name: 'Insurance' },
  { key: 'utilities', kind: 'expense', name: 'Utilities' },
  { key: 'contractors', kind: 'expense', name: 'Contractors' },
  { key: 'marketing', kind: 'expense', name: 'Marketing' },
  { key: 'equipment', kind: 'expense', name: 'Equipment' },
  { key: 'travel-fees', kind: 'expense', name: 'Travel and fees' },
];

const CLIENT_NAMES = [
  'Northwind Cafe', 'Lakeside Dental', 'Grove Fitness', 'Harbor Books', 'Maple Street Bakery',
  'Pinecrest Realty', 'Riverbend Vet Clinic', 'Sunset Yoga Studio', 'Copperleaf Brewing', 'Bluebird Florist',
  'Oakridge Law Office', 'Elm City Plumbing', 'Brightside Pediatrics', 'Cedar Hill Hotel',
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const CLIENTS: SampleClient[] = CLIENT_NAMES.map((name) => ({
  key: slug(name),
  name,
  email: `billing.${slug(name)}@example.com`,
}));

export const SERVICES = [
  'Brand strategy', 'Logo and identity design', 'Website design', 'Website maintenance', 'Social media management',
  'Photography session', 'Ad campaign setup', 'Copywriting', 'Print design', 'Email newsletter design',
] as const;

export const SOFTWARE = [
  { vendor: 'Pixelboard', day: 3, cents: 32_000, note: 'Design suite, team plan' },
  { vendor: 'LedgerLeaf', day: 5, cents: 6_000, note: 'Accounting software' },
  { vendor: 'Cloudnest', day: 8, cents: 4_500, note: 'File storage' },
  { vendor: 'Taskgrove', day: 12, cents: 9_000, note: 'Project management' },
  { vendor: 'Meetloop', day: 15, cents: 7_500, note: 'Video calls' },
  { vendor: 'Fontshelf', day: 20, cents: 9_000, note: 'Font library' },
] as const;

export const CONTRACTORS = [
  'Alex Rivera, freelance developer', 'Sam Okafor, copywriter', 'Jordan Lee, photographer', 'Priya Nair, motion designer',
] as const;

export const MARKETING = [
  { vendor: 'Adwave', note: 'Social ads' },
  { vendor: 'Inkhouse Printing', note: 'Brochures and cards' },
  { vendor: 'Downtown Business Expo', note: 'Event booth' },
] as const;

export const TRAVEL = [
  { vendor: 'Coastline Rail', note: 'Client visit' },
  { vendor: 'Corner Table Bistro', note: 'Client lunch' },
  { vendor: 'Skyport Parking', note: 'Airport parking' },
] as const;

export const EQUIPMENT_NOTES = ['Laptop', 'Monitor', 'Camera lens', 'Studio lights'] as const;

export const WORKSHOP_PAYERS = ['Northfield Public Library', 'Downtown Business Association'] as const;
```

- [ ] **Step 7: Write failing generator tests**

Create `lib/sample-data/generate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addMonths, startOfMonth } from '@/lib/finance/dates';
import { invoiceTotalCents } from '@/lib/finance/money';
import { monthlySeries, totals } from '@/lib/finance/summary';
import type { Transaction } from '@/lib/finance/types';
import { CATEGORIES } from './catalog';
import { generateSampleBusiness, HISTORY_MONTHS, SAMPLE_BUSINESS_NAME } from './generate';
import type { SampleTransaction } from './types';

function asTransactions(rows: SampleTransaction[]): Transaction[] {
  return rows.map((r, i) => ({
    id: String(i), kind: r.kind, date: r.date, amountCents: r.amountCents,
    categoryId: r.categoryKey, counterparty: r.counterparty, note: r.note, invoiceId: r.invoiceKey,
  }));
}

// Several "today" values so the invariants hold all year, including January and leap years.
const TODAYS = ['2026-10-15', '2027-01-03', '2027-03-31', '2028-02-29', '2026-08-01'];

describe.each(TODAYS)('generateSampleBusiness with today %s', (today) => {
  const data = generateSampleBusiness({ today });
  const firstDay = startOfMonth(addMonths(today, -(HISTORY_MONTHS - 1)));

  it('is deterministic', () => {
    expect(generateSampleBusiness({ today })).toEqual(data);
  });

  it('names the business and uses the catalog categories', () => {
    expect(data.name).toBe(SAMPLE_BUSINESS_NAME);
    expect(data.categories).toEqual(CATEGORIES);
    const keys = new Set(CATEGORIES.map((c) => c.key));
    for (const t of data.transactions) {
      expect(keys.has(t.categoryKey)).toBe(true);
      expect(CATEGORIES.find((c) => c.key === t.categoryKey)?.kind).toBe(t.kind);
    }
  });

  it('dates everything inside the 18-month window and never after today', () => {
    for (const t of data.transactions) {
      expect(t.date >= firstDay && t.date <= today).toBe(true);
      expect(Number.isInteger(t.amountCents) && t.amountCents > 0).toBe(true);
    }
    for (const i of data.invoices) {
      expect(i.issueDate >= firstDay && i.issueDate <= today).toBe(true);
      expect(i.dueDate >= i.issueDate).toBe(true);
    }
  });

  it('gives every paid invoice exactly one matching payment and no other invoice a payment', () => {
    const payments = data.transactions.filter((t) => t.invoiceKey);
    const byInvoice = new Map(payments.map((p) => [p.invoiceKey, p]));
    expect(byInvoice.size).toBe(payments.length);
    for (const invoice of data.invoices) {
      const payment = byInvoice.get(invoice.key);
      if (invoice.status === 'paid') {
        expect(payment?.amountCents).toBe(invoiceTotalCents(invoice.items));
        expect(payment?.date).toBe(invoice.paidDate);
        expect(payment?.categoryKey).toBe('client-payments');
      } else {
        expect(payment).toBeUndefined();
        expect(invoice.paidDate).toBeNull();
      }
    }
  });

  it('has 4 to 6 overdue invoices, at least 3 due in 14 days, and 2 drafts', () => {
    const overdue = data.invoices.filter((i) => i.status === 'sent' && i.dueDate < today);
    expect(overdue.length).toBeGreaterThanOrEqual(4);
    expect(overdue.length).toBeLessThanOrEqual(6);
    const soon = data.invoices.filter(
      (i) => i.status === 'sent' && i.dueDate >= today && Date.parse(i.dueDate) - Date.parse(today) <= 14 * 86_400_000,
    );
    expect(soon.length).toBeGreaterThanOrEqual(3);
    expect(data.invoices.filter((i) => i.status === 'draft')).toHaveLength(2);
  });

  it('numbers invoices INV-1001 upward in issue date order', () => {
    data.invoices.forEach((invoice, index) => {
      expect(invoice.number).toBe(`INV-${1001 + index}`);
      if (index > 0) expect(invoice.issueDate >= data.invoices[index - 1].issueDate).toBe(true);
    });
  });

  it('keeps invoice totals between $800 and $12,000', () => {
    for (const invoice of data.invoices) {
      const total = invoiceTotalCents(invoice.items);
      expect(total).toBeGreaterThanOrEqual(80_000);
      expect(total).toBeLessThanOrEqual(1_200_000);
    }
  });

  it('lands the overall margin between 15% and 25%', () => {
    const { marginPct } = totals(asTransactions(data.transactions));
    expect(marginPct).not.toBeNull();
    expect(marginPct!).toBeGreaterThanOrEqual(15);
    expect(marginPct!).toBeLessThanOrEqual(25);
  });

  it('includes at least one full month with a loss', () => {
    const fullMonths = monthlySeries(asTransactions(data.transactions), { from: firstDay, to: today })
      .filter((p) => p.month !== today.slice(0, 7));
    expect(fullMonths.some((p) => p.netCents < 0)).toBe(true);
  });

  it('uses only example.com emails', () => {
    for (const client of data.clients) expect(client.email.endsWith('@example.com')).toBe(true);
  });
});

describe('seeds', () => {
  it('produces different data for different seeds', () => {
    const a = generateSampleBusiness({ today: '2026-10-15', seed: 1 });
    const b = generateSampleBusiness({ today: '2026-10-15', seed: 2 });
    expect(a.transactions).not.toEqual(b.transactions);
  });
});
```

- [ ] **Step 8: Run to verify it fails**

```bash
npx vitest run lib/sample-data/generate.test.ts
```

Expected: FAIL, `Failed to resolve import "./generate"`.

- [ ] **Step 9: Implement `lib/sample-data/generate.ts`**

```ts
import { addDays, addMonths, daysInMonth, diffDays, endOfMonth, monthsBetween, startOfMonth } from '@/lib/finance/dates';
import { invoiceTotalCents } from '@/lib/finance/money';
import {
  CATEGORIES, CLIENTS, CONTRACTORS, EQUIPMENT_NOTES, MARKETING, SERVICES, SOFTWARE, TRAVEL, WORKSHOP_PAYERS,
} from './catalog';
import { chance, createRandom, pick, randInt, type Random } from './random';
import type { SampleBusiness, SampleInvoice, SampleInvoiceItem, SampleTransaction } from './types';

export const SAMPLE_SEED = 20261015;
export const SAMPLE_BUSINESS_NAME = 'Northfield Studio';
export const HISTORY_MONTHS = 18;
export const CLIENT_PAYMENTS_CATEGORY = 'Client payments';

// Tuned so the overall margin lands between 15% and 25%. See the margin test.
const PAYROLL_PER_RUN_CENTS = 920_000;

export function generateSampleBusiness({ today, seed = SAMPLE_SEED }: { today: string; seed?: number }): SampleBusiness {
  const rng = createRandom(seed);
  const firstDay = startOfMonth(addMonths(today, -(HISTORY_MONTHS - 1)));
  const months = monthsBetween(firstDay, today);

  const invoices = generateInvoices(rng, months, today);
  finalizeInvoiceStates(rng, invoices, today);
  invoices.sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.key.localeCompare(b.key));
  invoices.forEach((invoice, index) => {
    invoice.number = `INV-${1001 + index}`;
  });

  const transactions: SampleTransaction[] = [
    ...paymentTransactions(invoices),
    ...otherIncome(rng, months, today),
    ...expenses(rng, months, firstDay, today),
  ];
  addLossMonth(rng, transactions, firstDay, today);
  transactions.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.counterparty.localeCompare(b.counterparty));

  return { name: SAMPLE_BUSINESS_NAME, categories: CATEGORIES, clients: CLIENTS, invoices, transactions };
}

function generateInvoices(rng: Random, months: string[], today: string): SampleInvoice[] {
  const invoices: SampleInvoice[] = [];
  months.forEach((month, index) => {
    const first = `${month}-01`;
    const isCurrentMonth = month === today.slice(0, 7);
    const lastDay = isCurrentMonth ? Number(today.slice(8, 10)) : daysInMonth(first);
    const monthNumber = Number(month.slice(5, 7));
    let count = randInt(rng, 10, 14);
    if (monthNumber === 1 || monthNumber === 8) count -= 3; // seasonal dips
    if (isCurrentMonth) count = Math.max(1, Math.round((count * lastDay) / daysInMonth(first)));
    const growth = 0.92 + 0.01 * index;

    for (let i = 0; i < count; i += 1) {
      const issueDate = addDays(first, randInt(rng, 0, lastDay - 1));
      const termsDays = chance(rng, 0.5) ? 15 : 30;
      const invoice: SampleInvoice = {
        key: `inv-${invoices.length + 1}`,
        number: '',
        clientKey: pick(rng, CLIENTS).key,
        issueDate,
        dueDate: addDays(issueDate, termsDays),
        status: 'sent',
        paidDate: null,
        notes: null,
        items: splitIntoItems(rng, invoiceAmountCents(rng, growth)),
      };
      assignPayment(rng, invoice, termsDays, today);
      invoices.push(invoice);
    }
  });
  return invoices;
}

function invoiceAmountCents(rng: Random, growth: number): number {
  const dollars = chance(rng, 0.1) ? randInt(rng, 6000, 12000) : randInt(rng, 1200, 4200);
  const roundedTo50 = Math.round((dollars * growth) / 50) * 50;
  return Math.min(1_200_000, Math.max(80_000, roundedTo50 * 100));
}

function splitIntoItems(rng: Random, totalCents: number): SampleInvoiceItem[] {
  const count = totalCents >= 300_000 ? randInt(rng, 1, 3) : 1;
  const services = [...SERVICES];
  const items: SampleInvoiceItem[] = [];
  let remaining = totalCents;
  for (let i = 0; i < count; i += 1) {
    const description = services.splice(Math.floor(rng() * services.length), 1)[0];
    const isLast = i === count - 1;
    const share = randInt(rng, 25, 50) / 100;
    const amount = isLast ? remaining : Math.max(10_000, Math.round((remaining * share) / 5_000) * 5_000);
    remaining -= isLast ? 0 : amount;
    items.push({ description, quantity: 1, unitPriceCents: amount });
  }
  return items;
}

function assignPayment(rng: Random, invoice: SampleInvoice, termsDays: number, today: string): void {
  const roll = rng();
  let paidDate: string | null;
  if (roll < 0.7) paidDate = addDays(invoice.issueDate, randInt(rng, 3, termsDays));
  else if (roll < 0.92) paidDate = addDays(invoice.dueDate, randInt(rng, 5, 40));
  else paidDate = diffDays(today, invoice.dueDate) > 60 ? addDays(invoice.dueDate, randInt(rng, 41, 60)) : null;
  if (paidDate && paidDate <= today) {
    invoice.status = 'paid';
    invoice.paidDate = paidDate;
  }
}

function markPaid(invoice: SampleInvoice, paidDate: string): void {
  invoice.status = 'paid';
  invoice.paidDate = paidDate;
}

function markOpen(invoice: SampleInvoice, status: 'sent' | 'draft'): void {
  invoice.status = status;
  invoice.paidDate = null;
}

/** Forces the "today" picture the spec promises: 2 drafts, 4 to 6 overdue, at least 3 due soon. */
function finalizeInvoiceStates(rng: Random, invoices: SampleInvoice[], today: string): void {
  const newestFirst = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.key.localeCompare(a.key));
  for (const invoice of newestFirst.slice(0, 2)) markOpen(invoice, 'draft');

  const target = randInt(rng, 4, 6);
  const overdue = invoices
    .filter((i) => i.status === 'sent' && i.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const invoice of overdue.slice(0, Math.max(0, overdue.length - target))) {
    const paid = addDays(invoice.dueDate, randInt(rng, 3, 20));
    markPaid(invoice, paid < today ? paid : today);
  }
  if (overdue.length < target) {
    const recentlyPaid = invoices
      .filter((i) => i.status === 'paid' && i.dueDate < today)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    for (const invoice of recentlyPaid.slice(0, target - overdue.length)) markOpen(invoice, 'sent');
  }

  const isDueSoon = (i: SampleInvoice) => i.dueDate >= today && diffDays(i.dueDate, today) <= 14;
  const dueSoon = invoices.filter((i) => i.status === 'sent' && isDueSoon(i));
  if (dueSoon.length < 3) {
    const paidEarly = invoices
      .filter((i) => i.status === 'paid' && isDueSoon(i))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const invoice of paidEarly.slice(0, 3 - dueSoon.length)) markOpen(invoice, 'sent');
  }
}

function paymentTransactions(invoices: SampleInvoice[]): SampleTransaction[] {
  const clientNames = new Map(CLIENTS.map((c) => [c.key, c.name]));
  return invoices
    .filter((i) => i.status === 'paid' && i.paidDate)
    .map((i) => ({
      kind: 'income' as const,
      date: i.paidDate as string,
      amountCents: invoiceTotalCents(i.items),
      categoryKey: 'client-payments',
      counterparty: clientNames.get(i.clientKey) ?? 'Client',
      note: `Payment for ${i.number}`,
      invoiceKey: i.key,
    }));
}

function randomDayIn(rng: Random, first: string): string {
  return addDays(first, randInt(rng, 0, daysInMonth(first) - 1));
}

function otherIncome(rng: Random, months: string[], today: string): SampleTransaction[] {
  const rows: SampleTransaction[] = [];
  for (const month of months) {
    const first = `${month}-01`;
    if (chance(rng, 0.35)) {
      const date = randomDayIn(rng, first);
      const amountCents = randInt(rng, 400, 1500) * 100;
      if (date <= today) {
        rows.push({ kind: 'income', date, amountCents, categoryKey: 'workshops', counterparty: pick(rng, WORKSHOP_PAYERS), note: 'Workshop fee', invoiceKey: null });
      }
    }
    const interestDate = endOfMonth(first);
    const interestCents = randInt(rng, 800, 4000);
    if (interestDate <= today) {
      rows.push({ kind: 'income', date: interestDate, amountCents: interestCents, categoryKey: 'interest', counterparty: 'Summit Bank', note: 'Monthly interest', invoiceKey: null });
    }
  }
  return rows;
}

function expenses(rng: Random, months: string[], firstDay: string, today: string): SampleTransaction[] {
  const rows: SampleTransaction[] = [];
  const add = (date: string, categoryKey: string, counterparty: string, amountCents: number, note: string | null) => {
    if (date >= firstDay && date <= today) {
      rows.push({ kind: 'expense', date, amountCents, categoryKey, counterparty, note, invoiceKey: null });
    }
  };

  for (let date = addDays(firstDay, 4); date <= today; date = addDays(date, 14)) {
    add(date, 'payroll', 'Northfield Studio payroll', PAYROLL_PER_RUN_CENTS, 'Team payroll, 6 people');
  }

  for (const month of months) {
    const first = `${month}-01`;
    const monthNumber = Number(month.slice(5, 7));
    add(first, 'rent', 'Harborview Properties', 320_000, 'Studio rent');
    for (const sub of SOFTWARE) add(addDays(first, sub.day - 1), 'software', sub.vendor, sub.cents, sub.note);
    if ([1, 4, 7, 10].includes(monthNumber)) add(addDays(first, 4), 'insurance', 'Brightline Insurance', 195_000, 'Quarterly business insurance');

    const peakSeason = [12, 1, 2, 6, 7, 8].includes(monthNumber);
    add(addDays(first, 17), 'utilities', 'Metro Power', 18_000 + (peakSeason ? randInt(rng, 12_000, 24_000) : randInt(rng, 0, 6_000)), 'Electricity');
    add(addDays(first, 21), 'utilities', 'Fiberlink Internet', 12_000, 'Internet');

    const contractorCount = randInt(rng, 2, 4);
    for (let i = 0; i < contractorCount; i += 1) {
      add(randomDayIn(rng, first), 'contractors', pick(rng, CONTRACTORS), randInt(rng, 8, 30) * 5_000, 'Project work');
    }
    const marketingCount = randInt(rng, 1, 2);
    for (let i = 0; i < marketingCount; i += 1) {
      const m = pick(rng, MARKETING);
      add(randomDayIn(rng, first), 'marketing', m.vendor, randInt(rng, 300, 1500) * 100, m.note);
    }
    const travelCount = randInt(rng, 0, 3);
    for (let i = 0; i < travelCount; i += 1) {
      const t = pick(rng, TRAVEL);
      add(randomDayIn(rng, first), 'travel-fees', t.vendor, randInt(rng, 80, 600) * 100, t.note);
    }
    add(addDays(first, 27), 'travel-fees', 'Summit Bank', 2_500, 'Monthly account fee');
    if (chance(rng, 0.25)) {
      add(randomDayIn(rng, first), 'equipment', 'Gearloft', randInt(rng, 1500, 4000) * 100, pick(rng, EQUIPMENT_NOTES));
    }
  }
  return rows;
}

/** Adds an equipment upgrade in the latest complete January, sized so that month is a loss. */
function addLossMonth(rng: Random, transactions: SampleTransaction[], firstDay: string, today: string): void {
  const currentMonth = startOfMonth(today);
  let january = `${today.slice(0, 4)}-01-01`;
  if (january >= currentMonth) january = `${Number(today.slice(0, 4)) - 1}-01-01`;
  if (january < firstDay) return;
  const end = endOfMonth(january);
  let net = 0;
  for (const t of transactions) {
    if (t.date < january || t.date > end) continue;
    net += t.kind === 'income' ? t.amountCents : -t.amountCents;
  }
  const amountCents = Math.max(900_000, Math.ceil((net + randInt(rng, 50_000, 150_000)) / 100_000) * 100_000);
  transactions.push({
    kind: 'expense', date: addDays(january, 19), amountCents, categoryKey: 'equipment',
    counterparty: 'Gearloft', note: 'Studio equipment upgrade', invoiceKey: null,
  });
}
```

- [ ] **Step 10: Run the generator tests**

```bash
npx vitest run lib/sample-data
```

Expected: PASS for every `today`. If only the margin test fails, change `PAYROLL_PER_RUN_CENTS` in steps of `20_000` (lower raises the margin, higher lowers it) and re-run until all five dates pass. Do not change the test bounds.

- [ ] **Step 11: Print a summary for the record**

```bash
npx tsx -e "import { generateSampleBusiness } from './lib/sample-data/generate'; const d = generateSampleBusiness({ today: '2026-10-15' }); console.log({ invoices: d.invoices.length, transactions: d.transactions.length, items: d.invoices.reduce((n, i) => n + i.items.length, 0) });"
```

Expected: roughly `invoices: 200` to `230`, `transactions: 500` to `650`. Note the numbers in the commit message.

- [ ] **Step 12: Run all unit tests and commit**

```bash
npm test
```

Expected: all PASS.

```bash
git add lib/sample-data
git commit -m "Add seeded sample business generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Local Supabase, schema, and row level security

**Files:**
- Create: `supabase/config.toml` (generated), `supabase/migrations/<timestamp>_schema.sql`
- Test: `supabase/tests/database/01_constraints.test.sql`, `supabase/tests/database/02_rls_isolation.test.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks (runs in Docker).
- Produces: tables `businesses`, `business_members`, `categories`, `clients`, `invoices`, `invoice_items`, `transactions`; view `invoice_summaries` (columns `id, business_id, number, client_id, client_name, issue_date, due_date, status, paid_date, notes, total_cents, display_status`); helper `private.is_business_member(uuid) returns boolean`. Column names exactly as in the SQL below; later tasks depend on them.

- [ ] **Step 1: Initialize Supabase in the repo**

```bash
npx supabase init
```

Answer `N` to any editor settings prompts. Expected: `Finished supabase init.` and a new `supabase/config.toml`.

- [ ] **Step 2: Turn on anonymous sign-in locally and raise its rate limit**

In `supabase/config.toml`, under `[auth]`, set:

```toml
enable_anonymous_sign_ins = true
```

Under `[auth.rate_limit]`, set:

```toml
anonymous_users = 300
```

Leave every other value as generated.

- [ ] **Step 3: Start the local stack**

Docker Desktop must be running.

```bash
npm run db:start
```

Expected: a status block with `API URL: http://127.0.0.1:54321` and `DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

- [ ] **Step 4: Write the failing constraint and view test**

Create `supabase/tests/database/01_constraints.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Setup runs as postgres, which owns the tables, so RLS does not apply here.
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
insert into public.businesses (id, name, created_by)
values ('00000000-0000-4000-8000-0000000000a2', 'A Studio', '00000000-0000-4000-8000-0000000000a1');
insert into public.categories (id, business_id, kind, name) values
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a2', 'expense', 'Rent'),
  ('00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000a2', 'income', 'Client payments');
insert into public.clients (id, business_id, name)
values ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a2', 'Northwind Cafe');
insert into public.invoices (id, business_id, client_id, number, issue_date, due_date, status)
values ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'INV-1001', current_date - 40, current_date - 10, 'sent');
insert into public.invoice_items (invoice_id, business_id, description, quantity, unit_price_cents, position) values
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', 'Design', 1.5, 3333, 0),
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', 'Hosting', 1, 10000, 1);

select is(
  (select total_cents from public.invoice_summaries where id = '00000000-0000-4000-8000-0000000000a5'),
  15000::bigint,
  'invoice total rounds each line half away from zero, like the app'
);
select is(
  (select display_status from public.invoice_summaries where id = '00000000-0000-4000-8000-0000000000a5'),
  'overdue'::text,
  'a sent invoice past its due date shows as overdue'
);
select throws_ok(
  $$ insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty)
     values ('00000000-0000-4000-8000-0000000000a2', 'expense', current_date, 0, '00000000-0000-4000-8000-0000000000a3', 'X') $$,
  '23514', null, 'amounts must be above zero'
);
select throws_ok(
  $$ insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty)
     values ('00000000-0000-4000-8000-0000000000a2', 'expense', current_date, 100, '00000000-0000-4000-8000-0000000000a8', 'X') $$,
  '23503', null, 'an expense cannot use an income category'
);
select throws_ok(
  $$ insert into public.invoices (business_id, client_id, number, issue_date, due_date)
     values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'INV-1002', current_date, current_date - 1) $$,
  '23514', null, 'a due date cannot come before the issue date'
);
select throws_ok(
  $$ update public.invoices set status = 'paid' where id = '00000000-0000-4000-8000-0000000000a5' $$,
  '23514', null, 'a paid invoice needs a payment date'
);
select throws_ok(
  $$ insert into public.invoices (business_id, client_id, number, issue_date, due_date)
     values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'INV-1001', current_date, current_date) $$,
  '23505', null, 'invoice numbers are unique per business'
);
select throws_ok(
  $$ insert into public.clients (business_id, name) values ('00000000-0000-4000-8000-0000000000a2', 'northwind cafe') $$,
  '23505', null, 'client names are unique per business, ignoring case'
);
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint,
  'every table in public has RLS enabled'
);

select * from finish();
rollback;
```

- [ ] **Step 5: Write the failing isolation test**

Create `supabase/tests/database/02_rls_isolation.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Two visitors, A and B, each with a full business. Setup runs as postgres.
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
insert into public.businesses (id, name, created_by) values
  ('00000000-0000-4000-8000-0000000000a2', 'A Studio', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b2', 'B Studio', '00000000-0000-4000-8000-0000000000b1');
insert into public.business_members (business_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1', 'owner'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b1', 'owner');
insert into public.categories (id, business_id, kind, name) values
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a2', 'expense', 'Rent'),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b2', 'expense', 'Rent');
insert into public.clients (id, business_id, name) values
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a2', 'Client A'),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b2', 'Client B');
insert into public.invoices (id, business_id, client_id, number, issue_date, due_date) values
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'INV-1001', current_date, current_date + 30),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b4', 'INV-1001', current_date, current_date + 30);
insert into public.invoice_items (invoice_id, business_id, description, quantity, unit_price_cents) values
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', 'Work', 1, 5000),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000b2', 'Work', 1, 5000);
insert into public.transactions (id, business_id, kind, date, amount_cents, category_id, counterparty) values
  ('00000000-0000-4000-8000-0000000000a7', '00000000-0000-4000-8000-0000000000a2', 'expense', current_date, 100, '00000000-0000-4000-8000-0000000000a3', 'Landlord'),
  ('00000000-0000-4000-8000-0000000000b7', '00000000-0000-4000-8000-0000000000b2', 'expense', current_date, 100, '00000000-0000-4000-8000-0000000000b3', 'Landlord');

-- Act as visitor A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select results_eq($$ select count(*) from public.businesses $$, $$ values (1::bigint) $$, 'A sees only their business');
select results_eq($$ select count(*) from public.business_members $$, $$ values (1::bigint) $$, 'A sees only their membership');
select results_eq($$ select count(*) from public.categories $$, $$ values (1::bigint) $$, 'A sees only their categories');
select results_eq($$ select count(*) from public.clients $$, $$ values (1::bigint) $$, 'A sees only their clients');
select results_eq($$ select count(*) from public.invoices $$, $$ values (1::bigint) $$, 'A sees only their invoices');
select results_eq($$ select count(*) from public.invoice_items $$, $$ values (1::bigint) $$, 'A sees only their invoice items');
select results_eq($$ select count(*) from public.transactions $$, $$ values (1::bigint) $$, 'A sees only their transactions');
select results_eq($$ select count(*) from public.invoice_summaries $$, $$ values (1::bigint) $$, 'the view applies the same rules');

select is_empty($$ update public.categories set name = 'Taken' where business_id = '00000000-0000-4000-8000-0000000000b2' returning 1 $$, 'A cannot update B categories');
select is_empty($$ delete from public.transactions where business_id = '00000000-0000-4000-8000-0000000000b2' returning 1 $$, 'A cannot delete B transactions');
select is_empty($$ update public.businesses set name = 'Taken' where id = '00000000-0000-4000-8000-0000000000b2' returning 1 $$, 'A cannot rename B business');

select throws_ok(
  $$ insert into public.categories (business_id, kind, name) values ('00000000-0000-4000-8000-0000000000b2', 'expense', 'Sneaky') $$,
  '42501', null, 'A cannot insert into B business'
);
select throws_ok(
  $$ insert into public.business_members (business_id, user_id) values ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, 'A cannot join B business'
);
select throws_ok(
  $$ insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty)
     values ('00000000-0000-4000-8000-0000000000a2', 'expense', current_date, 100, '00000000-0000-4000-8000-0000000000b3', 'X') $$,
  '23503', null, 'A cannot use a B category inside their own business'
);
select throws_ok(
  $$ update public.transactions set business_id = '00000000-0000-4000-8000-0000000000b2' where id = '00000000-0000-4000-8000-0000000000a7' $$,
  '42501', null, 'A cannot move a row into B business'
);
select lives_ok(
  $$ insert into public.categories (business_id, kind, name) values ('00000000-0000-4000-8000-0000000000a2', 'expense', 'Travel') $$,
  'A can add rows to their own business'
);

-- A request with no session uses the anon role, which has no table access.
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.transactions $$, '42501', null, 'anon cannot read transactions');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 6: Run the database tests to verify they fail**

```bash
npm run test:db
```

Expected: FAIL with `relation "public.businesses" does not exist`.

- [ ] **Step 7: Create the schema migration**

```bash
npx supabase migration new schema
```

Expected: `Created new migration at supabase/migrations/<timestamp>_schema.sql`. Put this SQL in that file:

```sql
-- Builders Finance schema. Every row belongs to a business; every policy checks
-- membership through private.is_business_member().

create schema if not exists private;

-- Businesses and members ----------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index businesses_created_by_idx on public.businesses (created_by);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_id_idx on public.business_members (user_id);

-- Reference data ------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  name text not null check (length(btrim(name)) between 1 and 60),
  unique (business_id, kind, name),
  unique (id, kind, business_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  unique (id, business_id)
);
create unique index clients_business_id_lower_name_key on public.clients (business_id, lower(name));

-- Invoices ------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id uuid not null,
  number text not null check (length(btrim(number)) between 1 and 30),
  issue_date date not null,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  paid_date date,
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (business_id, number),
  unique (id, business_id),
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete cascade,
  check (due_date >= issue_date),
  check ((status = 'paid') = (paid_date is not null)),
  check (paid_date is null or paid_date >= issue_date)
);
create index invoices_business_status_due_idx on public.invoices (business_id, status, due_date);
create index invoices_client_id_idx on public.invoices (client_id);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  description text not null check (length(btrim(description)) between 1 and 200),
  quantity numeric(10, 2) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  position integer not null default 0,
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete cascade
);
create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- Transactions --------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  date date not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  category_id uuid not null,
  counterparty text not null check (length(btrim(counterparty)) between 1 and 120),
  note text check (note is null or length(note) <= 500),
  invoice_id uuid unique,
  created_at timestamptz not null default now(),
  foreign key (category_id, kind, business_id) references public.categories (id, kind, business_id) on delete cascade,
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete cascade
);
create index transactions_business_date_idx on public.transactions (business_id, date);
create index transactions_category_id_idx on public.transactions (category_id);

-- Invoice totals are always calculated, never stored -----------------------

create view public.invoice_summaries with (security_invoker = true) as
select
  i.id,
  i.business_id,
  i.number,
  i.client_id,
  c.name as client_name,
  i.issue_date,
  i.due_date,
  i.status,
  i.paid_date,
  i.notes,
  coalesce(
    (select sum(round(it.quantity * it.unit_price_cents))::bigint
     from public.invoice_items it where it.invoice_id = i.id),
    0
  )::bigint as total_cents,
  case when i.status = 'sent' and i.due_date < current_date then 'overdue' else i.status end as display_status
from public.invoices i
join public.clients c on c.id = i.client_id;

-- Membership check used by every policy ------------------------------------

create function private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_business_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;

-- Row level security --------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.categories enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.transactions enable row level security;

create policy "Members and creators read the business" on public.businesses
  for select to authenticated
  using (private.is_business_member(id) or created_by = (select auth.uid()));
create policy "Users create businesses they own" on public.businesses
  for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "Members update the business" on public.businesses
  for update to authenticated
  using (private.is_business_member(id))
  with check (private.is_business_member(id));

create policy "Users read their own memberships" on public.business_members
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Creators add themselves as owner" on public.business_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (select 1 from public.businesses b where b.id = business_id and b.created_by = (select auth.uid()))
  );

create policy "Members manage categories" on public.categories
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members manage clients" on public.clients
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members manage invoices" on public.invoices
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members manage invoice items" on public.invoice_items
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members manage transactions" on public.transactions
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));

-- Data API access. New tables are not exposed automatically, so grant exactly
-- what the app needs to signed-in (including anonymous) users, and nothing to anon.

revoke all on public.businesses, public.business_members, public.categories, public.clients,
  public.invoices, public.invoice_items, public.transactions, public.invoice_summaries from anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.businesses to authenticated;
grant select, insert on public.business_members to authenticated;
grant select, insert, update, delete on public.categories, public.clients, public.invoices,
  public.invoice_items, public.transactions to authenticated;
grant select on public.invoice_summaries to authenticated;
```

- [ ] **Step 8: Apply the migration and run the database tests**

```bash
npm run db:reset
```

Expected: `Finished supabase db reset on branch main.`

```bash
npm run test:db
```

Expected: `All tests successful.` with 26 tests across both files.

- [ ] **Step 9: Run the database advisors**

```bash
npx supabase db advisors --local
```

Expected: no security findings. If a finding names a function `search_path` or an RLS gap, fix it in the migration, re-run `npm run db:reset` and `npm run test:db`. Performance notes about unused indexes on an empty database are fine to ignore.

- [ ] **Step 10: Commit**

```bash
git add supabase
git commit -m "Add database schema with row level security and pgTAP tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Database functions

**Files:**
- Create: `supabase/migrations/<timestamp>_functions.sql`
- Test: `supabase/tests/database/03_functions.test.sql`

**Interfaces:**
- Consumes: the Task 5 schema; the `SampleBusiness` JSON shape from Task 4 (camelCase keys).
- Produces (all `security invoker`, callable by `authenticated` only):
  - `public.create_business(p_name text) returns uuid`. Returns the caller's existing business if they already have one.
  - `public.load_sample_data(p_business_id uuid, p_data jsonb) returns void`. Errors: `not_a_member` (42501).
  - `public.create_invoice(p_business_id uuid, p_data jsonb) returns uuid`. `p_data`: `{ clientName, issueDate, dueDate, status: 'draft'|'sent', notes, items: [{ description, quantity, unitPriceCents }] }`. Errors: `not_a_member` (42501), `client_required`, `invoice_needs_items`, `invalid_status` (22023).
  - `public.mark_invoice_paid(p_invoice_id uuid, p_paid_date date) returns uuid` (the new transaction id). Errors: `invoice_not_found` (P0002), `invoice_already_paid`, `invoice_is_draft`, `paid_date_before_issue`, `paid_date_in_future`, `invoice_total_zero` (P0001).
  - Error messages are exactly these keys; Task 8 maps them to user copy.

- [ ] **Step 1: Write the failing function tests**

Create `supabase/tests/database/03_functions.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());

select set_config('test.payload', $json$
{
  "name": "Northfield Studio",
  "categories": [
    {"key": "client-payments", "kind": "income", "name": "Client payments"},
    {"key": "rent", "kind": "expense", "name": "Rent"},
    {"key": "software", "kind": "expense", "name": "Software"}
  ],
  "clients": [{"key": "northwind", "name": "Northwind Cafe", "email": "billing.northwind-cafe@example.com"}],
  "invoices": [
    {"key": "inv-paid", "number": "INV-1001", "clientKey": "northwind", "issueDate": "2026-09-01", "dueDate": "2026-09-16",
     "status": "paid", "paidDate": "2026-09-10", "notes": null,
     "items": [{"description": "Website design", "quantity": 1, "unitPriceCents": 250000},
               {"description": "Copywriting", "quantity": 2, "unitPriceCents": 40000}]},
    {"key": "inv-draft", "number": "INV-1002", "clientKey": "northwind", "issueDate": "2026-10-01", "dueDate": "2026-10-31",
     "status": "draft", "paidDate": null, "notes": null,
     "items": [{"description": "Brand strategy", "quantity": 1, "unitPriceCents": 150000}]}
  ],
  "transactions": [
    {"kind": "income", "date": "2026-09-10", "amountCents": 330000, "categoryKey": "client-payments",
     "counterparty": "Northwind Cafe", "note": "Payment for INV-1001", "invoiceKey": "inv-paid"},
    {"kind": "expense", "date": "2026-09-01", "amountCents": 320000, "categoryKey": "rent",
     "counterparty": "Harborview Properties", "note": "Studio rent", "invoiceKey": null}
  ]
}
$json$, true);

-- Visitor C ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

select set_config('test.biz_c', public.create_business('C Studio')::text, true);
select is(public.create_business('Another name'), current_setting('test.biz_c')::uuid, 'create_business returns the existing business on a second call');
select is((select count(*) from public.business_members), 1::bigint, 'C is a member of exactly one business');

select lives_ok($$ select public.load_sample_data(current_setting('test.biz_c')::uuid, current_setting('test.payload')::jsonb) $$, 'load_sample_data loads the payload');
select is((select count(*) from public.categories), 3::bigint, 'categories loaded');
select is((select count(*) from public.clients), 1::bigint, 'clients loaded');
select is((select count(*) from public.invoices), 2::bigint, 'invoices loaded');
select is((select count(*) from public.invoice_items), 3::bigint, 'invoice items loaded');
select is((select count(*) from public.transactions), 2::bigint, 'transactions loaded');
select is((select name from public.businesses), 'Northfield Studio', 'the business takes the payload name');
select ok((select invoice_id is not null from public.transactions where kind = 'income'), 'the payment links to its invoice');

select lives_ok($$ select public.load_sample_data(current_setting('test.biz_c')::uuid, current_setting('test.payload')::jsonb) $$, 'loading again works');
select is((select count(*) from public.transactions), 2::bigint, 'loading again replaces rows instead of duplicating them');

select set_config('test.inv_new', public.create_invoice(current_setting('test.biz_c')::uuid, $json$
  {"clientName": "  northwind CAFE ", "issueDate": "2026-10-01", "dueDate": "2026-10-31", "status": "sent", "notes": "",
   "items": [{"description": "Design", "quantity": 1.5, "unitPriceCents": 3333},
             {"description": "Hosting", "quantity": 1, "unitPriceCents": 10000}]}
$json$::jsonb)::text, true);
select is((select number from public.invoices where id = current_setting('test.inv_new')::uuid), 'INV-1003', 'a new invoice takes the next number');
select is((select count(*) from public.clients), 1::bigint, 'a typed name matching an existing client reuses it');
select is((select total_cents from public.invoice_summaries where id = current_setting('test.inv_new')::uuid), 15000::bigint, '1.5 x 33.33 + 100.00 totals 150.00');
select is((select notes from public.invoices where id = current_setting('test.inv_new')::uuid), null::text, 'blank notes are stored as null');

select throws_ok($$ select public.create_invoice(current_setting('test.biz_c')::uuid,
  '{"clientName": "X", "issueDate": "2026-10-01", "dueDate": "2026-10-31", "status": "draft", "items": []}'::jsonb) $$,
  '22023', 'invoice_needs_items', 'an invoice needs at least one item');
select throws_ok($$ select public.create_invoice(current_setting('test.biz_c')::uuid,
  '{"clientName": "X", "issueDate": "2026-10-01", "dueDate": "2026-10-31", "status": "paid", "items": [{"description": "A", "quantity": 1, "unitPriceCents": 100}]}'::jsonb) $$,
  '22023', 'invalid_status', 'new invoices are draft or sent only');

select set_config('test.tx', public.mark_invoice_paid(current_setting('test.inv_new')::uuid, current_date)::text, true);
select is((select amount_cents from public.transactions where id = current_setting('test.tx')::uuid), 15000::bigint, 'the payment equals the invoice total');
select is((select status from public.invoices where id = current_setting('test.inv_new')::uuid), 'paid', 'the invoice is now paid');
select throws_ok($$ select public.mark_invoice_paid(current_setting('test.inv_new')::uuid, current_date) $$,
  'P0001', 'invoice_already_paid', 'an invoice cannot be paid twice');
select throws_ok($$ select public.mark_invoice_paid((select id from public.invoices where number = 'INV-1002'), current_date) $$,
  'P0001', 'invoice_is_draft', 'a draft cannot be paid');

select set_config('test.inv_sent', public.create_invoice(current_setting('test.biz_c')::uuid, $json$
  {"clientName": "Harbor Books", "issueDate": "2026-10-01", "dueDate": "2026-10-31", "status": "sent",
   "items": [{"description": "Logo", "quantity": 1, "unitPriceCents": 90000}]}
$json$::jsonb)::text, true);
select throws_ok($$ select public.mark_invoice_paid(current_setting('test.inv_sent')::uuid, current_date + 1) $$,
  'P0001', 'paid_date_in_future', 'a payment date cannot be in the future');
select throws_ok($$ select public.mark_invoice_paid(current_setting('test.inv_sent')::uuid, '2026-09-30') $$,
  'P0001', 'paid_date_before_issue', 'a payment date cannot be before the issue date');

-- Visitor D cannot touch C's business ---------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select public.load_sample_data(current_setting('test.biz_c')::uuid, current_setting('test.payload')::jsonb) $$,
  '42501', 'not_a_member', 'D cannot load data into C business');
select throws_ok($$ select public.mark_invoice_paid(current_setting('test.inv_sent')::uuid, current_date) $$,
  'P0002', 'invoice_not_found', 'D cannot pay C invoices');

select set_config('test.biz_d', public.create_business('D Studio')::text, true);
select set_config('test.inv_d', public.create_invoice(current_setting('test.biz_d')::uuid, $json$
  {"clientName": "Grove Fitness", "issueDate": "2026-10-01", "dueDate": "2026-10-16", "status": "sent",
   "items": [{"description": "Photography session", "quantity": 1, "unitPriceCents": 50000}]}
$json$::jsonb)::text, true);
select lives_ok($$ select public.mark_invoice_paid(current_setting('test.inv_d')::uuid, current_date) $$, 'D pays their own invoice');
select is((select count(*) from public.categories where kind = 'income' and name = 'Client payments'), 1::bigint,
  'paying creates the Client payments category when it is missing');

-- No session: anon cannot call the functions.
reset role;
set local role anon;
select throws_ok($$ select public.create_business('Anon') $$, '42501', null, 'anon cannot call create_business');
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:db
```

Expected: `03_functions.test.sql` FAILS with `function public.create_business(unknown) does not exist`; files 01 and 02 still pass.

- [ ] **Step 3: Create the functions migration**

```bash
npx supabase migration new functions
```

Put this SQL in the new file:

```sql
-- Multi-row operations. All run as the caller (security invoker), so RLS still
-- applies; each checks membership first and runs as one transaction.

create function public.create_business(p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception using message = 'not_authenticated', errcode = '28000';
  end if;

  -- One business per visitor in version 1. A double click returns the same one.
  select m.business_id into v_id from public.business_members m where m.user_id = v_user limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.businesses (name, created_by) values (p_name, v_user) returning id into v_id;
  insert into public.business_members (business_id, user_id, role) values (v_id, v_user, 'owner');
  return v_id;
end;
$$;

create function public.load_sample_data(p_business_id uuid, p_data jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_categories jsonb;
  v_clients jsonb;
  v_invoices jsonb;
begin
  if not private.is_business_member(p_business_id) then
    raise exception using message = 'not_a_member', errcode = '42501';
  end if;

  delete from public.transactions where business_id = p_business_id;
  delete from public.invoices where business_id = p_business_id;
  delete from public.clients where business_id = p_business_id;
  delete from public.categories where business_id = p_business_id;

  update public.businesses set name = coalesce(p_data ->> 'name', name) where id = p_business_id;

  with src as materialized (
    select gen_random_uuid() as id, x.key, x.kind, x.name
    from jsonb_to_recordset(p_data -> 'categories') as x(key text, kind text, name text)
  ), ins as (
    insert into public.categories (id, business_id, kind, name)
    select id, p_business_id, kind, name from src
  )
  select coalesce(jsonb_object_agg(key, id), '{}'::jsonb) into v_categories from src;

  with src as materialized (
    select gen_random_uuid() as id, x.key, x.name, x.email
    from jsonb_to_recordset(p_data -> 'clients') as x(key text, name text, email text)
  ), ins as (
    insert into public.clients (id, business_id, name, email)
    select id, p_business_id, name, email from src
  )
  select coalesce(jsonb_object_agg(key, id), '{}'::jsonb) into v_clients from src;

  with src as materialized (
    select gen_random_uuid() as id, x.*
    from jsonb_to_recordset(p_data -> 'invoices') as x(
      key text, number text, "clientKey" text, "issueDate" date, "dueDate" date,
      status text, "paidDate" date, notes text, items jsonb
    )
  ), ins as (
    insert into public.invoices (id, business_id, client_id, number, issue_date, due_date, status, paid_date, notes)
    select id, p_business_id, (v_clients ->> "clientKey")::uuid, number, "issueDate", "dueDate", status, "paidDate", notes
    from src
  ), item_ins as (
    insert into public.invoice_items (invoice_id, business_id, description, quantity, unit_price_cents, position)
    select src.id, p_business_id, e.item ->> 'description', (e.item ->> 'quantity')::numeric,
           (e.item ->> 'unitPriceCents')::bigint, (e.ord - 1)::integer
    from src cross join lateral jsonb_array_elements(src.items) with ordinality as e(item, ord)
  )
  select coalesce(jsonb_object_agg(key, id), '{}'::jsonb) into v_invoices from src;

  insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty, note, invoice_id)
  select p_business_id, x.kind, x.date, x."amountCents", (v_categories ->> x."categoryKey")::uuid,
         x.counterparty, x.note, (v_invoices ->> x."invoiceKey")::uuid
  from jsonb_to_recordset(p_data -> 'transactions') as x(
    kind text, date date, "amountCents" bigint, "categoryKey" text, counterparty text, note text, "invoiceKey" text
  );
end;
$$;

create function public.create_invoice(p_business_id uuid, p_data jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client_name text := btrim(coalesce(p_data ->> 'clientName', ''));
  v_status text := coalesce(p_data ->> 'status', 'draft');
  v_client_id uuid;
  v_invoice_id uuid;
  v_next integer;
begin
  if not private.is_business_member(p_business_id) then
    raise exception using message = 'not_a_member', errcode = '42501';
  end if;
  if v_client_name = '' then
    raise exception using message = 'client_required', errcode = '22023';
  end if;
  if jsonb_typeof(p_data -> 'items') is distinct from 'array' or jsonb_array_length(p_data -> 'items') = 0 then
    raise exception using message = 'invoice_needs_items', errcode = '22023';
  end if;
  if v_status not in ('draft', 'sent') then
    raise exception using message = 'invalid_status', errcode = '22023';
  end if;

  -- Lock the business row so two invoices created at once get different numbers.
  perform 1 from public.businesses where id = p_business_id for update;

  select c.id into v_client_id
  from public.clients c
  where c.business_id = p_business_id and lower(c.name) = lower(v_client_name)
  limit 1;
  if v_client_id is null then
    insert into public.clients (business_id, name) values (p_business_id, v_client_name) returning id into v_client_id;
  end if;

  select coalesce(max(substring(i.number from '^INV-(\d+)$')::integer), 1000) + 1 into v_next
  from public.invoices i where i.business_id = p_business_id;

  insert into public.invoices (business_id, client_id, number, issue_date, due_date, status, notes)
  values (
    p_business_id, v_client_id, 'INV-' || v_next, (p_data ->> 'issueDate')::date, (p_data ->> 'dueDate')::date,
    v_status, nullif(btrim(coalesce(p_data ->> 'notes', '')), '')
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (invoice_id, business_id, description, quantity, unit_price_cents, position)
  select v_invoice_id, p_business_id, e.item ->> 'description', (e.item ->> 'quantity')::numeric,
         (e.item ->> 'unitPriceCents')::bigint, (e.ord - 1)::integer
  from jsonb_array_elements(p_data -> 'items') with ordinality as e(item, ord);

  return v_invoice_id;
end;
$$;

create function public.mark_invoice_paid(p_invoice_id uuid, p_paid_date date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice record;
  v_category_id uuid;
  v_total bigint;
  v_transaction_id uuid;
begin
  -- RLS hides other businesses' invoices, so a non-member gets "not found".
  select i.id, i.business_id, i.number, i.status, i.issue_date, c.name as client_name
  into v_invoice
  from public.invoices i
  join public.clients c on c.id = i.client_id
  where i.id = p_invoice_id
  for update of i;

  if not found then
    raise exception using message = 'invoice_not_found', errcode = 'P0002';
  end if;
  if v_invoice.status = 'paid' then
    raise exception using message = 'invoice_already_paid', errcode = 'P0001';
  end if;
  if v_invoice.status = 'draft' then
    raise exception using message = 'invoice_is_draft', errcode = 'P0001';
  end if;
  if p_paid_date > current_date then
    raise exception using message = 'paid_date_in_future', errcode = 'P0001';
  end if;
  if p_paid_date < v_invoice.issue_date then
    raise exception using message = 'paid_date_before_issue', errcode = 'P0001';
  end if;

  select coalesce(sum(round(it.quantity * it.unit_price_cents)), 0)::bigint into v_total
  from public.invoice_items it where it.invoice_id = p_invoice_id;
  if v_total <= 0 then
    raise exception using message = 'invoice_total_zero', errcode = 'P0001';
  end if;

  select id into v_category_id
  from public.categories
  where business_id = v_invoice.business_id and kind = 'income' and name = 'Client payments';
  if v_category_id is null then
    insert into public.categories (business_id, kind, name)
    values (v_invoice.business_id, 'income', 'Client payments')
    returning id into v_category_id;
  end if;

  update public.invoices set status = 'paid', paid_date = p_paid_date where id = p_invoice_id;

  insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty, note, invoice_id)
  values (v_invoice.business_id, 'income', p_paid_date, v_total, v_category_id, v_invoice.client_name,
          'Payment for ' || v_invoice.number, p_invoice_id)
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke execute on function public.create_business(text) from public, anon;
revoke execute on function public.load_sample_data(uuid, jsonb) from public, anon;
revoke execute on function public.create_invoice(uuid, jsonb) from public, anon;
revoke execute on function public.mark_invoice_paid(uuid, date) from public, anon;
grant execute on function public.create_business(text) to authenticated;
grant execute on function public.load_sample_data(uuid, jsonb) to authenticated;
grant execute on function public.create_invoice(uuid, jsonb) to authenticated;
grant execute on function public.mark_invoice_paid(uuid, date) to authenticated;
```

- [ ] **Step 4: Apply and test**

```bash
npm run db:reset
```

```bash
npm run test:db
```

Expected: `All tests successful.` (55 tests across three files).

- [ ] **Step 5: Run the advisors**

```bash
npx supabase db advisors --local
```

Expected: no security findings for the four functions.

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "Add database functions for sandbox setup, invoices, and payments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Nightly sandbox cleanup

**Files:**
- Create: `supabase/migrations/<timestamp>_cleanup.sql`
- Test: `supabase/tests/database/04_cleanup.test.sql`

**Interfaces:**
- Consumes: the Task 5 schema (cascades from `auth.users`).
- Produces: `private.delete_expired_sandboxes(p_max_age interval default '7 days') returns integer` and a `pg_cron` job named `delete-expired-sandboxes` on schedule `0 3 * * *`.

- [ ] **Step 1: Write the failing cleanup test**

Create `supabase/tests/database/04_cleanup.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true,  now() - interval '8 days', now()),
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true,  now() - interval '1 day', now()),
  ('00000000-0000-4000-8000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, now() - interval '30 days', now());
insert into public.businesses (id, name, created_by) values
  ('00000000-0000-4000-8000-0000000000e2', 'Old sandbox', '00000000-0000-4000-8000-0000000000e1'),
  ('00000000-0000-4000-8000-0000000000f2', 'New sandbox', '00000000-0000-4000-8000-0000000000f1'),
  ('00000000-0000-4000-8000-0000000000a8', 'Real account', '00000000-0000-4000-8000-0000000000a9');
insert into public.categories (business_id, kind, name)
values ('00000000-0000-4000-8000-0000000000e2', 'expense', 'Rent');

-- The local database may hold other old dev sandboxes, so expect at least one.
select ok(private.delete_expired_sandboxes() >= 1, 'deletes expired anonymous users');
select is_empty($$ select 1 from public.businesses where id = '00000000-0000-4000-8000-0000000000e2' $$, 'the expired sandbox business is gone');
select is_empty($$ select 1 from public.categories where business_id = '00000000-0000-4000-8000-0000000000e2' $$, 'its rows are gone');
select isnt_empty($$ select 1 from public.businesses where id = '00000000-0000-4000-8000-0000000000f2' $$, 'a recent sandbox stays');
select isnt_empty($$ select 1 from public.businesses where id = '00000000-0000-4000-8000-0000000000a8' $$, 'non-anonymous users are never deleted');
select isnt_empty(
  $$ select 1 from cron.job where jobname = 'delete-expired-sandboxes' and schedule = '0 3 * * *' $$,
  'the nightly job runs at 03:00 UTC'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:db
```

Expected: `04_cleanup.test.sql` FAILS with `function private.delete_expired_sandboxes() does not exist`.

- [ ] **Step 3: Create the cleanup migration**

```bash
npx supabase migration new cleanup
```

Put this SQL in the new file:

```sql
-- Deletes anonymous visitors older than 7 days. Cascades remove their business
-- and every row in it. Runs nightly inside Postgres through pg_cron.

create extension if not exists pg_cron with schema pg_catalog;

create function private.delete_expired_sandboxes(p_max_age interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from auth.users
  where is_anonymous
    and created_at < now() - p_max_age;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function private.delete_expired_sandboxes(interval) from public;

select cron.schedule(
  'delete-expired-sandboxes',
  '0 3 * * *',
  $$ select private.delete_expired_sandboxes(); $$
);
```

- [ ] **Step 4: Apply and test**

```bash
npm run db:reset
```

```bash
npm run test:db
```

Expected: `All tests successful.` (61 tests across four files).

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "Add nightly cleanup of expired demo sandboxes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Supabase wiring and data layer foundation

**Files:**
- Create: `lib/env.ts`, `lib/supabase/server.ts`, `proxy.ts`, `instrumentation.ts`
- Create: `lib/data/rows.ts`, `lib/data/fetch-all.ts`, `lib/data/sandbox-state.ts`, `lib/data/sandbox.ts`, `lib/data/errors.ts`
- Create: `scripts/setup-lib.ts`, `scripts/local-env.ts`
- Test: `lib/env.test.ts`, `lib/data/rows.test.ts`, `lib/data/fetch-all.test.ts`, `lib/data/sandbox-state.test.ts`, `lib/data/errors.test.ts`, `scripts/setup-lib.test.ts`

**Interfaces:**
- Consumes: `types.ts` (Task 2); database tables, view, and function error keys (Tasks 5 and 6).
- Produces:
  - `lib/env.ts`: `readEnv(source?): { supabaseUrl: string; supabasePublishableKey: string }`. Throws `Missing environment variables: ...`.
  - `lib/supabase/server.ts`: `createClient(): Promise<SupabaseClient>` (server only).
  - `lib/data/rows.ts`: column lists `TRANSACTION_COLUMNS`, `INVOICE_SUMMARY_COLUMNS`, `INVOICE_ITEM_COLUMNS`; row types `TransactionRow`, `CategoryRow`, `InvoiceSummaryRow`, `InvoiceItemRow`; mappers `toTransaction`, `toCategory`, `toInvoiceSummary`, `toInvoiceItem`.
  - `lib/data/fetch-all.ts`: `fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize?: number): Promise<T[]>`.
  - `lib/data/sandbox-state.ts`: `SandboxState`, `MembershipRow`, `resolveSandboxState(userId, membership): SandboxState`.
  - `lib/data/sandbox.ts`: `Sandbox = { kind: 'ready'; userId: string; businessId: string; businessName: string; supabase: SupabaseClient }`, `getSandboxState(supabase): Promise<SandboxState>`, `requireSandbox(): Promise<Sandbox>` (redirects to `/welcome` or `/welcome?expired=1`).
  - `lib/data/errors.ts`: `DbErrorLike`, `toUserMessage(error): string`, `isRateLimitError(error): boolean`, constants `GENERIC_SAVE_ERROR`, `SANDBOX_EXPIRED_MESSAGE`, `RATE_LIMIT_MESSAGE`.
  - `scripts/setup-lib.ts`: `buildEnvFile(url: string, key: string): string`.
  - npm script `env:local` writes `.env.local` for the local Supabase stack.

- [ ] **Step 1: Write failing tests for env, rows, paging, sandbox state, and errors**

Create `lib/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readEnv } from './env';

describe('readEnv', () => {
  it('returns both values when present', () => {
    expect(readEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabasePublishableKey: 'sb_publishable_x',
    });
  });
  it('lists every missing or blank variable', () => {
    expect(() => readEnv({ NEXT_PUBLIC_SUPABASE_URL: ' ', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })).toThrow(
      'Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  });
});
```

Create `lib/data/rows.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toInvoiceItem, toInvoiceSummary, toTransaction } from './rows';

describe('row mappers', () => {
  it('maps transactions to camelCase with numeric amounts', () => {
    expect(toTransaction({
      id: 't', kind: 'expense', date: '2026-10-01', amount_cents: '320000', category_id: 'c',
      counterparty: 'Harborview Properties', note: null, invoice_id: null,
    })).toEqual({ id: 't', kind: 'expense', date: '2026-10-01', amountCents: 320000, categoryId: 'c', counterparty: 'Harborview Properties', note: null, invoiceId: null });
  });
  it('maps invoice summaries and items, converting numeric strings', () => {
    expect(toInvoiceSummary({
      id: 'i', number: 'INV-1001', client_id: 'c', client_name: 'Northwind Cafe', issue_date: '2026-09-01',
      due_date: '2026-09-16', status: 'sent', paid_date: null, notes: null, total_cents: '15000',
    }).totalCents).toBe(15000);
    expect(toInvoiceItem({ id: 'x', description: 'Design', quantity: '1.50', unit_price_cents: 3333, position: 0 })).toEqual({
      id: 'x', description: 'Design', quantity: 1.5, unitPriceCents: 3333, position: 0,
    });
  });
});
```

Create `lib/data/fetch-all.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fetchAll } from './fetch-all';

function source(total: number) {
  const all = Array.from({ length: total }, (_, i) => i);
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: all.slice(from, to + 1), error: null };
  };
  return { page, calls };
}

describe('fetchAll', () => {
  it('keeps paging past the 1,000 row limit', async () => {
    const { page, calls } = source(2500);
    expect(await fetchAll(page)).toHaveLength(2500);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('makes one call when the first page is short', async () => {
    const { page, calls } = source(10);
    expect(await fetchAll(page)).toHaveLength(10);
    expect(calls).toHaveLength(1);
  });
  it('handles an exact multiple of the page size', async () => {
    const { page, calls } = source(2000);
    expect(await fetchAll(page)).toHaveLength(2000);
    expect(calls).toHaveLength(3);
  });
  it('throws the query error', async () => {
    const failure = { code: '42501', message: 'denied' };
    await expect(fetchAll(async () => ({ data: null, error: failure }))).rejects.toBe(failure);
  });
});
```

Create `lib/data/sandbox-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveSandboxState } from './sandbox-state';

describe('resolveSandboxState', () => {
  it('is none without a user', () => {
    expect(resolveSandboxState(null, null)).toEqual({ kind: 'none' });
    expect(resolveSandboxState(undefined, null)).toEqual({ kind: 'none' });
  });
  it('is expired when a valid token has no business, for example after cleanup deleted it', () => {
    expect(resolveSandboxState('u1', null)).toEqual({ kind: 'expired' });
    expect(resolveSandboxState('u1', { business_id: 'b1', businesses: null })).toEqual({ kind: 'expired' });
  });
  it('is ready with a business, whether the join returns an object or an array', () => {
    const ready = { kind: 'ready', userId: 'u1', businessId: 'b1', businessName: 'Northfield Studio' };
    expect(resolveSandboxState('u1', { business_id: 'b1', businesses: { name: 'Northfield Studio' } })).toEqual(ready);
    expect(resolveSandboxState('u1', { business_id: 'b1', businesses: [{ name: 'Northfield Studio' }] })).toEqual(ready);
  });
});
```

Create `lib/data/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GENERIC_SAVE_ERROR, isRateLimitError, RATE_LIMIT_MESSAGE, SANDBOX_EXPIRED_MESSAGE, toUserMessage } from './errors';

describe('toUserMessage', () => {
  it.each([
    [{ code: 'P0001', message: 'invoice_already_paid' }, 'This invoice is already paid.'],
    [{ code: 'P0001', message: 'invoice_is_draft' }, 'Mark this invoice sent before marking it paid.'],
    [{ code: 'P0001', message: 'paid_date_in_future' }, "The payment date can't be in the future."],
    [{ code: 'P0001', message: 'paid_date_before_issue' }, "The payment date can't be before the issue date."],
    [{ code: '22023', message: 'invoice_needs_items' }, 'Add at least one line item.'],
    [{ code: 'P0002', message: 'invoice_not_found' }, "We couldn't find that invoice."],
    [{ code: '42501', message: 'not_a_member' }, SANDBOX_EXPIRED_MESSAGE],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "invoices_business_id_number_key"' }, 'That invoice number is already used.'],
    [{ code: '23514', message: 'new row violates check constraint' }, "Some values aren't allowed. Check the form and try again."],
    [{ code: 'XX000', message: 'internal error with details' }, GENERIC_SAVE_ERROR],
    [{}, GENERIC_SAVE_ERROR],
  ])('maps %j', (error, message) => {
    expect(toUserMessage(error)).toBe(message);
  });
});

describe('isRateLimitError', () => {
  it('detects Supabase auth rate limits', () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ code: 'over_request_rate_limit' })).toBe(true);
    expect(isRateLimitError({ status: 400, code: 'validation_failed' })).toBe(false);
    expect(RATE_LIMIT_MESSAGE).toBe('Too many demo copies opened from your network. Try again in a few minutes.');
  });
});
```

Create `scripts/setup-lib.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildEnvFile } from './setup-lib';

describe('buildEnvFile', () => {
  it('writes both public variables and a do-not-commit header', () => {
    expect(buildEnvFile('http://127.0.0.1:54321', 'sb_publishable_abc')).toBe(
      '# Written by Builders Finance scripts. Never commit this file.\n' +
        'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_abc\n',
    );
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test
```

Expected: FAIL for the six new files with `Failed to resolve import`.

- [ ] **Step 3: Implement env, rows, paging, sandbox state, errors, and the env file builder**

Create `lib/env.ts`:

```ts
const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] as const;

export interface AppEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

// NEXT_PUBLIC_ variables must be referenced literally so Next.js can inline them.
export function readEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): AppEnv {
  const missing = REQUIRED.filter((name) => !source[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. ` +
        'Run `npm run setup` or see https://github.com/darkojanevski320-prog/builders-finance#setup',
    );
  }
  return {
    supabaseUrl: source.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    supabasePublishableKey: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
  };
}
```

Create `lib/data/rows.ts`:

```ts
import type { Category, InvoiceItem, InvoiceStatus, InvoiceSummary, Transaction, TransactionKind } from '@/lib/finance/types';

export const TRANSACTION_COLUMNS = 'id, kind, date, amount_cents, category_id, counterparty, note, invoice_id';
export const INVOICE_SUMMARY_COLUMNS = 'id, number, client_id, client_name, issue_date, due_date, status, paid_date, notes, total_cents';
export const INVOICE_ITEM_COLUMNS = 'id, description, quantity, unit_price_cents, position';

// Postgres bigint and numeric can arrive as strings, so every number goes through Number().
type Numeric = number | string;

export interface TransactionRow {
  id: string;
  kind: TransactionKind;
  date: string;
  amount_cents: Numeric;
  category_id: string;
  counterparty: string;
  note: string | null;
  invoice_id: string | null;
}

export interface CategoryRow {
  id: string;
  kind: TransactionKind;
  name: string;
}

export interface InvoiceSummaryRow {
  id: string;
  number: string;
  client_id: string;
  client_name: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  paid_date: string | null;
  notes: string | null;
  total_cents: Numeric;
}

export interface InvoiceItemRow {
  id: string;
  description: string;
  quantity: Numeric;
  unit_price_cents: Numeric;
  position: number;
}

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    kind: row.kind,
    date: row.date,
    amountCents: Number(row.amount_cents),
    categoryId: row.category_id,
    counterparty: row.counterparty,
    note: row.note,
    invoiceId: row.invoice_id,
  };
}

export function toCategory(row: CategoryRow): Category {
  return { id: row.id, kind: row.kind, name: row.name };
}

export function toInvoiceSummary(row: InvoiceSummaryRow): InvoiceSummary {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: row.client_name,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
    paidDate: row.paid_date,
    notes: row.notes,
    totalCents: Number(row.total_cents),
  };
}

export function toInvoiceItem(row: InvoiceItemRow): InvoiceItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPriceCents: Number(row.unit_price_cents),
    position: row.position,
  };
}
```

Create `lib/data/fetch-all.ts`:

```ts
/**
 * Supabase returns at most 1,000 rows per request by default. This keeps
 * requesting pages until a short page arrives, so totals never silently truncate.
 * The query passed in must have a stable order.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}
```

Create `lib/data/sandbox-state.ts`:

```ts
export type SandboxState =
  | { kind: 'none' }
  | { kind: 'expired' }
  | { kind: 'ready'; userId: string; businessId: string; businessName: string };

export interface MembershipRow {
  business_id: string;
  businesses: { name: string } | { name: string }[] | null;
}

/** A valid token without a business means the sandbox was cleaned up or never finished. */
export function resolveSandboxState(userId: string | null | undefined, membership: MembershipRow | null): SandboxState {
  if (!userId) return { kind: 'none' };
  if (!membership) return { kind: 'expired' };
  const business = Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses;
  if (!business) return { kind: 'expired' };
  return { kind: 'ready', userId, businessId: membership.business_id, businessName: business.name };
}
```

Create `lib/data/errors.ts`:

```ts
export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number;
}

export const GENERIC_SAVE_ERROR = "Couldn't save. Try again.";
export const SANDBOX_EXPIRED_MESSAGE = 'Your demo copy expired. Open a new one.';
export const RATE_LIMIT_MESSAGE = 'Too many demo copies opened from your network. Try again in a few minutes.';

// Keys raised by the database functions in supabase/migrations/*_functions.sql.
const BY_MESSAGE: Record<string, string> = {
  invoice_already_paid: 'This invoice is already paid.',
  invoice_is_draft: 'Mark this invoice sent before marking it paid.',
  paid_date_in_future: "The payment date can't be in the future.",
  paid_date_before_issue: "The payment date can't be before the issue date.",
  invoice_total_zero: 'This invoice has no amount to pay.',
  invoice_needs_items: 'Add at least one line item.',
  client_required: 'Enter a client name.',
  invalid_status: GENERIC_SAVE_ERROR,
  invoice_not_found: "We couldn't find that invoice.",
  not_a_member: SANDBOX_EXPIRED_MESSAGE,
  not_authenticated: SANDBOX_EXPIRED_MESSAGE,
};

export function toUserMessage(error: DbErrorLike): string {
  const message = error.message ?? '';
  if (BY_MESSAGE[message]) return BY_MESSAGE[message];
  if (error.code === '23505' && message.includes('invoices_business_id_number_key')) return 'That invoice number is already used.';
  if (error.code === '23514') return "Some values aren't allowed. Check the form and try again.";
  if (error.code === '42501') return SANDBOX_EXPIRED_MESSAGE;
  return GENERIC_SAVE_ERROR;
}

export function isRateLimitError(error: DbErrorLike): boolean {
  return error.status === 429 || error.code === 'over_request_rate_limit';
}
```

Create `scripts/setup-lib.ts`:

```ts
export function buildEnvFile(url: string, key: string): string {
  return (
    '# Written by Builders Finance scripts. Never commit this file.\n' +
    `NEXT_PUBLIC_SUPABASE_URL=${url}\n` +
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\n`
  );
}
```

- [ ] **Step 4: Run the unit tests**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 5: Add the server client, proxy, startup check, and sandbox helpers**

Create `lib/supabase/server.ts`:

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readEnv } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();
  const env = readEnv();
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
```

Create `proxy.ts` at the repo root:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { readEnv } from '@/lib/env';

// Refreshes the Supabase session cookie on every request (Next.js 16 calls this file proxy.ts).
export async function proxy(request: NextRequest) {
  const env = readEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims verifies the token and refreshes it when needed. Do not add code
  // between createServerClient and this call.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
```

Create `instrumentation.ts` at the repo root:

```ts
// Fails fast at server start with a clear list of missing settings.
export async function register() {
  const { readEnv } = await import('./lib/env');
  readEnv();
}
```

Create `lib/data/sandbox.ts`:

```ts
import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { resolveSandboxState, type MembershipRow, type SandboxState } from './sandbox-state';

export type Sandbox = Extract<SandboxState, { kind: 'ready' }> & { supabase: SupabaseClient };

export async function getSandboxState(supabase: SupabaseClient): Promise<SandboxState> {
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  const userId = typeof sub === 'string' ? sub : null;
  if (!userId) return resolveSandboxState(null, null);
  const { data: membership } = await supabase
    .from('business_members')
    .select('business_id, businesses(name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle<MembershipRow>();
  return resolveSandboxState(userId, membership ?? null);
}

/** Returns the visitor's sandbox or redirects to the welcome screen. Cached per request. */
export const requireSandbox = cache(async (): Promise<Sandbox> => {
  const supabase = await createClient();
  const state = await getSandboxState(supabase);
  if (state.kind === 'none') redirect('/welcome');
  if (state.kind === 'expired') redirect('/welcome?expired=1');
  return { ...state, supabase };
});
```

- [ ] **Step 6: Add the local env writer**

Create `scripts/local-env.ts`:

```ts
// Writes .env.local for the local Supabase stack started with `npm run db:start`.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { buildEnvFile } from './setup-lib';

let status: Record<string, string>;
try {
  status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch {
  console.error('Local Supabase is not running. Start Docker, then run `npm run db:start`.');
  process.exit(1);
}

const url = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!url || !key) {
  console.error('Could not read API_URL and PUBLISHABLE_KEY from `supabase status`.');
  process.exit(1);
}

if (existsSync('.env.local')) copyFileSync('.env.local', '.env.local.bak');
writeFileSync('.env.local', buildEnvFile(url, key));
console.log(`Wrote .env.local for local Supabase at ${url}.`);
```

Run it and check which key name the CLI printed:

```bash
npm run env:local
```

Expected: `Wrote .env.local for local Supabase at http://127.0.0.1:54321.` Then confirm the key type without printing it:

```bash
grep -c '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_' .env.local
```

Expected: `1`. If it prints `0`, the CLI returned only the legacy anon key; that still works locally, so continue.

- [ ] **Step 7: Typecheck, lint, and build**

```bash
npm run typecheck && npm run lint && npm run build
```

Expected: all succeed. The build output lists `ƒ Proxy (Middleware)` or `Proxy`.

- [ ] **Step 8: Commit**

```bash
git add lib proxy.ts instrumentation.ts scripts
git commit -m "Wire Supabase sessions, sandbox resolution, and data helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Validation, data operations, and server actions

**Files:**
- Create: `lib/validation/schemas.ts`, `lib/validation/form.ts`, `lib/actions/result.ts`
- Create: `lib/data/categories.ts`, `lib/data/clients.ts`, `lib/data/transactions.ts`, `lib/data/invoices.ts`, `lib/data/sample.ts`, `lib/data/dashboard.ts`
- Create: `app/(app)/actions.ts`
- Test: `lib/validation/schemas.test.ts`, `lib/validation/form.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 8.
- Produces:
  - `lib/actions/result.ts`: `ActionResult = { ok: true; message?: string } | { ok: false; message: string; fieldErrors?: Record<string, string> }`, `FormState = ActionResult | null`.
  - `lib/validation/schemas.ts`: `transactionSchema(today)` (input keys `kind, date, counterparty, categoryId, amount, note`; output `amount` in cents), `invoiceSchema()` (input `clientName, issueDate, dueDate, notes, status, items[{ description, quantity, unitPrice }]`; output `quantity` number and `unitPrice` cents), `markPaidSchema(today)` (`invoiceId, paidDate`), `invoiceIdSchema` (`invoiceId`).
  - `lib/validation/form.ts`: `formString(form, key): string`, `parseItemsJson(raw): unknown`, `fieldErrors(error): Record<string, string>`.
  - `lib/data/categories.ts`: `listCategories(supabase, kind?): Promise<Category[]>`.
  - `lib/data/clients.ts`: `listClientNames(supabase): Promise<string[]>`.
  - `lib/data/transactions.ts`: `listTransactions(supabase, range, kind?): Promise<Transaction[]>`, `addTransaction(sandbox, input: NewTransaction)`, `NewTransaction`.
  - `lib/data/invoices.ts`: `listInvoices(supabase, filters?: { issuedIn?: DateRange; status?: InvoiceStatus }): Promise<InvoiceSummary[]>`, `getInvoice(supabase, id): Promise<{ invoice: InvoiceSummary; items: InvoiceItem[] } | null>`, `createInvoice(sandbox, input: NewInvoice)`, `markInvoiceSent(supabase, id)`, `markInvoicePaid(supabase, id, paidDate)`, `NewInvoice`.
  - `lib/data/sample.ts`: `loadSampleData(supabase, businessId, today): Promise<{ error: DbErrorLike | null }>`.
  - `lib/data/dashboard.ts`: `getDashboard(supabase, range, today): Promise<DashboardData>` with `isEmpty, totals, series, byCategory, receivables, attention`.
  - `app/(app)/actions.ts`: `addTransactionAction`, `createInvoiceAction`, `markInvoiceSentAction`, `markInvoicePaidAction`, `resetSampleDataAction`, each `(prev: FormState, form: FormData) => Promise<ActionResult>`. Form field names: transactions `kind, date, counterparty, categoryId, amount, note`; invoices `clientName, issueDate, dueDate, notes, status, items` (JSON string); payments `invoiceId, paidDate`; sent `invoiceId`.

- [ ] **Step 1: Write failing validation tests**

Create `lib/validation/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { invoiceSchema, markPaidSchema, transactionSchema } from './schemas';
import { fieldErrors } from './form';

const today = '2026-10-15';
const categoryId = '3f8a1c2e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';

describe('transactionSchema', () => {
  const valid = { kind: 'expense', date: '2026-10-14', counterparty: ' Pixelboard ', categoryId, amount: '1,250.50', note: '' };

  it('parses a valid expense into cents and trims text', () => {
    const result = transactionSchema(today).parse(valid);
    expect(result).toEqual({ kind: 'expense', date: '2026-10-14', counterparty: 'Pixelboard', categoryId, amount: 125050, note: null });
  });

  it('reports a plain message for each bad field', () => {
    const result = transactionSchema(today).safeParse({ ...valid, date: '2026-10-16', counterparty: '', categoryId: 'x', amount: '0' });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)).toEqual({
      date: "Date can't be in the future",
      counterparty: 'Enter a name',
      categoryId: 'Choose a category',
      amount: 'Enter an amount above $0',
    });
  });

  it('rejects unparseable amounts and impossible dates', () => {
    const result = transactionSchema(today).safeParse({ ...valid, amount: '12.345', date: '2026-02-30' });
    expect(fieldErrors(result.error!)).toEqual({ amount: 'Enter an amount like 1,250.00', date: 'Enter a valid date' });
  });
});

describe('invoiceSchema', () => {
  const valid = {
    clientName: 'Northwind Cafe', issueDate: '2026-10-01', dueDate: '2026-10-31', notes: ' ', status: 'sent',
    items: [{ description: 'Design', quantity: '1.5', unitPrice: '33.33' }, { description: 'Hosting', quantity: '1', unitPrice: '100' }],
  };

  it('parses quantities and prices', () => {
    const result = invoiceSchema().parse(valid);
    expect(result.items).toEqual([
      { description: 'Design', quantity: 1.5, unitPrice: 3333 },
      { description: 'Hosting', quantity: 1, unitPrice: 10000 },
    ]);
    expect(result.notes).toBeNull();
  });

  it('rejects a due date before the issue date', () => {
    const result = invoiceSchema().safeParse({ ...valid, dueDate: '2026-09-30' });
    expect(fieldErrors(result.error!)).toEqual({ dueDate: "Due date can't be before the issue date" });
  });

  it('requires items with valid values and a total above zero', () => {
    expect(fieldErrors(invoiceSchema().safeParse({ ...valid, items: [] }).error!)).toEqual({ items: 'Add at least one line item' });
    // toMatchObject: Zod may also add a total error once item values fail; the item messages are what matter here.
    expect(fieldErrors(invoiceSchema().safeParse({ ...valid, items: [{ description: '', quantity: '0', unitPrice: 'x' }] }).error!)).toMatchObject({
      'items.0.description': 'Describe the item',
      'items.0.quantity': 'Enter a quantity like 1 or 1.5',
      'items.0.unitPrice': 'Enter a price like 250.00',
    });
    expect(fieldErrors(invoiceSchema().safeParse({ ...valid, items: [{ description: 'Free', quantity: '1', unitPrice: '0' }] }).error!)).toEqual({
      items: 'The invoice total must be above $0',
    });
  });

  it('only allows draft or sent', () => {
    expect(invoiceSchema().safeParse({ ...valid, status: 'paid' }).success).toBe(false);
  });
});

describe('markPaidSchema', () => {
  it('accepts today and rejects future dates and bad ids', () => {
    expect(markPaidSchema(today).safeParse({ invoiceId: categoryId, paidDate: today }).success).toBe(true);
    expect(fieldErrors(markPaidSchema(today).safeParse({ invoiceId: 'nope', paidDate: '2026-10-16' }).error!)).toEqual({
      invoiceId: "We couldn't find that invoice.",
      paidDate: "The payment date can't be in the future",
    });
  });
});
```

Create `lib/validation/form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formString, parseItemsJson } from './form';

describe('form helpers', () => {
  it('reads strings and ignores files or missing keys', () => {
    const form = new FormData();
    form.set('name', 'Pixelboard');
    form.set('file', new Blob(['x']));
    expect(formString(form, 'name')).toBe('Pixelboard');
    expect(formString(form, 'file')).toBe('');
    expect(formString(form, 'missing')).toBe('');
  });
  it('parses item JSON and falls back to an empty list', () => {
    expect(parseItemsJson('[{"description":"A"}]')).toEqual([{ description: 'A' }]);
    expect(parseItemsJson('not json')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run lib/validation
```

Expected: FAIL, `Failed to resolve import "./schemas"`.

- [ ] **Step 3: Implement validation and the action result type**

Create `lib/actions/result.ts`:

```ts
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export type FormState = ActionResult | null;
```

Create `lib/validation/form.ts`:

```ts
import type { ZodError } from 'zod';

export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

export function parseItemsJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** First message per field, keyed by dotted path, for example `items.0.quantity`. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
```

Create `lib/validation/schemas.ts`:

```ts
import { z } from 'zod';
import { isValidISODate } from '@/lib/finance/dates';
import { invoiceTotalCents, parseMoneyToCents, parseQuantity } from '@/lib/finance/money';

const isoDate = (message: string) => z.string().trim().refine(isValidISODate, message);

const cents = (message: string) =>
  z.string().transform((value, ctx) => {
    const parsed = parseMoneyToCents(value);
    if (parsed === null) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return parsed;
  });

const optionalText = z
  .string()
  .trim()
  .max(500, 'Use 500 characters or fewer')
  .transform((value) => value || null);

export function transactionSchema(today: string) {
  return z.object({
    kind: z.enum(['income', 'expense']),
    date: isoDate('Enter a valid date').refine((date) => date <= today, "Date can't be in the future"),
    counterparty: z.string().trim().min(1, 'Enter a name').max(120, 'Use 120 characters or fewer'),
    categoryId: z.uuid('Choose a category'),
    amount: cents('Enter an amount like 1,250.00').refine((value) => value > 0, 'Enter an amount above $0'),
    note: optionalText,
  });
}

const itemSchema = z.object({
  description: z.string().trim().min(1, 'Describe the item').max(200, 'Use 200 characters or fewer'),
  quantity: z.string().transform((value, ctx) => {
    const parsed = parseQuantity(value);
    if (parsed === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter a quantity like 1 or 1.5' });
      return z.NEVER;
    }
    return parsed;
  }),
  unitPrice: cents('Enter a price like 250.00'),
});

export function invoiceSchema() {
  return z
    .object({
      clientName: z.string().trim().min(1, 'Enter a client name').max(120, 'Use 120 characters or fewer'),
      issueDate: isoDate('Enter a valid issue date'),
      dueDate: isoDate('Enter a valid due date'),
      notes: optionalText,
      status: z.enum(['draft', 'sent']),
      items: z.array(itemSchema).min(1, 'Add at least one line item').max(20, 'Use 20 line items or fewer'),
    })
    .refine((v) => v.dueDate >= v.issueDate, { path: ['dueDate'], message: "Due date can't be before the issue date" })
    .refine(
      (v) => invoiceTotalCents(v.items.map((i) => ({ quantity: i.quantity, unitPriceCents: i.unitPrice }))) > 0,
      { path: ['items'], message: 'The invoice total must be above $0' },
    );
}

export const invoiceIdSchema = z.object({ invoiceId: z.uuid("We couldn't find that invoice.") });

export function markPaidSchema(today: string) {
  return z.object({
    invoiceId: z.uuid("We couldn't find that invoice."),
    paidDate: isoDate('Enter a valid payment date').refine((date) => date <= today, "The payment date can't be in the future"),
  });
}
```

- [ ] **Step 4: Run the validation tests**

```bash
npx vitest run lib/validation
```

Expected: PASS. `fieldErrors` keeps only the first message per field, so a field that fails two checks shows the earlier, more specific message.

- [ ] **Step 5: Implement the data operations**

Create `lib/data/categories.ts`:

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, TransactionKind } from '@/lib/finance/types';
import { toCategory, type CategoryRow } from './rows';

export async function listCategories(supabase: SupabaseClient, kind?: TransactionKind): Promise<Category[]> {
  let query = supabase.from('categories').select('id, kind, name');
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query.order('name');
  if (error) throw error;
  return (data as CategoryRow[]).map(toCategory);
}
```

Create `lib/data/clients.ts`:

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function listClientNames(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('clients').select('name').order('name');
  if (error) throw error;
  return (data as { name: string }[]).map((row) => row.name);
}
```

Create `lib/data/transactions.ts`:

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DateRange, Transaction, TransactionKind } from '@/lib/finance/types';
import { fetchAll } from './fetch-all';
import { TRANSACTION_COLUMNS, toTransaction, type TransactionRow } from './rows';
import type { Sandbox } from './sandbox';

export interface NewTransaction {
  kind: TransactionKind;
  date: string;
  amountCents: number;
  categoryId: string;
  counterparty: string;
  note: string | null;
}

export async function listTransactions(supabase: SupabaseClient, range: DateRange, kind?: TransactionKind): Promise<Transaction[]> {
  const rows = await fetchAll<TransactionRow>((from, to) => {
    let query = supabase.from('transactions').select(TRANSACTION_COLUMNS).gte('date', range.from).lte('date', range.to);
    if (kind) query = query.eq('kind', kind);
    return query.order('date', { ascending: false }).order('id').range(from, to);
  });
  return rows.map(toTransaction);
}

export function addTransaction(sandbox: Sandbox, input: NewTransaction) {
  return sandbox.supabase.from('transactions').insert({
    business_id: sandbox.businessId,
    kind: input.kind,
    date: input.date,
    amount_cents: input.amountCents,
    category_id: input.categoryId,
    counterparty: input.counterparty,
    note: input.note,
  });
}
```

Create `lib/data/invoices.ts`:

```ts
import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DateRange, InvoiceItem, InvoiceStatus, InvoiceSummary } from '@/lib/finance/types';
import { fetchAll } from './fetch-all';
import {
  INVOICE_ITEM_COLUMNS, INVOICE_SUMMARY_COLUMNS, toInvoiceItem, toInvoiceSummary,
  type InvoiceItemRow, type InvoiceSummaryRow,
} from './rows';
import type { Sandbox } from './sandbox';

export interface NewInvoice {
  clientName: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent';
  notes: string | null;
  items: { description: string; quantity: number; unitPriceCents: number }[];
}

export async function listInvoices(
  supabase: SupabaseClient,
  filters: { issuedIn?: DateRange; status?: InvoiceStatus } = {},
): Promise<InvoiceSummary[]> {
  const rows = await fetchAll<InvoiceSummaryRow>((from, to) => {
    let query = supabase.from('invoice_summaries').select(INVOICE_SUMMARY_COLUMNS);
    if (filters.issuedIn) query = query.gte('issue_date', filters.issuedIn.from).lte('issue_date', filters.issuedIn.to);
    if (filters.status) query = query.eq('status', filters.status);
    return query.order('issue_date', { ascending: false }).order('number', { ascending: false }).range(from, to);
  });
  return rows.map(toInvoiceSummary);
}

export async function getInvoice(
  supabase: SupabaseClient,
  id: string,
): Promise<{ invoice: InvoiceSummary; items: InvoiceItem[] } | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [invoiceResult, itemsResult] = await Promise.all([
    supabase.from('invoice_summaries').select(INVOICE_SUMMARY_COLUMNS).eq('id', id).maybeSingle<InvoiceSummaryRow>(),
    supabase.from('invoice_items').select(INVOICE_ITEM_COLUMNS).eq('invoice_id', id).order('position'),
  ]);
  if (invoiceResult.error) throw invoiceResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (!invoiceResult.data) return null;
  return {
    invoice: toInvoiceSummary(invoiceResult.data),
    items: (itemsResult.data as InvoiceItemRow[]).map(toInvoiceItem),
  };
}

export function createInvoice(sandbox: Sandbox, input: NewInvoice) {
  return sandbox.supabase.rpc('create_invoice', {
    p_business_id: sandbox.businessId,
    p_data: {
      clientName: input.clientName,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: input.status,
      notes: input.notes,
      items: input.items,
    },
  });
}

export function markInvoiceSent(supabase: SupabaseClient, id: string) {
  return supabase.from('invoices').update({ status: 'sent' }).eq('id', id).eq('status', 'draft').select('id');
}

export function markInvoicePaid(supabase: SupabaseClient, id: string, paidDate: string) {
  return supabase.rpc('mark_invoice_paid', { p_invoice_id: id, p_paid_date: paidDate });
}
```

Create `lib/data/sample.ts`:

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSampleBusiness } from '@/lib/sample-data/generate';
import type { DbErrorLike } from './errors';

/** Replaces everything in the business with freshly generated sample data, in one transaction. */
export async function loadSampleData(
  supabase: SupabaseClient,
  businessId: string,
  today: string,
): Promise<{ error: DbErrorLike | null }> {
  const { error } = await supabase.rpc('load_sample_data', {
    p_business_id: businessId,
    p_data: generateSampleBusiness({ today }),
  });
  return { error };
}
```

Create `lib/data/dashboard.ts`:

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { expensesByCategory, monthlySeries, needsAttention, receivables, totals } from '@/lib/finance/summary';
import type { DateRange } from '@/lib/finance/types';
import { listCategories } from './categories';
import { listInvoices } from './invoices';
import { listTransactions } from './transactions';

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard(supabase: SupabaseClient, range: DateRange, today: string) {
  const [transactions, categories, openInvoices] = await Promise.all([
    listTransactions(supabase, range),
    listCategories(supabase),
    listInvoices(supabase, { status: 'sent' }),
  ]);
  return {
    isEmpty: categories.length === 0,
    totals: totals(transactions),
    series: monthlySeries(transactions, range),
    byCategory: expensesByCategory(transactions, categories),
    receivables: receivables(openInvoices, today),
    attention: needsAttention(openInvoices, today),
  };
}
```

- [ ] **Step 6: Implement the server actions**

Create `app/(app)/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionResult, FormState } from '@/lib/actions/result';
import { toUserMessage, type DbErrorLike } from '@/lib/data/errors';
import { createInvoice, markInvoicePaid, markInvoiceSent } from '@/lib/data/invoices';
import { requireSandbox } from '@/lib/data/sandbox';
import { loadSampleData } from '@/lib/data/sample';
import { addTransaction } from '@/lib/data/transactions';
import { todayISO } from '@/lib/finance/dates';
import { fieldErrors, formString, parseItemsJson } from '@/lib/validation/form';
import { invoiceIdSchema, invoiceSchema, markPaidSchema, transactionSchema } from '@/lib/validation/schemas';

const CHECK_FIELDS = 'Check the highlighted fields.';

function failure(error: DbErrorLike, action: string): ActionResult {
  // Log the code for debugging; never show raw database errors to visitors.
  console.error(`[${action}] failed`, { code: error.code, message: error.message });
  return { ok: false, message: toUserMessage(error) };
}

export async function addTransactionAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const parsed = transactionSchema(todayISO()).safeParse({
    kind: formString(form, 'kind'),
    date: formString(form, 'date'),
    counterparty: formString(form, 'counterparty'),
    categoryId: formString(form, 'categoryId'),
    amount: formString(form, 'amount'),
    note: formString(form, 'note'),
  });
  if (!parsed.success) return { ok: false, message: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };

  const { kind, date, counterparty, categoryId, amount, note } = parsed.data;
  const { error } = await addTransaction(sandbox, { kind, date, counterparty, categoryId, amountCents: amount, note });
  if (error) return failure(error, 'addTransaction');

  revalidatePath('/', 'layout');
  return { ok: true, message: kind === 'income' ? 'Income added' : 'Expense added' };
}

export async function createInvoiceAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const parsed = invoiceSchema().safeParse({
    clientName: formString(form, 'clientName'),
    issueDate: formString(form, 'issueDate'),
    dueDate: formString(form, 'dueDate'),
    notes: formString(form, 'notes'),
    status: formString(form, 'status'),
    items: parseItemsJson(formString(form, 'items')),
  });
  if (!parsed.success) return { ok: false, message: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };

  const { data: invoiceId, error } = await createInvoice(sandbox, {
    ...parsed.data,
    items: parsed.data.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPriceCents: i.unitPrice })),
  });
  if (error) return failure(error, 'createInvoice');

  revalidatePath('/', 'layout');
  redirect(`/invoices/${invoiceId}`);
}

export async function markInvoiceSentAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const parsed = invoiceIdSchema.safeParse({ invoiceId: formString(form, 'invoiceId') });
  if (!parsed.success) return { ok: false, message: "We couldn't find that invoice." };

  const { data, error } = await markInvoiceSent(sandbox.supabase, parsed.data.invoiceId);
  if (error) return failure(error, 'markInvoiceSent');
  if (!data || data.length === 0) return { ok: false, message: 'Only draft invoices can be marked sent.' };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Invoice marked sent' };
}

export async function markInvoicePaidAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const parsed = markPaidSchema(todayISO()).safeParse({
    invoiceId: formString(form, 'invoiceId'),
    paidDate: formString(form, 'paidDate'),
  });
  if (!parsed.success) return { ok: false, message: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };

  const { error } = await markInvoicePaid(sandbox.supabase, parsed.data.invoiceId, parsed.data.paidDate);
  if (error) return failure(error, 'markInvoicePaid');

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Invoice marked paid' };
}

export async function resetSampleDataAction(_prev: FormState, _form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const { error } = await loadSampleData(sandbox.supabase, sandbox.businessId, todayISO());
  if (error) return failure(error, 'resetSampleData');

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Sample data restored' };
}
```

- [ ] **Step 7: Run unit tests, typecheck, and lint**

```bash
npm test && npm run typecheck && npm run lint
```

Expected: all succeed.

- [ ] **Step 8: Commit**

```bash
git add lib app
git commit -m "Add validation, data operations, and server actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Welcome flow and app shell

**Files:**
- Create: shadcn/ui components in `components/ui/` (generated), `components/ui/native-select.tsx`, `components/ui/field.tsx`
- Create: `lib/finance/format.ts`, `lib/finance/range-query.ts`
- Create: `app/welcome/page.tsx`, `app/welcome/start-form.tsx`, `app/welcome/actions.ts`
- Create: `app/(app)/layout.tsx`, `app/(app)/page.tsx` (temporary), `app/(app)/error.tsx`, `app/(app)/loading.tsx`
- Create: `components/shell/sidebar.tsx`, `components/shell/top-bar.tsx`, `components/shell/date-range-picker.tsx`, `components/shell/reset-button.tsx`, `components/shell/page-header.tsx`
- Modify: `app/layout.tsx`
- Delete: `app/page.tsx` (scaffold home page; conflicts with `app/(app)/page.tsx`)
- Test: `lib/finance/format.test.ts`, `lib/finance/range-query.test.ts`

**Interfaces:**
- Consumes: `requireSandbox`, `getSandboxState`, `loadSampleData`, `resetSampleDataAction`, `isRateLimitError`, `RATE_LIMIT_MESSAGE`, `SAMPLE_BUSINESS_NAME`, `presetRange`, `parseRangeParams`, `matchPreset`, `RANGE_PRESETS`.
- Produces:
  - `formatDisplayDate(iso: string): string` (for example `Oct 15, 2026`), `withRange(path: string, range: DateRange, extra?: Record<string, string | undefined>): string`.
  - `NativeSelect` (styled `<select>`), `Field({ label, error, children })` (wrapping `<label>` with an error line).
  - `PageHeader({ title, actions? })`.
  - Route `/welcome` with button **Open your demo copy**; every `(app)` route requires a sandbox.

- [ ] **Step 1: Add shadcn/ui and its components**

```bash
npx shadcn@4.21.5 init --yes --defaults
```

If the flags are rejected, run `npx shadcn@4.21.5 init --help` and use the flags that accept defaults non-interactively (style default, base color neutral, CSS variables on). Then:

```bash
npx shadcn@4.21.5 add --yes button card table sheet alert-dialog input label badge sonner textarea
```

Expected: files under `components/ui/` and `lib/utils.ts` with a `cn` helper. Re-pin any new dependency versions in `package.json` to exact versions and run `npm install`.

- [ ] **Step 2: Write failing tests for date display and range links**

Create `lib/finance/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDisplayDate } from './format';

describe('formatDisplayDate', () => {
  it('shows the stored calendar date regardless of the local time zone', () => {
    expect(formatDisplayDate('2026-10-15')).toBe('Oct 15, 2026');
    expect(formatDisplayDate('2027-01-01')).toBe('Jan 1, 2027');
  });
});
```

Create `lib/finance/range-query.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { withRange } from './range-query';

describe('withRange', () => {
  it('keeps the range and adds only non-empty extras', () => {
    const range = { from: '2026-01-01', to: '2026-03-31' };
    expect(withRange('/expenses', range)).toBe('/expenses?from=2026-01-01&to=2026-03-31');
    expect(withRange('/invoices', range, { status: 'overdue', q: undefined, vendor: '' })).toBe(
      '/invoices?from=2026-01-01&to=2026-03-31&status=overdue',
    );
  });
});
```

- [ ] **Step 3: Run to verify they fail**

```bash
npx vitest run lib/finance/format.test.ts lib/finance/range-query.test.ts
```

Expected: FAIL, `Failed to resolve import`.

- [ ] **Step 4: Implement both helpers**

Create `lib/finance/format.ts`:

```ts
import { toUTCDate } from './dates';

const displayDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function formatDisplayDate(iso: string): string {
  return displayDate.format(toUTCDate(iso));
}
```

Create `lib/finance/range-query.ts`:

```ts
import type { DateRange } from './types';

/** Builds a link that keeps the selected date range, for example `/expenses?from=...&to=...`. */
export function withRange(path: string, range: DateRange, extra: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  for (const [key, value] of Object.entries(extra)) {
    if (value) query.set(key, value);
  }
  return `${path}?${query.toString()}`;
}
```

```bash
npx vitest run lib/finance
```

Expected: PASS.

- [ ] **Step 5: Add the shared form primitives**

Create `components/ui/native-select.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** A styled native <select>: accessible, works without JavaScript, and fine for short lists. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
```

Create `components/ui/field.tsx`:

```tsx
import type { ReactNode } from 'react';

/** Label wrapping its control, with an optional error line underneath. */
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error ? <span className="text-sm font-normal text-destructive">{error}</span> : null}
    </label>
  );
}
```

- [ ] **Step 6: Build the welcome screen and start action**

Create `app/welcome/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import type { ActionResult, FormState } from '@/lib/actions/result';
import { isRateLimitError, RATE_LIMIT_MESSAGE } from '@/lib/data/errors';
import { getSandboxState } from '@/lib/data/sandbox';
import { loadSampleData } from '@/lib/data/sample';
import { todayISO } from '@/lib/finance/dates';
import { SAMPLE_BUSINESS_NAME } from '@/lib/sample-data/generate';
import { createClient } from '@/lib/supabase/server';

const START_FAILED = "Couldn't open your demo copy. Try again.";

export async function startDemo(_prev: FormState, _form: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const state = await getSandboxState(supabase);
  if (state.kind === 'ready') redirect('/');

  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    console.error('[startDemo] sign-in failed', { code: signInError.code, status: signInError.status });
    return { ok: false, message: isRateLimitError(signInError) ? RATE_LIMIT_MESSAGE : START_FAILED };
  }

  const { data: businessId, error: createError } = await supabase.rpc('create_business', { p_name: SAMPLE_BUSINESS_NAME });
  if (createError || !businessId) {
    console.error('[startDemo] create_business failed', { code: createError?.code });
    return { ok: false, message: START_FAILED };
  }

  // A failed load leaves an empty business; the dashboard then offers "Load sample data".
  const { error: loadError } = await loadSampleData(supabase, businessId, todayISO());
  if (loadError) console.error('[startDemo] load_sample_data failed', { code: loadError.code });

  redirect('/');
}
```

Create `app/welcome/start-form.tsx`:

```tsx
'use client';

import { Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { startDemo } from './actions';

export function StartForm() {
  const [state, action, pending] = useActionState(startDemo, null);
  return (
    <form action={action} className="grid gap-3">
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Open your demo copy
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
```

Create `app/welcome/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getSandboxState } from '@/lib/data/sandbox';
import { createClient } from '@/lib/supabase/server';
import { StartForm } from './start-form';

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const supabase = await createClient();
  if ((await getSandboxState(supabase)).kind === 'ready') redirect('/');
  const { expired } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Builders Finance</p>
        <h1 className="text-3xl font-semibold tracking-tight">See where your money goes</h1>
        <p className="text-muted-foreground">
          Income, expenses, and unpaid invoices for a sample small business, on one dashboard. You get your own private
          copy to edit. Nothing you do affects anyone else.
        </p>
      </div>
      {expired === '1' ? (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Your demo copy expired. Open a new one.
        </p>
      ) : null}
      <StartForm />
      <p className="text-xs text-muted-foreground">All data is made up. Demo copies are deleted after 7 days.</p>
    </main>
  );
}
```

- [ ] **Step 7: Build the shell**

Create `components/shell/page-header.tsx`:

```tsx
import type { ReactNode } from 'react';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {actions}
    </div>
  );
}
```

Create `components/shell/sidebar.tsx`:

```tsx
'use client';

import { ArrowDownLeft, ArrowUpRight, FileText, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/income', label: 'Income', icon: ArrowDownLeft },
  { href: '/expenses', label: 'Expenses', icon: ArrowUpRight },
  { href: '/invoices', label: 'Invoices', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const range = new URLSearchParams();
  for (const key of ['from', 'to']) {
    const value = params.get(key);
    if (value) range.set(key, value);
  }
  const suffix = range.toString() ? `?${range.toString()}` : '';

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={`${href}${suffix}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
              active && 'bg-muted font-medium text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

Create `components/shell/date-range-picker.tsx`:

```tsx
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { matchPreset, parseRangeParams, presetRange, RANGE_PRESETS, type RangePreset } from '@/lib/finance/date-range';
import type { DateRange } from '@/lib/finance/types';

export function DateRangePicker({ today }: { today: string }) {
  const params = useSearchParams();
  const range = parseRangeParams({ from: params.get('from') ?? undefined, to: params.get('to') ?? undefined }, today);
  // Remount when the URL range changes so the custom inputs start from the current range.
  return <RangeControls key={`${range.from}:${range.to}`} range={range} today={today} />;
}

function RangeControls({ range, today }: { range: DateRange; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const preset = matchPreset(range, today);
  const [showCustom, setShowCustom] = useState(preset === 'custom');
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  function go(next: DateRange) {
    const query = new URLSearchParams(params.toString());
    query.set('from', next.from);
    query.set('to', next.to);
    router.push(`${pathname}?${query.toString()}`);
  }

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (from && to && from <= to) go({ from, to });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Date range</span>
        <NativeSelect
          value={showCustom ? 'custom' : preset}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'custom') {
              setShowCustom(true);
              return;
            }
            setShowCustom(false);
            go(presetRange(value as RangePreset, today));
          }}
          className="w-44"
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom range</option>
        </NativeSelect>
      </label>
      {showCustom ? (
        <form onSubmit={applyCustom} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <Input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">To</span>
            <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
          <Button type="submit" variant="secondary">Apply</Button>
          {from > to ? <p className="w-full text-sm text-destructive">The start date must be before the end date.</p> : null}
        </form>
      ) : null}
    </div>
  );
}
```

Create `components/shell/reset-button.tsx`:

```tsx
'use client';

import { Loader2, RotateCcw } from 'lucide-react';
import { useActionState, useState } from 'react';
import { toast } from 'sonner';
import { resetSampleDataAction } from '@/app/(app)/actions';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { FormState } from '@/lib/actions/result';

export function ResetButton() {
  const [open, setOpen] = useState(false);
  const [, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await resetSampleDataAction(prev, form);
    if (result.ok) {
      toast.success(result.message ?? 'Sample data restored');
      setOpen(false);
    } else {
      toast.error(result.message);
    }
    return result;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw aria-hidden />
          Reset sample data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset sample data?</AlertDialogTitle>
          <AlertDialogDescription>
            This replaces everything in your demo copy, including your edits, with fresh sample data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={action}>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Reset
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Create `components/shell/top-bar.tsx`:

```tsx
import { Suspense } from 'react';
import { DateRangePicker } from './date-range-picker';
import { ResetButton } from './reset-button';

export function TopBar({ today }: { today: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3 md:px-6">
      <Suspense fallback={null}>
        <DateRangePicker today={today} />
      </Suspense>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>This is your private demo copy</span>
        <ResetButton />
      </div>
    </header>
  );
}
```

Create `app/(app)/layout.tsx`:

```tsx
import { Suspense, type ReactNode } from 'react';
import { Sidebar } from '@/components/shell/sidebar';
import { TopBar } from '@/components/shell/top-bar';
import { requireSandbox } from '@/lib/data/sandbox';
import { todayISO } from '@/lib/finance/dates';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sandbox = await requireSandbox();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b bg-muted/30 p-4 md:border-r md:border-b-0">
        <p className="font-semibold">Builders Finance</p>
        <p className="mb-4 text-sm text-muted-foreground">{sandbox.businessName}</p>
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-col">
        <TopBar today={todayISO()} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

Create `app/(app)/error.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">This screen couldn&apos;t load. Your data is safe.</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
```

Create `app/(app)/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Loading…
    </p>
  );
}
```

Create a temporary `app/(app)/page.tsx` (Task 11 replaces it):

```tsx
import { requireSandbox } from '@/lib/data/sandbox';

export default async function DashboardPage() {
  const sandbox = await requireSandbox();
  return <h1 className="text-2xl font-semibold">{sandbox.businessName}</h1>;
}
```

- [ ] **Step 8: Update the root layout and remove the scaffold home page**

```bash
git rm app/page.tsx
```

In `app/layout.tsx`, set the metadata and render the toast container inside `<body>` after `{children}`:

```tsx
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Builders Finance',
  description: 'A finance dashboard demo for small business owners: income, expenses, and invoices.',
};
```

```tsx
<body className={/* keep the scaffold's font classes */}>
  {children}
  <Toaster richColors position="top-right" />
</body>
```

- [ ] **Step 9: Check the flow in a browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected:
1. The browser lands on `/welcome`.
2. Clicking **Open your demo copy** lands on `/` showing "Northfield Studio", the sidebar, and the top bar.
3. Changing the date range updates the URL with `from` and `to`.
4. **Reset sample data** asks for confirmation, then shows the toast "Sample data restored".
5. In a private window, `/` again lands on `/welcome`.

Stop the server with Ctrl+C.

- [ ] **Step 10: Typecheck, lint, test, and commit**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: all succeed.

```bash
git add -A
git commit -m "Add welcome flow and app shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Dashboard

**Files:**
- Modify: `lib/finance/format.ts` (add `dueLabel`), `lib/finance/format.test.ts`
- Create: `components/dashboard/kpi-tiles.tsx`, `components/dashboard/income-expense-chart.tsx`, `components/dashboard/category-bars.tsx`, `components/dashboard/attention-list.tsx`, `components/dashboard/empty-business.tsx`
- Create: `components/invoices/status-badge.tsx`, `components/invoices/mark-paid-form.tsx`
- Modify: `app/(app)/page.tsx` (replace the temporary page)

**Interfaces:**
- Consumes: `getDashboard`, `DashboardData`, `markInvoicePaidAction`, `resetSampleDataAction`, `formatCents`, `parseRangeParams`.
- Produces:
  - `dueLabel(daysFromDue: number): string`.
  - `StatusBadge({ status: DisplayStatus })`.
  - `MarkPaidForm({ invoiceId: string; today: string; minDate?: string; withDate?: boolean })`.
  - Tiles carry `data-testid="tile-income" | "tile-expenses" | "tile-net" | "tile-owed"` and `data-cents` with the exact value, for the end-to-end tests.

- [ ] **Step 1: Write the failing due label test**

Add to `lib/finance/format.test.ts`:

```ts
import { dueLabel } from './format';

describe('dueLabel', () => {
  it.each([
    [12, 'Overdue 12 days'],
    [1, 'Overdue 1 day'],
    [0, 'Due today'],
    [-1, 'Due tomorrow'],
    [-5, 'Due in 5 days'],
  ])('labels %i days from due as %j', (days, label) => {
    expect(dueLabel(days)).toBe(label);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run lib/finance/format.test.ts
```

Expected: FAIL, `dueLabel is not a function` or a missing export error.

- [ ] **Step 3: Implement `dueLabel`**

Add to `lib/finance/format.ts`:

```ts
/** daysFromDue is positive when overdue, zero on the due date, negative before it. */
export function dueLabel(daysFromDue: number): string {
  if (daysFromDue > 0) return `Overdue ${daysFromDue} ${daysFromDue === 1 ? 'day' : 'days'}`;
  if (daysFromDue === 0) return 'Due today';
  if (daysFromDue === -1) return 'Due tomorrow';
  return `Due in ${-daysFromDue} days`;
}
```

```bash
npx vitest run lib/finance/format.test.ts
```

Expected: PASS.

- [ ] **Step 4: Build the invoice status badge and mark paid form**

Create `components/invoices/status-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import type { DisplayStatus } from '@/lib/finance/types';
import { cn } from '@/lib/utils';

const STYLES: Record<DisplayStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const style = STYLES[status];
  return (
    <Badge variant="secondary" className={cn('font-medium', style.className)}>
      {style.label}
    </Badge>
  );
}
```

Create `components/invoices/mark-paid-form.tsx`:

```tsx
'use client';

import { Loader2 } from 'lucide-react';
import { startTransition, useActionState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { markInvoicePaidAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FormState } from '@/lib/actions/result';

export function MarkPaidForm({
  invoiceId, today, minDate, withDate = false,
}: { invoiceId: string; today: string; minDate?: string; withDate?: boolean }) {
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await markInvoicePaidAction(prev, form);
    if (result.ok) toast.success(result.message ?? 'Invoice marked paid');
    else toast.error(result.message);
    return result;
  }, null);

  // Submitting through a transition keeps typed values if the server rejects them.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  }

  const dateError = state && !state.ok ? state.fieldErrors?.paidDate : undefined;

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {withDate ? (
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Payment date</span>
          <Input type="date" name="paidDate" defaultValue={today} min={minDate} max={today} required />
        </label>
      ) : (
        <input type="hidden" name="paidDate" value={today} />
      )}
      <Button type="submit" size="sm" variant={withDate ? 'default' : 'outline'} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Mark paid
      </Button>
      {dateError ? <p className="w-full text-sm text-destructive">{dateError}</p> : null}
    </form>
  );
}
```

- [ ] **Step 5: Build the dashboard components**

Create `components/dashboard/kpi-tiles.tsx`:

```tsx
import { Card } from '@/components/ui/card';
import { formatCents } from '@/lib/finance/money';
import type { totals as totalsFn } from '@/lib/finance/summary';
import { cn } from '@/lib/utils';

type Totals = ReturnType<typeof totalsFn>;

export function KpiTiles({ totals, receivables }: { totals: Totals; receivables: { owedCents: number; overdueCents: number } }) {
  const tiles = [
    { id: 'income', label: 'Income', cents: totals.incomeCents, detail: null, tone: null },
    { id: 'expenses', label: 'Expenses', cents: totals.expenseCents, detail: null, tone: null },
    {
      id: 'net', label: 'Net profit', cents: totals.netCents,
      detail: totals.marginPct === null ? 'No income in this range' : `${totals.marginPct}% margin`,
      tone: totals.netCents < 0 ? 'negative' : 'positive',
    },
    {
      id: 'owed', label: 'Owed to you', cents: receivables.owedCents,
      detail: `${formatCents(receivables.overdueCents, { whole: true })} overdue`,
      tone: receivables.overdueCents > 0 ? 'negative' : null,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.id} data-testid={`tile-${tile.id}`} data-cents={tile.cents} className="gap-1 p-4">
          <p className="text-sm text-muted-foreground">{tile.label}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCents(tile.cents, { whole: true })}</p>
          {tile.detail ? (
            <p className={cn('text-sm', tile.tone === 'negative' && 'text-destructive', tile.tone === 'positive' && 'text-emerald-700 dark:text-emerald-400')}>
              {tile.detail}
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
```

Create `components/dashboard/income-expense-chart.tsx`:

```tsx
'use client';

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCents } from '@/lib/finance/money';
import type { MonthPoint } from '@/lib/finance/summary';

export function IncomeExpenseChart({ series }: { series: MonthPoint[] }) {
  const data = series.map((p) => ({
    label: p.label,
    Income: p.incomeCents / 100,
    Expenses: p.expenseCents / 100,
    'Net profit': p.netCents / 100,
  }));

  return (
    <div className="h-72 w-full" role="img" aria-label="Monthly income, expenses, and net profit">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.3} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={56} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(value) => formatCents(Math.round(Number(value) * 100))} />
          <Legend />
          <Bar dataKey="Income" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Expenses" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
          <Line dataKey="Net profit" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Create `components/dashboard/category-bars.tsx`:

```tsx
import { formatCents } from '@/lib/finance/money';

export function CategoryBars({ items }: { items: { categoryId: string; name: string; totalCents: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No expenses in this date range.</p>;
  const max = items[0].totalCents;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.categoryId}>
          <div className="flex justify-between gap-3 text-sm">
            <span>{item.name}</span>
            <span className="tabular-nums">{formatCents(item.totalCents, { whole: true })}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary/70" style={{ width: `${Math.max(2, (item.totalCents / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
```

Create `components/dashboard/attention-list.tsx`:

```tsx
import Link from 'next/link';
import { MarkPaidForm } from '@/components/invoices/mark-paid-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dueLabel } from '@/lib/finance/format';
import { formatCents } from '@/lib/finance/money';
import type { AttentionItem } from '@/lib/finance/summary';

export function AttentionList({ items, today }: { items: AttentionItem[]; today: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing overdue or due in the next 14 days.</p>;
  }
  return (
    <Table data-testid="attention-list">
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Client</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="sr-only">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/invoices/${item.id}`} className="font-medium hover:underline">
                {item.number}
              </Link>
            </TableCell>
            <TableCell>{item.clientName}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCents(item.totalCents)}</TableCell>
            <TableCell className={item.displayStatus === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}>
              {dueLabel(item.daysFromDue)}
            </TableCell>
            <TableCell className="text-right">
              <MarkPaidForm invoiceId={item.id} today={today} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Create `components/dashboard/empty-business.tsx`:

```tsx
'use client';

import { Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { resetSampleDataAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { FormState } from '@/lib/actions/result';

export function EmptyBusiness() {
  const [, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await resetSampleDataAction(prev, form);
    if (!result.ok) toast.error(result.message);
    return result;
  }, null);

  return (
    <Card className="mx-auto max-w-md items-center gap-3 p-8 text-center">
      <h2 className="text-lg font-semibold">Load the sample business</h2>
      <p className="text-sm text-muted-foreground">Your demo copy is empty. Load 18 months of sample income, expenses, and invoices.</p>
      <form action={action}>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Load sample data
        </Button>
      </form>
    </Card>
  );
}
```

- [ ] **Step 6: Replace the dashboard page**

Replace `app/(app)/page.tsx`:

```tsx
import { AttentionList } from '@/components/dashboard/attention-list';
import { CategoryBars } from '@/components/dashboard/category-bars';
import { EmptyBusiness } from '@/components/dashboard/empty-business';
import { IncomeExpenseChart } from '@/components/dashboard/income-expense-chart';
import { KpiTiles } from '@/components/dashboard/kpi-tiles';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { getDashboard } from '@/lib/data/dashboard';
import { requireSandbox } from '@/lib/data/sandbox';
import { parseRangeParams } from '@/lib/finance/date-range';
import { todayISO } from '@/lib/finance/dates';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sandbox = await requireSandbox();
  const today = todayISO();
  const range = parseRangeParams(await searchParams, today);
  const data = await getDashboard(sandbox.supabase, range, today);

  if (data.isEmpty) return <EmptyBusiness />;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />
      <KpiTiles totals={data.totals} receivables={data.receivables} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Income and expenses by month</h2>
          <IncomeExpenseChart series={data.series} />
        </Card>
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Expenses by category</h2>
          <CategoryBars items={data.byCategory} />
        </Card>
      </div>
      <Card className="gap-3 p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Needs attention</h2>
        <AttentionList items={data.attention} today={today} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Check the dashboard in a browser**

```bash
npm run dev
```

Open `http://localhost:3000`, open a demo copy, and check:
1. Four tiles show non-zero income and expenses, a margin, and an overdue amount.
2. The chart shows 12 months for the default range; switching to "This month" shows one month.
3. "Needs attention" lists 4 to 6 overdue invoices first, then invoices due soon.
4. **Mark paid** on an overdue row shows "Invoice marked paid", the row disappears, and "Owed to you" drops by that amount.

Stop the server.

- [ ] **Step 8: Typecheck, lint, test, and commit**

```bash
npm run typecheck && npm run lint && npm test
```

```bash
git add -A
git commit -m "Add dashboard with tiles, monthly chart, categories, and attention list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: Income and expenses screens

**Files:**
- Create: `lib/finance/params.ts`
- Create: `components/transactions/transactions-screen.tsx`, `components/transactions/transaction-filters.tsx`, `components/transactions/transaction-table.tsx`, `components/transactions/add-transaction-sheet.tsx`
- Create: `app/(app)/income/page.tsx`, `app/(app)/expenses/page.tsx`
- Test: `lib/finance/params.test.ts`

**Interfaces:**
- Consumes: `listTransactions`, `listCategories`, `addTransactionAction`, `transactionSchema`, `fieldErrors`, `formString`, `filterTransactions`, `distinctCounterparties`, `withRange`, `formatDisplayDate`, `Field`, `NativeSelect`, `PageHeader`.
- Produces: `firstParam(value: string | string[] | undefined): string | undefined`; `TransactionsScreen({ kind, searchParams })`. URL filters: `category`, `q`, and (expenses only) `vendor`. The add form fields: **Date**, **Vendor** or **Source**, **Category**, **Amount**, **Note (optional)**, button **Save**.

- [ ] **Step 1: Write the failing params test**

Create `lib/finance/params.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { firstParam } from './params';

describe('firstParam', () => {
  it('returns a single non-empty string or undefined', () => {
    expect(firstParam('rent')).toBe('rent');
    expect(firstParam(['rent', 'other'])).toBe('rent');
    expect(firstParam('')).toBeUndefined();
    expect(firstParam(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

```bash
npx vitest run lib/finance/params.test.ts
```

Expected: FAIL, missing module. Create `lib/finance/params.ts`:

```ts
export function firstParam(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : undefined;
}
```

```bash
npx vitest run lib/finance/params.test.ts
```

Expected: PASS.

- [ ] **Step 3: Build the table and filters**

Create `components/transactions/transaction-table.tsx`:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDisplayDate } from '@/lib/finance/format';
import { formatCents } from '@/lib/finance/money';
import type { Category, Transaction, TransactionKind } from '@/lib/finance/types';

export function TransactionTable({
  kind, rows, categories, emptyMessage, clearHref,
}: { kind: TransactionKind; rows: Transaction[]; categories: Category[]; emptyMessage: string; clearHref: string | null }) {
  if (rows.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {clearHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={clearHref}>Clear filters</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const names = new Map(categories.map((c) => [c.id, c.name]));
  const total = rows.reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}, total {formatCents(total)}
      </p>
      <Table data-testid="transaction-table">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>{kind === 'income' ? 'Source' : 'Vendor'}</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="hidden md:table-cell">Note</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{formatDisplayDate(row.date)}</TableCell>
              <TableCell className="max-w-56 truncate">{row.counterparty}</TableCell>
              <TableCell>{names.get(row.categoryId) ?? 'Uncategorized'}</TableCell>
              <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">{row.note}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(row.amountCents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

Create `components/transactions/transaction-filters.tsx`:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { withRange } from '@/lib/finance/range-query';
import type { Category, DateRange, TransactionKind } from '@/lib/finance/types';

export function TransactionFilters({
  kind, range, categories, vendors, filters, hasFilters,
}: {
  kind: TransactionKind;
  range: DateRange;
  categories: Category[];
  vendors: string[];
  filters: { categoryId?: string; search?: string; vendor?: string };
  hasFilters: boolean;
}) {
  const path = kind === 'income' ? '/income' : '/expenses';
  return (
    <form method="get" action={path} role="search" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="from" value={range.from} />
      <input type="hidden" name="to" value={range.to} />
      <div className="w-48">
        <Field label="Category">
          <NativeSelect name="category" defaultValue={filters.categoryId ?? ''}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {kind === 'expense' ? (
        <div className="w-56">
          <Field label="Vendor">
            <NativeSelect name="vendor" defaultValue={filters.vendor ?? ''}>
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      ) : null}
      <div className="w-56">
        <Field label="Search">
          <Input name="q" type="search" defaultValue={filters.search ?? ''} placeholder={kind === 'income' ? 'Source or note' : 'Vendor or note'} />
        </Field>
      </div>
      <Button type="submit" variant="secondary">Apply filters</Button>
      {hasFilters ? (
        <Button asChild variant="ghost">
          <Link href={withRange(path, range)}>Clear filters</Link>
        </Button>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 4: Build the add form**

Create `components/transactions/add-transaction-sheet.tsx`:

```tsx
'use client';

import { Loader2, Plus } from 'lucide-react';
import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { addTransactionAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { FormState } from '@/lib/actions/result';
import type { Category, TransactionKind } from '@/lib/finance/types';
import { fieldErrors, formString } from '@/lib/validation/form';
import { transactionSchema } from '@/lib/validation/schemas';

const COPY = {
  income: { button: 'Add income', counterparty: 'Source', placeholder: 'Northfield Public Library' },
  expense: { button: 'Add expense', counterparty: 'Vendor', placeholder: 'Pixelboard' },
} as const;

export function AddTransactionSheet({ kind, categories, today }: { kind: TransactionKind; categories: Category[]; today: string }) {
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await addTransactionAction(prev, form);
    if (result.ok) {
      toast.success(result.message ?? 'Saved');
      setOpen(false);
      setFormKey((key) => key + 1);
    }
    return result;
  }, null);

  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);

  // The browser runs the same schema as the server first, so most mistakes show instantly.
  // Submitting through a transition keeps the typed values when the server rejects them.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const check = transactionSchema(today).safeParse({
      kind,
      date: formString(form, 'date'),
      counterparty: formString(form, 'counterparty'),
      categoryId: formString(form, 'categoryId'),
      amount: formString(form, 'amount'),
      note: formString(form, 'note'),
    });
    if (!check.success) {
      setClientErrors(fieldErrors(check.error));
      return;
    }
    setClientErrors(null);
    startTransition(() => action(form));
  }

  const errors = clientErrors ?? (state && !state.ok ? (state.fieldErrors ?? {}) : {});

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus aria-hidden />
          {copy.button}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{copy.button}</SheetTitle>
          <SheetDescription>Saved to your private demo copy.</SheetDescription>
        </SheetHeader>
        <form key={formKey} onSubmit={submit} noValidate className="grid gap-4 px-4 pb-4">
          <input type="hidden" name="kind" value={kind} />
          <Field label="Date" error={errors.date}>
            <Input type="date" name="date" defaultValue={today} max={today} />
          </Field>
          <Field label={copy.counterparty} error={errors.counterparty}>
            <Input name="counterparty" placeholder={copy.placeholder} maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Category" error={errors.categoryId}>
            <NativeSelect name="categoryId" defaultValue="">
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Amount" error={errors.amount}>
            <Input name="amount" inputMode="decimal" placeholder="1,250.00" autoComplete="off" />
          </Field>
          <Field label="Note (optional)" error={errors.note}>
            <Textarea name="note" rows={3} maxLength={500} />
          </Field>
          {state && !state.ok && !state.fieldErrors ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 5: Build the shared screen and the two pages**

Create `components/transactions/transactions-screen.tsx`:

```tsx
import { PageHeader } from '@/components/shell/page-header';
import { listCategories } from '@/lib/data/categories';
import { requireSandbox } from '@/lib/data/sandbox';
import { listTransactions } from '@/lib/data/transactions';
import { parseRangeParams } from '@/lib/finance/date-range';
import { todayISO } from '@/lib/finance/dates';
import { distinctCounterparties, filterTransactions } from '@/lib/finance/filters';
import { firstParam } from '@/lib/finance/params';
import { withRange } from '@/lib/finance/range-query';
import type { TransactionKind } from '@/lib/finance/types';
import { AddTransactionSheet } from './add-transaction-sheet';
import { TransactionFilters } from './transaction-filters';
import { TransactionTable } from './transaction-table';

type Params = Record<string, string | string[] | undefined>;

const COPY = {
  income: { title: 'Income', path: '/income', empty: 'No income in this date range' },
  expense: { title: 'Expenses', path: '/expenses', empty: 'No expenses in this date range' },
} as const;

export async function TransactionsScreen({ kind, searchParams }: { kind: TransactionKind; searchParams: Promise<Params> }) {
  const sandbox = await requireSandbox();
  const params = await searchParams;
  const today = todayISO();
  const range = parseRangeParams(params, today);
  const [rows, categories] = await Promise.all([
    listTransactions(sandbox.supabase, range, kind),
    listCategories(sandbox.supabase, kind),
  ]);

  const filters = {
    categoryId: firstParam(params.category),
    search: firstParam(params.q),
    vendor: kind === 'expense' ? firstParam(params.vendor) : undefined,
  };
  const visible = filterTransactions(rows, filters);
  const hasFilters = Boolean(filters.categoryId || filters.search?.trim() || filters.vendor);
  const copy = COPY[kind];

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} actions={<AddTransactionSheet kind={kind} categories={categories} today={today} />} />
      <TransactionFilters
        kind={kind}
        range={range}
        categories={categories}
        vendors={kind === 'expense' ? distinctCounterparties(rows) : []}
        filters={filters}
        hasFilters={hasFilters}
      />
      <TransactionTable
        kind={kind}
        rows={visible}
        categories={categories}
        emptyMessage={copy.empty}
        clearHref={hasFilters ? withRange(copy.path, range) : null}
      />
    </div>
  );
}
```

Create `app/(app)/income/page.tsx`:

```tsx
import { TransactionsScreen } from '@/components/transactions/transactions-screen';

export default function IncomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TransactionsScreen kind="income" searchParams={searchParams} />;
}
```

Create `app/(app)/expenses/page.tsx`:

```tsx
import { TransactionsScreen } from '@/components/transactions/transactions-screen';

export default function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TransactionsScreen kind="expense" searchParams={searchParams} />;
}
```

- [ ] **Step 6: Check both screens in a browser**

```bash
npm run dev
```

With a demo copy open, check:
1. `/expenses` lists expenses with a count and total; filtering by category "Rent" shows one row per month.
2. Searching `Pixelboard` shows only those rows; **Clear filters** brings everything back.
3. **Add expense** with an empty amount shows "Enter an amount like 1,250.00" and keeps the other typed values.
4. A valid expense shows "Expense added", closes the panel, and appears in the table.
5. `/income` shows client payments and lets you add income.

Stop the server.

- [ ] **Step 7: Typecheck, lint, test, and commit**

```bash
npm run typecheck && npm run lint && npm test
```

```bash
git add -A
git commit -m "Add income and expenses screens with filters and add forms

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Invoices screens

**Files:**
- Create: `components/invoices/invoice-tabs.tsx`, `components/invoices/invoice-table.tsx`, `components/invoices/new-invoice-sheet.tsx`, `components/invoices/mark-sent-button.tsx`
- Create: `app/(app)/invoices/page.tsx`, `app/(app)/invoices/[id]/page.tsx`, `app/(app)/invoices/[id]/not-found.tsx`

**Interfaces:**
- Consumes: `listInvoices`, `getInvoice`, `listClientNames`, `createInvoiceAction`, `invoiceSchema`, `fieldErrors`, `formString`, `markInvoiceSentAction`, `MarkPaidForm`, `StatusBadge`, `INVOICE_TABS`, `parseInvoiceTab`, `filterInvoicesByTab`, `displayStatus`, `invoiceTotalCents`, `lineTotalCents`, `parseQuantity`, `parseMoneyToCents`, `addDays`.
- Produces: routes `/invoices?status=...` and `/invoices/[id]`. New invoice form fields: **Client**, **Issue date**, **Due date**, per item **Description**, **Quantity**, **Price**, **Notes (optional)**; buttons **Add item**, **Save draft**, **Save and mark sent**; preview total `data-testid="invoice-preview-total"`; detail total `data-testid="invoice-total"`.

- [ ] **Step 1: Build the tabs and table**

Create `components/invoices/invoice-tabs.tsx`:

```tsx
import Link from 'next/link';
import { INVOICE_TABS, type InvoiceTab } from '@/lib/finance/filters';
import { withRange } from '@/lib/finance/range-query';
import type { DateRange } from '@/lib/finance/types';
import { cn } from '@/lib/utils';

export function InvoiceTabs({ range, active, counts }: { range: DateRange; active: InvoiceTab; counts: Record<InvoiceTab, number> }) {
  return (
    <nav aria-label="Invoice status" className="flex gap-1 overflow-x-auto border-b">
      {INVOICE_TABS.map((tab) => (
        <Link
          key={tab.value}
          href={withRange('/invoices', range, { status: tab.value === 'all' ? undefined : tab.value })}
          aria-current={tab.value === active ? 'page' : undefined}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground',
            tab.value === active && 'border-primary font-medium text-foreground',
          )}
        >
          {tab.label} <span className="tabular-nums">({counts[tab.value]})</span>
        </Link>
      ))}
    </nav>
  );
}
```

Create `components/invoices/invoice-table.tsx`:

```tsx
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDisplayDate } from '@/lib/finance/format';
import { formatCents } from '@/lib/finance/money';
import { displayStatus } from '@/lib/finance/summary';
import type { InvoiceSummary } from '@/lib/finance/types';
import { StatusBadge } from './status-badge';

export function InvoiceTable({ invoices, today }: { invoices: InvoiceSummary[]; today: string }) {
  if (invoices.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No invoices in this date range</p>;
  }
  return (
    <Table data-testid="invoice-table">
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Client</TableHead>
          <TableHead className="hidden sm:table-cell">Issued</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
                {invoice.number}
              </Link>
            </TableCell>
            <TableCell className="max-w-48 truncate">{invoice.clientName}</TableCell>
            <TableCell className="hidden whitespace-nowrap sm:table-cell">{formatDisplayDate(invoice.issueDate)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDisplayDate(invoice.dueDate)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCents(invoice.totalCents)}</TableCell>
            <TableCell>
              <StatusBadge status={displayStatus(invoice.status, invoice.dueDate, today)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Build the new invoice form**

Create `components/invoices/new-invoice-sheet.tsx`:

```tsx
'use client';

import { Loader2, Plus, Trash2 } from 'lucide-react';
import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { createInvoiceAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { addDays } from '@/lib/finance/dates';
import { formatCents, invoiceTotalCents, parseMoneyToCents, parseQuantity } from '@/lib/finance/money';
import { fieldErrors, formString } from '@/lib/validation/form';
import { invoiceSchema } from '@/lib/validation/schemas';

interface ItemDraft {
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_ITEM: ItemDraft = { description: '', quantity: '1', unitPrice: '' };
const MAX_ITEMS = 20;

export function NewInvoiceSheet({ clientNames, today }: { clientNames: string[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([EMPTY_ITEM]);
  // On success the action redirects to the new invoice, so only errors come back here.
  const [state, action, pending] = useActionState(createInvoiceAction, null);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const errors = clientErrors ?? (state && !state.ok ? (state.fieldErrors ?? {}) : {});

  const previewCents = invoiceTotalCents(
    items.flatMap((item) => {
      const quantity = parseQuantity(item.quantity);
      const unitPriceCents = parseMoneyToCents(item.unitPrice);
      return quantity !== null && unitPriceCents !== null ? [{ quantity, unitPriceCents }] : [];
    }),
  );

  function update(index: number, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const form = new FormData(event.currentTarget, submitter);
    form.set('items', JSON.stringify(items));
    // Same schema as the server, run in the browser first.
    const check = invoiceSchema().safeParse({
      clientName: formString(form, 'clientName'),
      issueDate: formString(form, 'issueDate'),
      dueDate: formString(form, 'dueDate'),
      notes: formString(form, 'notes'),
      status: formString(form, 'status'),
      items,
    });
    if (!check.success) {
      setClientErrors(fieldErrors(check.error));
      return;
    }
    setClientErrors(null);
    startTransition(() => action(form));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus aria-hidden />
          New invoice
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New invoice</SheetTitle>
          <SheetDescription>Pick an existing client or type a new name.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} noValidate className="grid gap-4 px-4 pb-4">
          <Field label="Client" error={errors.clientName}>
            <Input name="clientName" list="client-names" placeholder="Northwind Cafe" maxLength={120} autoComplete="off" />
          </Field>
          <datalist id="client-names">
            {clientNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date" error={errors.issueDate}>
              <Input type="date" name="issueDate" defaultValue={today} />
            </Field>
            <Field label="Due date" error={errors.dueDate}>
              <Input type="date" name="dueDate" defaultValue={addDays(today, 30)} />
            </Field>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">Line items</legend>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_auto] items-start gap-2">
                <Field label="Description" error={errors[`items.${index}.description`]}>
                  <Input value={item.description} placeholder="Website design" maxLength={200} onChange={(e) => update(index, { description: e.target.value })} />
                </Field>
                <Field label="Quantity" error={errors[`items.${index}.quantity`]}>
                  <Input value={item.quantity} inputMode="decimal" onChange={(e) => update(index, { quantity: e.target.value })} />
                </Field>
                <Field label="Price" error={errors[`items.${index}.unitPrice`]}>
                  <Input value={item.unitPrice} inputMode="decimal" placeholder="250.00" onChange={(e) => update(index, { unitPrice: e.target.value })} />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={items.length === 1}
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            {errors.items ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.items}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              disabled={items.length >= MAX_ITEMS}
              onClick={() => setItems((current) => [...current, EMPTY_ITEM])}
            >
              <Plus aria-hidden />
              Add item
            </Button>
          </fieldset>

          <Field label="Notes (optional)" error={errors.notes}>
            <Textarea name="notes" rows={3} maxLength={500} />
          </Field>

          <p className="flex justify-between text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums" data-testid="invoice-preview-total">
              {formatCents(previewCents)}
            </span>
          </p>

          {state && !state.ok && !state.fieldErrors ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="status" value="draft" variant="outline" disabled={pending}>
              Save draft
            </Button>
            <Button type="submit" name="status" value="sent" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save and mark sent
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Build the invoices list page**

Create `app/(app)/invoices/page.tsx`:

```tsx
import { InvoiceTable } from '@/components/invoices/invoice-table';
import { InvoiceTabs } from '@/components/invoices/invoice-tabs';
import { NewInvoiceSheet } from '@/components/invoices/new-invoice-sheet';
import { PageHeader } from '@/components/shell/page-header';
import { listClientNames } from '@/lib/data/clients';
import { listInvoices } from '@/lib/data/invoices';
import { requireSandbox } from '@/lib/data/sandbox';
import { parseRangeParams } from '@/lib/finance/date-range';
import { todayISO } from '@/lib/finance/dates';
import { filterInvoicesByTab, INVOICE_TABS, parseInvoiceTab, type InvoiceTab } from '@/lib/finance/filters';
import { firstParam } from '@/lib/finance/params';

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sandbox = await requireSandbox();
  const params = await searchParams;
  const today = todayISO();
  const range = parseRangeParams(params, today);
  const tab = parseInvoiceTab(firstParam(params.status));

  const [invoices, clientNames] = await Promise.all([
    listInvoices(sandbox.supabase, { issuedIn: range }),
    listClientNames(sandbox.supabase),
  ]);
  const counts = Object.fromEntries(
    INVOICE_TABS.map((t) => [t.value, filterInvoicesByTab(invoices, t.value, today).length]),
  ) as Record<InvoiceTab, number>;

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" actions={<NewInvoiceSheet clientNames={clientNames} today={today} />} />
      <InvoiceTabs range={range} active={tab} counts={counts} />
      <InvoiceTable invoices={filterInvoicesByTab(invoices, tab, today)} today={today} />
    </div>
  );
}
```

- [ ] **Step 4: Build the detail page, mark sent button, and not found page**

Create `components/invoices/mark-sent-button.tsx`:

```tsx
'use client';

import { Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { markInvoiceSentAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import type { FormState } from '@/lib/actions/result';

export function MarkSentButton({ invoiceId }: { invoiceId: string }) {
  const [, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await markInvoiceSentAction(prev, form);
    if (result.ok) toast.success(result.message ?? 'Invoice marked sent');
    else toast.error(result.message);
    return result;
  }, null);

  return (
    <form action={action}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Mark sent
      </Button>
    </form>
  );
}
```

Create `app/(app)/invoices/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarkPaidForm } from '@/components/invoices/mark-paid-form';
import { MarkSentButton } from '@/components/invoices/mark-sent-button';
import { StatusBadge } from '@/components/invoices/status-badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getInvoice } from '@/lib/data/invoices';
import { requireSandbox } from '@/lib/data/sandbox';
import { todayISO } from '@/lib/finance/dates';
import { formatDisplayDate } from '@/lib/finance/format';
import { formatCents, lineTotalCents } from '@/lib/finance/money';
import { displayStatus } from '@/lib/finance/summary';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const sandbox = await requireSandbox();
  const { id } = await params;
  const today = todayISO();
  const result = await getInvoice(sandbox.supabase, id);
  if (!result) notFound();
  const { invoice, items } = result;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/invoices" className="text-sm text-muted-foreground hover:underline">
        Back to invoices
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.number}</h1>
          <p className="text-muted-foreground">{invoice.clientName}</p>
        </div>
        <StatusBadge status={displayStatus(invoice.status, invoice.dueDate, today)} />
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Issued</dt>
          <dd>{formatDisplayDate(invoice.issueDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Due</dt>
          <dd>{formatDisplayDate(invoice.dueDate)}</dd>
        </div>
        {invoice.paidDate ? (
          <div>
            <dt className="text-muted-foreground">Paid</dt>
            <dd>{formatDisplayDate(invoice.paidDate)}</dd>
          </div>
        ) : null}
      </dl>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.description}</TableCell>
              <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(item.unitPriceCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(lineTotalCents(item.quantity, item.unitPriceCents))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right tabular-nums" data-testid="invoice-total">
              {formatCents(invoice.totalCents)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      {invoice.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{invoice.notes}</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        {invoice.status === 'draft' ? <MarkSentButton invoiceId={invoice.id} /> : null}
        {invoice.status === 'sent' ? <MarkPaidForm invoiceId={invoice.id} today={today} minDate={invoice.issueDate} withDate /> : null}
      </div>
    </div>
  );
}
```

Create `app/(app)/invoices/[id]/not-found.tsx`:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function InvoiceNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h2 className="text-lg font-semibold">We couldn&apos;t find that invoice</h2>
      <p className="text-sm text-muted-foreground">It may belong to an older demo copy.</p>
      <Button asChild variant="outline">
        <Link href="/invoices">Back to invoices</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Check the invoice flow in a browser**

```bash
npm run dev
```

With a demo copy open, check:
1. `/invoices` shows tab counts; **Overdue** shows 4 to 6 invoices.
2. **New invoice**: client `northwind cafe`, items `Design` x `1.5` at `33.33` and `Hosting` x `1` at `100`. The preview total reads `$150.00`.
3. **Save and mark sent** opens the new invoice with status Sent, total `$150.00`, and the client shown as "Northwind Cafe" (existing client reused).
4. **Mark paid** with today's date shows Paid; `/income` lists a $150.00 payment from Northwind Cafe.
5. `/invoices/not-a-real-id` shows "We couldn't find that invoice".

Stop the server.

- [ ] **Step 6: Typecheck, lint, test, and commit**

```bash
npm run typecheck && npm run lint && npm test
```

```bash
git add -A
git commit -m "Add invoice list, new invoice form, and invoice detail

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 14: End-to-end tests

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/demo.spec.ts`

**Interfaces:**
- Consumes: the running app against local Supabase; labels, buttons, and `data-testid` values from Tasks 10 to 13.
- Produces: `npm run test:e2e`, green against local Supabase.

- [ ] **Step 1: Add the Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: 'http://localhost:3000/welcome',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [ ] **Step 2: Add helpers**

Create `e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test';

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export function nav(page: Page, name: 'Dashboard' | 'Income' | 'Expenses' | 'Invoices') {
  return page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });
}

/** Opens a fresh sandbox in this browser context and waits for the dashboard. */
export async function openDemo(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByRole('button', { name: 'Open your demo copy' }).click();
  await expect(page.getByTestId('tile-income')).toBeVisible({ timeout: 30_000 });
}

export async function tileCents(page: Page, id: 'income' | 'expenses' | 'net' | 'owed'): Promise<number> {
  return Number(await page.getByTestId(`tile-${id}`).getAttribute('data-cents'));
}

export async function addExpense(page: Page, vendor: string, amount: string): Promise<void> {
  await nav(page, 'Expenses').click();
  await page.getByRole('button', { name: 'Add expense' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Vendor').fill(vendor);
  await dialog.getByLabel('Category').selectOption({ label: 'Equipment' });
  await dialog.getByLabel('Amount').fill(amount);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Expense added')).toBeVisible();
  await expect(page.getByTestId('transaction-table')).toContainText(vendor);
}
```

- [ ] **Step 3: Write the end-to-end tests**

Create `e2e/demo.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { addExpense, nav, openDemo, tileCents, uniqueName } from './helpers';

test('opens a private demo copy with sample numbers', async ({ page }) => {
  await openDemo(page);
  expect(await tileCents(page, 'income')).toBeGreaterThan(0);
  expect(await tileCents(page, 'expenses')).toBeGreaterThan(0);
  await expect(page.getByTestId('attention-list')).toContainText('Overdue');
});

test('adds an expense and updates the totals', async ({ page }) => {
  await openDemo(page);
  const before = await tileCents(page, 'expenses');
  await addExpense(page, uniqueName('E2E Office Supplies'), '123.45');
  await nav(page, 'Dashboard').click();
  await expect.poll(() => tileCents(page, 'expenses')).toBe(before + 12345);
});

test('keeps typed values when the expense form has an error', async ({ page }) => {
  await openDemo(page);
  await nav(page, 'Expenses').click();
  await page.getByRole('button', { name: 'Add expense' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Vendor').fill('Kept Vendor');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('Enter an amount like 1,250.00')).toBeVisible();
  await expect(dialog.getByLabel('Vendor')).toHaveValue('Kept Vendor');
});

test('creates, sends, and pays an invoice', async ({ page }) => {
  await openDemo(page);
  const client = uniqueName('E2E Client');
  await nav(page, 'Invoices').click();
  await page.getByRole('button', { name: 'New invoice' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Client').fill(client);
  await dialog.getByLabel('Description').first().fill('Design');
  await dialog.getByLabel('Quantity').first().fill('1.5');
  await dialog.getByLabel('Price').first().fill('33.33');
  await dialog.getByRole('button', { name: 'Add item' }).click();
  await dialog.getByLabel('Description').nth(1).fill('Hosting');
  await dialog.getByLabel('Price').nth(1).fill('100');
  await expect(dialog.getByTestId('invoice-preview-total')).toHaveText('$150.00');
  await dialog.getByRole('button', { name: 'Save and mark sent' }).click();

  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('invoice-total')).toHaveText('$150.00');
  await expect(page.getByText('Sent', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Mark paid' }).click();
  await expect(page.getByText('Invoice marked paid')).toBeVisible();
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();

  await nav(page, 'Income').click();
  await page.getByLabel('Search').fill(client);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByTestId('transaction-table')).toContainText('$150.00');
});

test('reset restores the sample data', async ({ page }) => {
  await openDemo(page);
  const original = await tileCents(page, 'expenses');
  await addExpense(page, uniqueName('E2E Reset Check'), '500');
  await nav(page, 'Dashboard').click();
  await expect.poll(() => tileCents(page, 'expenses')).toBe(original + 50000);

  await page.getByRole('button', { name: 'Reset sample data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText('Sample data restored')).toBeVisible();
  await expect.poll(() => tileCents(page, 'expenses')).toBe(original);
});

test('two browsers get separate sandboxes', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await openDemo(pageA);
  const vendor = uniqueName('E2E Private Vendor');
  await addExpense(pageA, vendor, '42');

  await openDemo(pageB);
  await pageB.goto(`/expenses?q=${encodeURIComponent(vendor)}`);
  await expect(pageB.getByText('No expenses in this date range')).toBeVisible();

  await contextA.close();
  await contextB.close();
});
```

- [ ] **Step 4: Run the end-to-end tests locally**

Local Supabase must be running and `.env.local` must point at it.

```bash
npm run db:start && npm run env:local
```

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

Expected: `6 passed`. If a test fails, open the trace with `npx playwright show-trace test-results/<folder>/trace.zip`, fix the app code (not the assertion) unless the assertion contradicts the spec.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "Add end-to-end tests for the demo flows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Viewer setup script and README

**Files:**
- Modify: `scripts/setup-lib.ts`, `scripts/setup-lib.test.ts`
- Create: `scripts/setup.ts`, `scripts/smoke.ts`, `README.md`
- Modify: `CLAUDE.md` (commands table)

**Interfaces:**
- Consumes: Supabase Management API (`GET /v1/projects/{ref}`, `PATCH /v1/projects/{ref}/config/auth`, `GET` and `POST /v1/projects/{ref}/api-keys`), Supabase CLI `db push`.
- Produces: `npm run setup -- [PROJECT_REF] [ENV_FILE]` (default env file `.env.local`), `npm run smoke -- URL`; `setup-lib.ts` adds `SETUP_AUTH_CONFIG`, `isProjectRef(ref): boolean`, `projectUrl(ref): string`, `pickPublishableKey(keys: unknown): string | null`.

- [ ] **Step 1: Write failing tests for the setup helpers**

Add to `scripts/setup-lib.test.ts`:

```ts
import { isProjectRef, pickPublishableKey, projectUrl, SETUP_AUTH_CONFIG } from './setup-lib';

describe('setup helpers', () => {
  it('validates project refs', () => {
    expect(isProjectRef('abcdefghijklmnopqrst')).toBe(true);
    expect(isProjectRef('abc')).toBe(false);
    expect(isProjectRef('ABCDEFGHIJKLMNOPQRST')).toBe(false);
    expect(isProjectRef('abcdefghijklmnopqrs1')).toBe(false);
  });
  it('builds the project URL', () => {
    expect(projectUrl('abcdefghijklmnopqrst')).toBe('https://abcdefghijklmnopqrst.supabase.co');
  });
  it('picks only a publishable key', () => {
    expect(pickPublishableKey([
      { type: 'secret', api_key: 'sb_secret_x' },
      { type: 'legacy', api_key: 'eyJ...' },
      { type: 'publishable', api_key: 'sb_publishable_ok' },
    ])).toBe('sb_publishable_ok');
    expect(pickPublishableKey([{ type: 'secret', api_key: 'sb_secret_x' }])).toBeNull();
    expect(pickPublishableKey({ error: 'nope' })).toBeNull();
  });
  it('turns on anonymous sign-in with a 300 per hour limit', () => {
    expect(SETUP_AUTH_CONFIG).toEqual({ external_anonymous_users_enabled: true, rate_limit_anonymous_users: 300 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run scripts
```

Expected: FAIL, `isProjectRef` is not exported.

- [ ] **Step 3: Implement the helpers**

Add to `scripts/setup-lib.ts`:

```ts
export const SETUP_AUTH_CONFIG = {
  external_anonymous_users_enabled: true,
  rate_limit_anonymous_users: 300,
} as const;

export function isProjectRef(ref: string): boolean {
  return /^[a-z]{20}$/.test(ref);
}

export function projectUrl(ref: string): string {
  return `https://${ref}.supabase.co`;
}

export function pickPublishableKey(keys: unknown): string | null {
  if (!Array.isArray(keys)) return null;
  const match = keys.find(
    (k) => k && typeof k === 'object' && k.type === 'publishable' && typeof k.api_key === 'string' && k.api_key.startsWith('sb_publishable_'),
  );
  return match ? (match.api_key as string) : null;
}
```

```bash
npx vitest run scripts
```

Expected: PASS.

- [ ] **Step 4: Write the setup script**

Create `scripts/setup.ts`:

```ts
// Prepares your own Supabase project for Builders Finance:
// turns on anonymous sign-in, applies the database migrations, and writes an env file.
// Usage: npm run setup -- [PROJECT_REF] [ENV_FILE]
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { buildEnvFile, isProjectRef, pickPublishableKey, projectUrl, SETUP_AUTH_CONFIG } from './setup-lib';

const API = 'https://api.supabase.com/v1';

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

async function main() {
  const [refArg, envFileArg] = process.argv.slice(2);
  const envFile = envFileArg ?? '.env.local';
  const rl = createInterface({ input: stdin, output: stdout });

  console.log('Builders Finance setup\n');
  console.log('Do not show this terminal on a stream while you paste your token.\n');
  const token =
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    (await rl.question('Supabase access token (create one at supabase.com/dashboard/account/tokens): ')).trim();
  const ref = (refArg || process.env.SUPABASE_PROJECT_REF || (await rl.question('Project ref (the 20 letters in your project URL): '))).trim();
  rl.close();

  if (!token) fail('An access token is required.');
  if (!isProjectRef(ref)) fail('That project ref looks wrong. It is 20 lowercase letters, for example abcdefghijklmnopqrst.');

  const api = (path: string, init: RequestInit = {}) =>
    fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });

  console.log('1/4 Checking the project...');
  const project = await api(`/projects/${ref}`);
  if (project.status === 401) fail('Supabase rejected the access token. Create a new one and try again.');
  if (project.status === 404) fail(`No project with ref ${ref} on this account.`);
  if (!project.ok) fail(`Could not read the project (HTTP ${project.status}).`);

  console.log('2/4 Turning on anonymous sign-in...');
  const auth = await api(`/projects/${ref}/config/auth`, { method: 'PATCH', body: JSON.stringify(SETUP_AUTH_CONFIG) });
  if (!auth.ok) fail(`Could not update auth settings (HTTP ${auth.status}).`);

  console.log('3/4 Applying database migrations...');
  console.log('    If the CLI asks for a database password, paste the one you set when you created the project.');
  try {
    execFileSync('npx', ['supabase', 'db', 'push', '--project-ref', ref, '--yes'], {
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    });
  } catch {
    fail('Applying migrations failed. Read the error above, fix it, and run setup again. It is safe to rerun.');
  }

  console.log('4/4 Writing your env file...');
  let key = pickPublishableKey(await (await api(`/projects/${ref}/api-keys?reveal=true`)).json());
  if (!key) {
    const created = await api(`/projects/${ref}/api-keys`, {
      method: 'POST',
      body: JSON.stringify({ type: 'publishable', name: 'builders_finance' }),
    });
    if (!created.ok) fail(`Could not create a publishable key (HTTP ${created.status}).`);
    key = pickPublishableKey([await created.json()]);
  }
  if (!key) fail('No publishable key found for this project.');

  if (existsSync(envFile)) copyFileSync(envFile, `${envFile}.bak`);
  writeFileSync(envFile, buildEnvFile(projectUrl(ref), key));

  console.log(`\nDone. Wrote ${envFile}.`);
  console.log('Next: run `npm run dev` and open http://localhost:3000');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
```

- [ ] **Step 5: Write the smoke test script**

Create `scripts/smoke.ts`:

```ts
// Checks that a deployed copy serves the welcome screen. Usage: npm run smoke -- https://your-app.vercel.app
const base = process.argv[2] ?? process.env.SMOKE_URL;
if (!base) {
  console.error('Usage: npm run smoke -- https://your-app.vercel.app');
  process.exit(1);
}

const url = new URL('/welcome', base);
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const body = await response.text();
    if (response.ok && body.includes('Open your demo copy')) {
      console.log(`Smoke test passed: ${url}`);
      process.exit(0);
    }
    console.log(`Attempt ${attempt}: HTTP ${response.status}, welcome text ${body.includes('Open your demo copy') ? 'found' : 'missing'}`);
  } catch (error) {
    console.log(`Attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}
console.error(`Smoke test failed: ${url}`);
process.exit(1);
```

Run it against the local dev server (start `npm run dev` in another terminal first):

```bash
npm run smoke -- http://localhost:3000
```

Expected: `Smoke test passed: http://localhost:3000/welcome`.

- [ ] **Step 6: Write the README**

Create `README.md`:

````markdown
# Builders Finance

A finance dashboard for small business owners: money in, money out, unpaid invoices, and the overall
health of the business, with date ranges and filters. Built live on a podcast with Claude Code.

Every visitor gets a private, editable copy of a sample business. No login. All data is made up.

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
````

- [ ] **Step 7: Record the verified commands in `CLAUDE.md`**

In `CLAUDE.md`, replace the line `No commands yet. Add verified dev and test commands here once the stack exists.` with:

```markdown
Run `npm run db:start` and `npm run env:local` once per session for local work.

| Command | Purpose |
|---|---|
| `npm run dev` | App on http://localhost:3000 |
| `npm test` | Unit tests |
| `npm run test:db` | pgTAP database tests (local Supabase) |
| `npm run test:e2e` | Playwright tests (local Supabase) |
| `npm run lint && npm run typecheck` | Static checks |
```

Update the table row for the implementation plan to `docs/plans/2026-10-15-builders-finance-v1.md`.

- [ ] **Step 8: Run all checks and commit**

```bash
npm test && npm run lint && npm run typecheck
```

```bash
git add scripts README.md CLAUDE.md
git commit -m "Add viewer setup script, smoke test, and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: CI, live database, and Vercel deploy

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` (live demo link)
- Local only, never committed: `.env.production.local`, `.vercel/`

**Interfaces:**
- Consumes: `.env.accounts.local` (`GH_TOKEN`, `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`), `npm run setup`, `npm run smoke`.
- Produces: GitHub secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; GitHub variable `PRODUCTION_URL`; a Vercel project `builders-finance` with production env vars; the live demo.

Every command in this task that needs tokens starts with `set -a; source .env.accounts.local; set +a;` because each shell starts fresh. Never echo a token.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - name: Start local Supabase
        run: npx supabase start
      - run: npm run test:db
      - run: npm run env:local
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7

  deploy:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    concurrency:
      group: deploy-production
      cancel-in-progress: false
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - name: Apply database migrations
        run: npx supabase db push --project-ref "$SUPABASE_PROJECT_REF" --yes
      - name: Pull Vercel settings
        run: npx vercel@56.2.1 pull --yes --environment=production --token="$VERCEL_TOKEN"
      - name: Build
        run: npx vercel@56.2.1 build --prod --token="$VERCEL_TOKEN"
      - name: Deploy
        run: npx vercel@56.2.1 deploy --prebuilt --prod --token="$VERCEL_TOKEN"
      - name: Smoke test
        run: npm run smoke -- "${{ vars.PRODUCTION_URL }}"
```

- [ ] **Step 2: Find the live Supabase project ref**

```bash
set -a; source .env.accounts.local; set +a; curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/projects | python3 -c 'import json,sys; [print(p["id"], p["name"], p["region"]) for p in json.load(sys.stdin)]'
```

Expected: one line like `<ref> Builders eu-west-1`. The first column is `PROJECT_REF` for the next steps.

- [ ] **Step 3: Confirm migrations can be pushed with the token alone**

```bash
set -a; source .env.accounts.local; set +a; npx supabase db push --project-ref PROJECT_REF --dry-run
```

Replace `PROJECT_REF` with the ref from Step 2. Expected: a list of the three migrations that would be applied. If the CLI asks for a database password instead, stop and ask Darko to add `SUPABASE_DB_PASSWORD=...` to `.env.accounts.local`; then add `--password "$SUPABASE_DB_PASSWORD"` to this command, to `scripts/setup.ts`'s `db push` call (only when the variable is set), and to the workflow's migration step with a matching `SUPABASE_DB_PASSWORD` secret.

- [ ] **Step 4: Prepare the live project with the setup script**

```bash
set -a; source .env.accounts.local; set +a; npm run setup -- PROJECT_REF .env.production.local
```

Expected: `Done. Wrote .env.production.local.` The live project now has anonymous sign-in, the schema, the functions, and the cleanup job.

- [ ] **Step 5: Create and link the Vercel project, then add its env vars**

```bash
set -a; source .env.accounts.local; set +a; npx vercel@56.2.1 project add builders-finance --token "$VERCEL_TOKEN"
```

```bash
set -a; source .env.accounts.local; set +a; npx vercel@56.2.1 link --yes --project builders-finance --token "$VERCEL_TOKEN"
```

Expected: `.vercel/project.json` exists. Confirm it is ignored:

```bash
git check-ignore -q .vercel && echo ignored
```

Expected: `ignored`. Then add both public values to production:

```bash
set -a; source .env.accounts.local; source .env.production.local; set +a; printf '%s' "$NEXT_PUBLIC_SUPABASE_URL" | npx vercel@56.2.1 env add NEXT_PUBLIC_SUPABASE_URL production --token "$VERCEL_TOKEN"
```

```bash
set -a; source .env.accounts.local; source .env.production.local; set +a; printf '%s' "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | npx vercel@56.2.1 env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production --token "$VERCEL_TOKEN"
```

- [ ] **Step 6: Deploy once by hand and find the production domain**

```bash
set -a; source .env.accounts.local; set +a; npx vercel@56.2.1 deploy --prod --token "$VERCEL_TOKEN"
```

Expected: a deployment URL and an `Aliased:` line with the production domain, for example `https://builders-finance.vercel.app` (Vercel adds a suffix if the name is taken). Use that domain as `PRODUCTION_URL`:

```bash
npm run smoke -- PRODUCTION_URL
```

Expected: `Smoke test passed`.

- [ ] **Step 7: Store the CI secrets and variable in GitHub**

Each value is piped through stdin so it never appears in the process list.

```bash
set -a; source .env.accounts.local; set +a; printf '%s' "$VERCEL_TOKEN" | gh secret set VERCEL_TOKEN --repo darkojanevski320-prog/builders-finance
```

```bash
set -a; source .env.accounts.local; set +a; printf '%s' "$SUPABASE_ACCESS_TOKEN" | gh secret set SUPABASE_ACCESS_TOKEN --repo darkojanevski320-prog/builders-finance
```

```bash
set -a; source .env.accounts.local; set +a; printf '%s' "PROJECT_REF" | gh secret set SUPABASE_PROJECT_REF --repo darkojanevski320-prog/builders-finance
```

```bash
set -a; source .env.accounts.local; set +a; python3 -c 'import json; print(json.load(open(".vercel/project.json"))["orgId"], end="")' | gh secret set VERCEL_ORG_ID --repo darkojanevski320-prog/builders-finance
```

```bash
set -a; source .env.accounts.local; set +a; python3 -c 'import json; print(json.load(open(".vercel/project.json"))["projectId"], end="")' | gh secret set VERCEL_PROJECT_ID --repo darkojanevski320-prog/builders-finance
```

```bash
set -a; source .env.accounts.local; set +a; gh variable set PRODUCTION_URL --body "PRODUCTION_URL" --repo darkojanevski320-prog/builders-finance
```

Replace `PROJECT_REF` and `PRODUCTION_URL` with the real values. Confirm:

```bash
set -a; source .env.accounts.local; set +a; gh secret list --repo darkojanevski320-prog/builders-finance
```

Expected: the five secret names (values are never shown).

- [ ] **Step 8: Add the live demo link and push**

In `README.md`, add this line under the first paragraph, using the real production domain:

```markdown
**Live demo:** PRODUCTION_URL
```

```bash
git add .github README.md
git commit -m "Add CI with tests, migrations, Vercel deploy, and smoke test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```bash
git push
```

- [ ] **Step 9: Watch the first CI run**

Run this in the background; it blocks until the run finishes.

```bash
set -a; source .env.accounts.local; set +a; gh run watch --exit-status --repo darkojanevski320-prog/builders-finance $(gh run list --repo darkojanevski320-prog/builders-finance --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: both `test` and `deploy` jobs succeed. If `test` fails, read the log with `gh run view --log-failed --repo darkojanevski320-prog/builders-finance` and fix the cause in code.

- [ ] **Step 10: Check the live demo in a browser**

Open the production domain, click **Open your demo copy**, and confirm the dashboard loads with sample numbers. Add one expense and reset, to prove writes work against the live database.

---

### Task 17: Launch cleanup

**Files:**
- Modify: `CLAUDE.md`, `HANDOFF.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a public repository without references to unrelated private projects, with no secrets in the tree or history, and a current handoff.

- [ ] **Step 1: Remove references to unrelated private projects**

In `CLAUDE.md`, replace the bullet that starts with `This is a product for other businesses. It is separate from` (three lines, naming two other project folders) with:

```markdown
- This is a product for other businesses. Never read or copy real financial data from any other project or
  source into this repository.
```

In `HANDOFF.md`:
- Delete the bullet `Separate from ../Business Finance/ (Bold Boost's own books). No shared data.`
- Delete the bullet starting `No workspace-wide stack convention exists.` and its continuation line naming other dashboards.
- Replace the GitHub account bullet's second line (naming the other signed-in GitHub accounts) with `Other GitHub accounts may be signed in to gh on the maintainer's Mac; always load the token file.`
- Delete the sentence `Never commit with darko@boldboost.us.` and keep the noreply identity line.

Then confirm nothing remains:

```bash
git grep -n -i -E 'bold ?boost|aifactory|digital corner|business finance/|instagram outreach|influencers infra' -- . ':!docs/plans'
```

Expected: no output. (The plan file mentions this step itself, so it is excluded.)

- [ ] **Step 2: Scan the tree and the full history for secrets**

```bash
git grep -n -E 'sbp_[a-f0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|vcp_[A-Za-z0-9]{20,}' $(git rev-list --all) || echo "no secrets found"
```

Expected: `no secrets found`. If anything matches, stop: revoke that token in its service immediately and tell Darko before doing anything else.

```bash
git ls-files | grep -E '(^|/)\.env' | grep -v '^\.env\.example$' || echo "no env files tracked"
```

Expected: `no env files tracked`.

- [ ] **Step 3: Update the handoff**

Rewrite `HANDOFF.md` "Current focus", "Next actions", and "Verification / commands" to describe the shipped state: version 1 live at the production domain, CI deploying on every push to `main`, the commands from `CLAUDE.md`, and any follow-ups found during the build. Move the completed design flow list into a dated file `docs/history/2026-10-15-design-and-build.md`.

- [ ] **Step 4: Commit and push**

```bash
git add CLAUDE.md HANDOFF.md docs/history
git commit -m "Prepare repository for public launch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```bash
git push
```

Expected: CI runs green and redeploys. Note for Darko: earlier commits still contain the old references in history, because the repository was already public; removing them from history would need a force push, which is out of scope unless he asks.
