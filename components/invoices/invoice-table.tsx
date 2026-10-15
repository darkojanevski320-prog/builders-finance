import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDisplayDate } from '@/lib/finance/format';
import { formatCents } from '@/lib/finance/money';
import { displayStatus } from '@/lib/finance/summary';
import type { InvoiceSummary } from '@/lib/finance/types';
import { StatusBadge } from './status-badge';

export function InvoiceTable({ invoices, today }: { invoices: InvoiceSummary[]; today: string }) {
  if (invoices.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No invoices in this date range</p>;
  }
  return (
    <Table data-testid="invoice-table">
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Client</TableHead>
          <TableHead className="hidden sm:table-cell">Issued</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline">
                {invoice.number}
              </Link>
            </TableCell>
            <TableCell className="max-w-48 truncate">{invoice.clientName}</TableCell>
            <TableCell className="hidden whitespace-nowrap sm:table-cell">{formatDisplayDate(invoice.issueDate)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDisplayDate(invoice.dueDate)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCents(invoice.totalCents)}</TableCell>
            <TableCell>
              <StatusBadge status={displayStatus(invoice.status, invoice.dueDate, today)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
