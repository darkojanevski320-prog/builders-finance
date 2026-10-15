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
