import { Suspense, type ReactNode } from 'react';
import { Sidebar } from '@/components/shell/sidebar';
import { TopBar } from '@/components/shell/top-bar';
import { requireSandbox } from '@/lib/data/sandbox';
import { todayISO } from '@/lib/finance/dates';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sandbox = await requireSandbox();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b bg-muted/30 p-4 md:border-r md:border-b-0">
        <p className="font-semibold">Builders Finance</p>
        <p className="mb-4 text-sm text-muted-foreground">{sandbox.businessName}</p>
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-col">
        <TopBar today={todayISO()} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
