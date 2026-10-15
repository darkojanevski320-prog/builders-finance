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
