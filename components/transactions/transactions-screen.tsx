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
