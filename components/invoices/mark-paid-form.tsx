'use client';

import { Loader2 } from 'lucide-react';
import { startTransition, useActionState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { markInvoicePaidAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FormState } from '@/lib/actions/result';

export function MarkPaidForm({
  invoiceId, today, minDate, withDate = false,
}: { invoiceId: string; today: string; minDate?: string; withDate?: boolean }) {
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await markInvoicePaidAction(prev, form);
    if (result.ok) toast.success(result.message ?? 'Invoice marked paid');
    else toast.error(result.message);
    return result;
  }, null);

  // Submitting through a transition keeps typed values if the server rejects them.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  }

  const dateError = state && !state.ok ? state.fieldErrors?.paidDate : undefined;

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {withDate ? (
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Payment date</span>
          <Input type="date" name="paidDate" defaultValue={today} min={minDate} max={today} required />
        </label>
      ) : (
        <input type="hidden" name="paidDate" value={today} />
      )}
      <Button type="submit" size="sm" variant={withDate ? 'default' : 'outline'} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Mark paid
      </Button>
      {dateError ? <p className="w-full text-sm text-destructive">{dateError}</p> : null}
    </form>
  );
}
