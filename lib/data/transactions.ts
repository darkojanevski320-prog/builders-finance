import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DateRange, Transaction, TransactionKind } from '@/lib/finance/types';
import { fetchAll } from './fetch-all';
import { TRANSACTION_COLUMNS, toTransaction, type TransactionRow } from './rows';
import type { Sandbox } from './sandbox';

export interface NewTransaction {
  kind: TransactionKind;
  date: string;
  amountCents: number;
  categoryId: string;
  counterparty: string;
  note: string | null;
}

export async function listTransactions(supabase: SupabaseClient, range: DateRange, kind?: TransactionKind): Promise<Transaction[]> {
  const rows = await fetchAll<TransactionRow>((from, to) => {
    let query = supabase.from('transactions').select(TRANSACTION_COLUMNS).gte('date', range.from).lte('date', range.to);
    if (kind) query = query.eq('kind', kind);
    return query.order('date', { ascending: false }).order('id').range(from, to);
  });
  return rows.map(toTransaction);
}

export function addTransaction(sandbox: Sandbox, input: NewTransaction) {
  return sandbox.supabase.from('transactions').insert({
    business_id: sandbox.businessId,
    kind: input.kind,
    date: input.date,
    amount_cents: input.amountCents,
    category_id: input.categoryId,
    counterparty: input.counterparty,
    note: input.note,
  });
}
