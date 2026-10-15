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
