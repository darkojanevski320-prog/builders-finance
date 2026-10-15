'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionResult, FormState } from '@/lib/actions/result';
import { toUserMessage, type DbErrorLike } from '@/lib/data/errors';
import { createInvoice, markInvoicePaid, markInvoiceSent } from '@/lib/data/invoices';
import { requireSandbox } from '@/lib/data/sandbox';
import { loadSampleData } from '@/lib/data/sample';
import { addTransaction } from '@/lib/data/transactions';
import { todayISO } from '@/lib/finance/dates';
import { fieldErrors, formString, parseItemsJson } from '@/lib/validation/form';
import { invoiceIdSchema, invoiceSchema, markPaidSchema, transactionSchema } from '@/lib/validation/schemas';

const CHECK_FIELDS = 'Check the highlighted fields.';

function failure(error: DbErrorLike, action: string): ActionResult {
  // Log the code for debugging; never show raw database errors to visitors.
  console.error(`[${action}] failed`, { code: error.code, message: error.message });
  return { ok: false, message: toUserMessage(error) };
}

export async function addTransactionAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const parsed = transactionSchema(todayISO()).safeParse({
    kind: formString(form, 'kind'),
    date: formString(form, 'date'),
    counterparty: formString(form, 'counterparty'),
    categoryId: formString(form, 'categoryId'),
    amount: formString(form, 'amount'),
    note: formString(form, 'note'),
  });
  if (!parsed.success) return { ok: false, message: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };

  const { kind, date, counterparty, categoryId, amount, note } = parsed.data;
  const { error } = await addTransaction(sandbox, { kind, date, counterparty, categoryId, amountCents: amount, note });
  if (error) return failure(error, 'addTransaction');

  revalidatePath('/', 'layout');
  return { ok: true, message: kind === 'income' ? 'Income added' : 'Expense added' };
}

export async function createInvoiceAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const parsed = invoiceSchema().safeParse({
    clientName: formString(form, 'clientName'),
    issueDate: formString(form, 'issueDate'),
    dueDate: formString(form, 'dueDate'),
    notes: formString(form, 'notes'),
    status: formString(form, 'status'),
    items: parseItemsJson(formString(form, 'items')),
  });
  if (!parsed.success) return { ok: false, message: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };

  const { data: invoiceId, error } = await createInvoice(sandbox, {
    ...parsed.data,
    items: parsed.data.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPriceCents: i.unitPrice })),
  });
  if (error) return failure(error, 'createInvoice');

  revalidatePath('/', 'layout');
  redirect(`/invoices/${invoiceId}`);
}

export async function markInvoiceSentAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const parsed = invoiceIdSchema.safeParse({ invoiceId: formString(form, 'invoiceId') });
  if (!parsed.success) return { ok: false, message: "We couldn't find that invoice." };

  const { data, error } = await markInvoiceSent(sandbox.supabase, parsed.data.invoiceId);
  if (error) return failure(error, 'markInvoiceSent');
  if (!data || data.length === 0) return { ok: false, message: 'Only draft invoices can be marked sent.' };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Invoice marked sent' };
}

export async function markInvoicePaidAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const parsed = markPaidSchema(todayISO()).safeParse({
    invoiceId: formString(form, 'invoiceId'),
    paidDate: formString(form, 'paidDate'),
  });
  if (!parsed.success) return { ok: false, message: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };

  const { error } = await markInvoicePaid(sandbox.supabase, parsed.data.invoiceId, parsed.data.paidDate);
  if (error) return failure(error, 'markInvoicePaid');

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Invoice marked paid' };
}

export async function resetSampleDataAction(_prev: FormState, _form: FormData): Promise<ActionResult> {
  const sandbox = await requireSandbox();
  const { error } = await loadSampleData(sandbox.supabase, sandbox.businessId, todayISO());
  if (error) return failure(error, 'resetSampleData');

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Sample data restored' };
}
