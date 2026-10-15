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
