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
