import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarkPaidForm } from '@/components/invoices/mark-paid-form';
import { MarkSentButton } from '@/components/invoices/mark-sent-button';
import { StatusBadge } from '@/components/invoices/status-badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getInvoice } from '@/lib/data/invoices';
import { requireSandbox } from '@/lib/data/sandbox';
import { todayISO } from '@/lib/finance/dates';
import { formatDisplayDate } from '@/lib/finance/format';
import { formatCents, lineTotalCents } from '@/lib/finance/money';
import { displayStatus } from '@/lib/finance/summary';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const sandbox = await requireSandbox();
  const { id } = await params;
  const today = todayISO();
  const result = await getInvoice(sandbox.supabase, id);
  if (!result) notFound();
  const { invoice, items } = result;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/invoices" className="text-sm text-muted-foreground hover:underline">
        Back to invoices
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.number}</h1>
          <p className="text-muted-foreground">{invoice.clientName}</p>
        </div>
        <StatusBadge status={displayStatus(invoice.status, invoice.dueDate, today)} />
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Issued</dt>
          <dd>{formatDisplayDate(invoice.issueDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Due</dt>
          <dd>{formatDisplayDate(invoice.dueDate)}</dd>
        </div>
        {invoice.paidDate ? (
          <div>
            <dt className="text-muted-foreground">Paid</dt>
            <dd>{formatDisplayDate(invoice.paidDate)}</dd>
          </div>
        ) : null}
      </dl>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.description}</TableCell>
              <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(item.unitPriceCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(lineTotalCents(item.quantity, item.unitPriceCents))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right tabular-nums" data-testid="invoice-total">
              {formatCents(invoice.totalCents)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      {invoice.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{invoice.notes}</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        {invoice.status === 'draft' ? <MarkSentButton invoiceId={invoice.id} /> : null}
        {invoice.status === 'sent' ? <MarkPaidForm invoiceId={invoice.id} today={today} minDate={invoice.issueDate} withDate /> : null}
      </div>
    </div>
  );
}
