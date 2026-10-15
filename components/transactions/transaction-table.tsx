import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDisplayDate } from '@/lib/finance/format';
import { formatCents } from '@/lib/finance/money';
import type { Category, Transaction, TransactionKind } from '@/lib/finance/types';

export function TransactionTable({
  kind, rows, categories, emptyMessage, clearHref,
}: { kind: TransactionKind; rows: Transaction[]; categories: Category[]; emptyMessage: string; clearHref: string | null }) {
  if (rows.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {clearHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={clearHref}>Clear filters</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const names = new Map(categories.map((c) => [c.id, c.name]));
  const total = rows.reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}, total {formatCents(total)}
      </p>
      <Table data-testid="transaction-table">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>{kind === 'income' ? 'Source' : 'Vendor'}</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="hidden md:table-cell">Note</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{formatDisplayDate(row.date)}</TableCell>
              <TableCell className="max-w-56 truncate">{row.counterparty}</TableCell>
              <TableCell>{names.get(row.categoryId) ?? 'Uncategorized'}</TableCell>
              <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">{row.note}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(row.amountCents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
