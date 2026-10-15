import { Badge } from '@/components/ui/badge';
import type { DisplayStatus } from '@/lib/finance/types';
import { cn } from '@/lib/utils';

const STYLES: Record<DisplayStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const style = STYLES[status];
  return (
    <Badge variant="secondary" className={cn('font-medium', style.className)}>
      {style.label}
    </Badge>
  );
}
