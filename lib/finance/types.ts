export type TransactionKind = 'income' | 'expense';
export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type DisplayStatus = InvoiceStatus | 'overdue';

/** Inclusive calendar date range, both ends `YYYY-MM-DD`. */
export interface DateRange {
  from: string;
  to: string;
}

export interface Category {
  id: string;
  kind: TransactionKind;
  name: string;
}

export interface Transaction {
  id: string;
  kind: TransactionKind;
  date: string;
  amountCents: number;
  categoryId: string;
  counterparty: string;
  note: string | null;
  invoiceId: string | null;
}

export interface InvoiceSummary {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidDate: string | null;
  notes: string | null;
  totalCents: number;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  position: number;
}
