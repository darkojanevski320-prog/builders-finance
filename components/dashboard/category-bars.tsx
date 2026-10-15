import { formatCents } from '@/lib/finance/money';

export function CategoryBars({ items }: { items: { categoryId: string; name: string; totalCents: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No expenses in this date range.</p>;
  const max = items[0].totalCents;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.categoryId}>
          <div className="flex justify-between gap-3 text-sm">
            <span>{item.name}</span>
            <span className="tabular-nums">{formatCents(item.totalCents, { whole: true })}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary/70" style={{ width: `${Math.max(2, (item.totalCents / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
