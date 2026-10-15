import type { Category, InvoiceItem, InvoiceStatus, InvoiceSummary, Transaction, TransactionKind } from '@/lib/finance/types';

export const TRANSACTION_COLUMNS = 'id, kind, date, amount_cents, category_id, counterparty, note, invoice_id';
export const INVOICE_SUMMARY_COLUMNS = 'id, number, client_id, client_name, issue_date, due_date, status, paid_date, notes, total_cents';
export const INVOICE_ITEM_COLUMNS = 'id, description, quantity, unit_price_cents, position';

// Postgres bigint and numeric can arrive as strings, so every number goes through Number().
type Numeric = number | string;

export interface TransactionRow {
  id: string;
  kind: TransactionKind;
  date: string;
  amount_cents: Numeric;
  category_id: string;
  counterparty: string;
  note: string | null;
  invoice_id: string | null;
}

export interface CategoryRow {
  id: string;
  kind: TransactionKind;
  name: string;
}

export interface InvoiceSummaryRow {
  id: string;
  number: string;
  client_id: string;
  client_name: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  paid_date: string | null;
  notes: string | null;
  total_cents: Numeric;
}

export interface InvoiceItemRow {
  id: string;
  description: string;
  quantity: Numeric;
  unit_price_cents: Numeric;
  position: number;
}

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    kind: row.kind,
    date: row.date,
    amountCents: Number(row.amount_cents),
    categoryId: row.category_id,
    counterparty: row.counterparty,
    note: row.note,
    invoiceId: row.invoice_id,
  };
}

export function toCategory(row: CategoryRow): Category {
  return { id: row.id, kind: row.kind, name: row.name };
}

export function toInvoiceSummary(row: InvoiceSummaryRow): InvoiceSummary {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: row.client_name,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
    paidDate: row.paid_date,
    notes: row.notes,
    totalCents: Number(row.total_cents),
  };
}

export function toInvoiceItem(row: InvoiceItemRow): InvoiceItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPriceCents: Number(row.unit_price_cents),
    position: row.position,
  };
}
