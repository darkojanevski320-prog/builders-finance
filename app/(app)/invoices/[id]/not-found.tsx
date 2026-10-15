import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function InvoiceNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h2 className="text-lg font-semibold">We couldn&apos;t find that invoice</h2>
      <p className="text-sm text-muted-foreground">It may belong to an older demo copy.</p>
      <Button asChild variant="outline">
        <Link href="/invoices">Back to invoices</Link>
      </Button>
    </div>
  );
}
