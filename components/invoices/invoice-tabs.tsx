import Link from 'next/link';
import { INVOICE_TABS, type InvoiceTab } from '@/lib/finance/filters';
import { withRange } from '@/lib/finance/range-query';
import type { DateRange } from '@/lib/finance/types';
import { cn } from '@/lib/utils';

export function InvoiceTabs({ range, active, counts }: { range: DateRange; active: InvoiceTab; counts: Record<InvoiceTab, number> }) {
  return (
    <nav aria-label="Invoice status" className="flex gap-1 overflow-x-auto border-b">
      {INVOICE_TABS.map((tab) => (
        <Link
          key={tab.value}
          href={withRange('/invoices', range, { status: tab.value === 'all' ? undefined : tab.value })}
          aria-current={tab.value === active ? 'page' : undefined}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground',
            tab.value === active && 'border-primary font-medium text-foreground',
          )}
        >
          {tab.label} <span className="tabular-nums">({counts[tab.value]})</span>
        </Link>
      ))}
    </nav>
  );
}
