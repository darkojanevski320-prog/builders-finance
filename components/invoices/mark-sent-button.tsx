'use client';

import { Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { markInvoiceSentAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import type { FormState } from '@/lib/actions/result';

export function MarkSentButton({ invoiceId }: { invoiceId: string }) {
  const [, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await markInvoiceSentAction(prev, form);
    if (result.ok) toast.success(result.message ?? 'Invoice marked sent');
    else toast.error(result.message);
    return result;
  }, null);

  return (
    <form action={action}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Mark sent
      </Button>
    </form>
  );
}
