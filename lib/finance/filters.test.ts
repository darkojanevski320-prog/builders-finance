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
