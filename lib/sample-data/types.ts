import type { InvoiceStatus, TransactionKind } from '@/lib/finance/types';

// Plain JSON sent to the load_sample_data database function. Keys link rows
// together; the database replaces them with real ids.

export interface SampleCategory {
  key: string;
  kind: TransactionKind;
  name: string;
}

export interface SampleClient {
  key: string;
  name: string;
  email: string;
}

export interface SampleInvoiceItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface SampleInvoice {
  key: string;
  number: string;
  clientKey: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidDate: string | null;
  notes: string | null;
  items: SampleInvoiceItem[];
}

export interface SampleTransaction {
  kind: TransactionKind;
  date: string;
  amountCents: number;
  categoryKey: string;
  counterparty: string;
  note: string | null;
  invoiceKey: string | null;
}

export interface SampleBusiness {
  name: string;
  categories: SampleCategory[];
  clients: SampleClient[];
  invoices: SampleInvoice[];
  transactions: SampleTransaction[];
}
