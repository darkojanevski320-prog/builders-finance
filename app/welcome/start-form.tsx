'use client';

import { Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { startDemo } from './actions';

export function StartForm() {
  const [state, action, pending] = useActionState(startDemo, null);
  return (
    <form action={action} className="grid gap-3">
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Open your demo copy
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
