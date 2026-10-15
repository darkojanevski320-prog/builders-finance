import { Card } from '@/components/ui/card';
import { formatCents } from '@/lib/finance/money';
import type { totals as totalsFn } from '@/lib/finance/summary';
import { cn } from '@/lib/utils';

type Totals = ReturnType<typeof totalsFn>;

export function KpiTiles({ totals, receivables }: { totals: Totals; receivables: { owedCents: number; overdueCents: number } }) {
  const tiles = [
    { id: 'income', label: 'Income', cents: totals.incomeCents, detail: null, tone: null },
    { id: 'expenses', label: 'Expenses', cents: totals.expenseCents, detail: null, tone: null },
    {
      id: 'net', label: 'Net profit', cents: totals.netCents,
      detail: totals.marginPct === null ? 'No income in this range' : `${totals.marginPct}% margin`,
      tone: totals.netCents < 0 ? 'negative' : 'positive',
    },
    {
      id: 'owed', label: 'Owed to you', cents: receivables.owedCents,
      detail: `${formatCents(receivables.overdueCents, { whole: true })} overdue`,
      tone: receivables.overdueCents > 0 ? 'negative' : null,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.id} data-testid={`tile-${tile.id}`} data-cents={tile.cents} className="gap-1 p-4">
          <p className="text-sm text-muted-foreground">{tile.label}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCents(tile.cents, { whole: true })}</p>
          {tile.detail ? (
            <p className={cn('text-sm', tile.tone === 'negative' && 'text-destructive', tile.tone === 'positive' && 'text-emerald-700 dark:text-emerald-400')}>
              {tile.detail}
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
