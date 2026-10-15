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
