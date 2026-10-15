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
