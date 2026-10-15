'use client';

import { Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { resetSampleDataAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { FormState } from '@/lib/actions/result';

export function EmptyBusiness() {
  const [, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await resetSampleDataAction(prev, form);
    if (!result.ok) toast.error(result.message);
    return result;
  }, null);

  return (
    <Card className="mx-auto max-w-md items-center gap-3 p-8 text-center">
      <h2 className="text-lg font-semibold">Load the sample business</h2>
      <p className="text-sm text-muted-foreground">Your demo copy is empty. Load 18 months of sample income, expenses, and invoices.</p>
      <form action={action}>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Load sample data
        </Button>
      </form>
    </Card>
  );
}
