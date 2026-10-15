'use client';

import { Loader2, RotateCcw } from 'lucide-react';
import { useActionState, useState } from 'react';
import { toast } from 'sonner';
import { resetSampleDataAction } from '@/app/(app)/actions';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { FormState } from '@/lib/actions/result';

export function ResetButton() {
  const [open, setOpen] = useState(false);
  const [, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await resetSampleDataAction(prev, form);
    if (result.ok) {
      toast.success(result.message ?? 'Sample data restored');
      setOpen(false);
    } else {
      toast.error(result.message);
    }
    return result;
  }, null);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw aria-hidden />
          Reset sample data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset sample data?</AlertDialogTitle>
          <AlertDialogDescription>
            This replaces everything in your demo copy, including your edits, with fresh sample data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={action}>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Reset
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
