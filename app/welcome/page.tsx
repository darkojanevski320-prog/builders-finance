import { redirect } from 'next/navigation';
import { getSandboxState } from '@/lib/data/sandbox';
import { createClient } from '@/lib/supabase/server';
import { StartForm } from './start-form';

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const supabase = await createClient();
  if ((await getSandboxState(supabase)).kind === 'ready') redirect('/');
  const { expired } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Builders Finance</p>
        <h1 className="text-3xl font-semibold tracking-tight">See where your money goes</h1>
        <p className="text-muted-foreground">
          Income, expenses, and unpaid invoices for a sample small business, on one dashboard. You get your own private
          copy to edit. Nothing you do affects anyone else.
        </p>
      </div>
      {expired === '1' ? (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Your demo copy expired. Open a new one.
        </p>
      ) : null}
      <StartForm />
      <p className="text-xs text-muted-foreground">All data is made up. Demo copies are deleted after 7 days.</p>
    </main>
  );
}
