'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">This screen couldn&apos;t load. Your data is safe.</p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
