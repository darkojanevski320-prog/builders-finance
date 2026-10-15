'use client';

import { Loader2, Plus } from 'lucide-react';
import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { addTransactionAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { FormState } from '@/lib/actions/result';
import type { Category, TransactionKind } from '@/lib/finance/types';
import { fieldErrors, formString } from '@/lib/validation/form';
import { transactionSchema } from '@/lib/validation/schemas';

const COPY = {
  income: { button: 'Add income', counterparty: 'Source', placeholder: 'Northfield Public Library' },
  expense: { button: 'Add expense', counterparty: 'Vendor', placeholder: 'Pixelboard' },
} as const;

export function AddTransactionSheet({ kind, categories, today }: { kind: TransactionKind; categories: Category[]; today: string }) {
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await addTransactionAction(prev, form);
    if (result.ok) {
      toast.success(result.message ?? 'Saved');
      setOpen(false);
      setFormKey((key) => key + 1);
    }
    return result;
  }, null);

  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);

  // The browser runs the same schema as the server first, so most mistakes show instantly.
  // Submitting through a transition keeps the typed values when the server rejects them.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const check = transactionSchema(today).safeParse({
      kind,
      date: formString(form, 'date'),
      counterparty: formString(form, 'counterparty'),
      categoryId: formString(form, 'categoryId'),
      amount: formString(form, 'amount'),
      note: formString(form, 'note'),
    });
    if (!check.success) {
      setClientErrors(fieldErrors(check.error));
      return;
    }
    setClientErrors(null);
    startTransition(() => action(form));
  }

  const errors = clientErrors ?? (state && !state.ok ? (state.fieldErrors ?? {}) : {});

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus aria-hidden />
          {copy.button}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{copy.button}</SheetTitle>
          <SheetDescription>Saved to your private demo copy.</SheetDescription>
        </SheetHeader>
        <form key={formKey} onSubmit={submit} noValidate className="grid gap-4 px-4 pb-4">
          <input type="hidden" name="kind" value={kind} />
          <Field label="Date" error={errors.date}>
            <Input type="date" name="date" defaultValue={today} max={today} />
          </Field>
          <Field label={copy.counterparty} error={errors.counterparty}>
            <Input name="counterparty" placeholder={copy.placeholder} maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Category" error={errors.categoryId}>
            <NativeSelect name="categoryId" defaultValue="">
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Amount" error={errors.amount}>
            <Input name="amount" inputMode="decimal" placeholder="1,250.00" autoComplete="off" />
          </Field>
          <Field label="Note (optional)" error={errors.note}>
            <Textarea name="note" rows={3} maxLength={500} />
          </Field>
          {state && !state.ok && !state.fieldErrors ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
