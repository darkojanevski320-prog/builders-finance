import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DateRange, InvoiceItem, InvoiceStatus, InvoiceSummary } from '@/lib/finance/types';
import { fetchAll } from './fetch-all';
import {
  INVOICE_ITEM_COLUMNS, INVOICE_SUMMARY_COLUMNS, toInvoiceItem, toInvoiceSummary,
  type InvoiceItemRow, type InvoiceSummaryRow,
} from './rows';
import type { Sandbox } from './sandbox';

export interface NewInvoice {
  clientName: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent';
  notes: string | null;
  items: { description: string; quantity: number; unitPriceCents: number }[];
}

export async function listInvoices(
  supabase: SupabaseClient,
  filters: { issuedIn?: DateRange; status?: InvoiceStatus } = {},
): Promise<InvoiceSummary[]> {
  const rows = await fetchAll<InvoiceSummaryRow>((from, to) => {
    let query = supabase.from('invoice_summaries').select(INVOICE_SUMMARY_COLUMNS);
    if (filters.issuedIn) query = query.gte('issue_date', filters.issuedIn.from).lte('issue_date', filters.issuedIn.to);
    if (filters.status) query = query.eq('status', filters.status);
    return query.order('issue_date', { ascending: false }).order('number', { ascending: false }).range(from, to);
  });
  return rows.map(toInvoiceSummary);
}

export async function getInvoice(
  supabase: SupabaseClient,
  id: string,
): Promise<{ invoice: InvoiceSummary; items: InvoiceItem[] } | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [invoiceResult, itemsResult] = await Promise.all([
    supabase.from('invoice_summaries').select(INVOICE_SUMMARY_COLUMNS).eq('id', id).maybeSingle<InvoiceSummaryRow>(),
    supabase.from('invoice_items').select(INVOICE_ITEM_COLUMNS).eq('invoice_id', id).order('position'),
  ]);
  if (invoiceResult.error) throw invoiceResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (!invoiceResult.data) return null;
  return {
    invoice: toInvoiceSummary(invoiceResult.data),
    items: (itemsResult.data as InvoiceItemRow[]).map(toInvoiceItem),
  };
}

export function createInvoice(sandbox: Sandbox, input: NewInvoice) {
  return sandbox.supabase.rpc('create_invoice', {
    p_business_id: sandbox.businessId,
    p_data: {
      clientName: input.clientName,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: input.status,
      notes: input.notes,
      items: input.items,
    },
  });
}

export function markInvoiceSent(supabase: SupabaseClient, id: string) {
  return supabase.from('invoices').update({ status: 'sent' }).eq('id', id).eq('status', 'draft').select('id');
}

export function markInvoicePaid(supabase: SupabaseClient, id: string, paidDate: string) {
  return supabase.rpc('mark_invoice_paid', { p_invoice_id: id, p_paid_date: paidDate });
}
