'use client';

import { Loader2, Plus, Trash2 } from 'lucide-react';
import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { createInvoiceAction } from '@/app/(app)/actions';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { addDays } from '@/lib/finance/dates';
import { formatCents, invoiceTotalCents, parseMoneyToCents, parseQuantity } from '@/lib/finance/money';
import { fieldErrors, formString } from '@/lib/validation/form';
import { invoiceSchema } from '@/lib/validation/schemas';

interface ItemDraft {
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_ITEM: ItemDraft = { description: '', quantity: '1', unitPrice: '' };
const MAX_ITEMS = 20;

export function NewInvoiceSheet({ clientNames, today }: { clientNames: string[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([EMPTY_ITEM]);
  // On success the action redirects to the new invoice, so only errors come back here.
  const [state, action, pending] = useActionState(createInvoiceAction, null);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const errors = clientErrors ?? (state && !state.ok ? (state.fieldErrors ?? {}) : {});

  const previewCents = invoiceTotalCents(
    items.flatMap((item) => {
      const quantity = parseQuantity(item.quantity);
      const unitPriceCents = parseMoneyToCents(item.unitPrice);
      return quantity !== null && unitPriceCents !== null ? [{ quantity, unitPriceCents }] : [];
    }),
  );

  function update(index: number, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const form = new FormData(event.currentTarget, submitter);
    form.set('items', JSON.stringify(items));
    // Same schema as the server, run in the browser first.
    const check = invoiceSchema().safeParse({
      clientName: formString(form, 'clientName'),
      issueDate: formString(form, 'issueDate'),
      dueDate: formString(form, 'dueDate'),
      notes: formString(form, 'notes'),
      status: formString(form, 'status'),
      items,
    });
    if (!check.success) {
      setClientErrors(fieldErrors(check.error));
      return;
    }
    setClientErrors(null);
    startTransition(() => action(form));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus aria-hidden />
          New invoice
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New invoice</SheetTitle>
          <SheetDescription>Pick an existing client or type a new name.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} noValidate className="grid gap-4 px-4 pb-4">
          <Field label="Client" error={errors.clientName}>
            <Input name="clientName" list="client-names" placeholder="Northwind Cafe" maxLength={120} autoComplete="off" />
          </Field>
          <datalist id="client-names">
            {clientNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date" error={errors.issueDate}>
              <Input type="date" name="issueDate" defaultValue={today} />
            </Field>
            <Field label="Due date" error={errors.dueDate}>
              <Input type="date" name="dueDate" defaultValue={addDays(today, 30)} />
            </Field>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">Line items</legend>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_auto] items-start gap-2">
                <Field label="Description" error={errors[`items.${index}.description`]}>
                  <Input value={item.description} placeholder="Website design" maxLength={200} onChange={(e) => update(index, { description: e.target.value })} />
                </Field>
                <Field label="Quantity" error={errors[`items.${index}.quantity`]}>
                  <Input value={item.quantity} inputMode="decimal" onChange={(e) => update(index, { quantity: e.target.value })} />
                </Field>
                <Field label="Price" error={errors[`items.${index}.unitPrice`]}>
                  <Input value={item.unitPrice} inputMode="decimal" placeholder="250.00" onChange={(e) => update(index, { unitPrice: e.target.value })} />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={items.length === 1}
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            {errors.items ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.items}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              disabled={items.length >= MAX_ITEMS}
              onClick={() => setItems((current) => [...current, EMPTY_ITEM])}
            >
              <Plus aria-hidden />
              Add item
            </Button>
          </fieldset>

          <Field label="Notes (optional)" error={errors.notes}>
            <Textarea name="notes" rows={3} maxLength={500} />
          </Field>

          <p className="flex justify-between text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums" data-testid="invoice-preview-total">
              {formatCents(previewCents)}
            </span>
          </p>

          {state && !state.ok && !state.fieldErrors ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="status" value="draft" variant="outline" disabled={pending}>
              Save draft
            </Button>
            <Button type="submit" name="status" value="sent" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save and mark sent
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
