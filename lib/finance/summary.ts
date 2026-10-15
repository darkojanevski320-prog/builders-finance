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
