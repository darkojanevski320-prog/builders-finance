import { Suspense } from 'react';
import { DateRangePicker } from './date-range-picker';
import { ResetButton } from './reset-button';
import { ThemeToggle } from './theme-toggle';

export function TopBar({ today }: { today: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3 md:px-6">
      <Suspense fallback={null}>
        <DateRangePicker today={today} />
      </Suspense>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>This is your private demo copy</span>
        <ResetButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
