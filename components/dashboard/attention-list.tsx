import Link from 'next/link';
import { MarkPaidForm } from '@/components/invoices/mark-paid-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dueLabel } from '@/lib/finance/format';
import { formatCents } from '@/lib/finance/money';
import type { AttentionItem } from '@/lib/finance/summary';

export function AttentionList({ items, today }: { items: AttentionItem[]; today: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing overdue or due in the next 14 days.</p>;
  }
  return (
    <Table data-testid="attention-list">
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Client</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="sr-only">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link href={`/invoices/${item.id}`} className="font-medium hover:underline">
                {item.number}
              </Link>
            </TableCell>
            <TableCell>{item.clientName}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCents(item.totalCents)}</TableCell>
            <TableCell className={item.displayStatus === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}>
              {dueLabel(item.daysFromDue)}
            </TableCell>
            <TableCell className="text-right">
              <MarkPaidForm invoiceId={item.id} today={today} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
