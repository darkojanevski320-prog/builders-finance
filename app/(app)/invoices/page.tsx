import { InvoiceTable } from '@/components/invoices/invoice-table';
import { InvoiceTabs } from '@/components/invoices/invoice-tabs';
import { NewInvoiceSheet } from '@/components/invoices/new-invoice-sheet';
import { PageHeader } from '@/components/shell/page-header';
import { listClientNames } from '@/lib/data/clients';
import { listInvoices } from '@/lib/data/invoices';
import { requireSandbox } from '@/lib/data/sandbox';
import { parseRangeParams } from '@/lib/finance/date-range';
import { todayISO } from '@/lib/finance/dates';
import { filterInvoicesByTab, INVOICE_TABS, parseInvoiceTab, type InvoiceTab } from '@/lib/finance/filters';
import { firstParam } from '@/lib/finance/params';

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sandbox = await requireSandbox();
  const params = await searchParams;
  const today = todayISO();
  const range = parseRangeParams(params, today);
  const tab = parseInvoiceTab(firstParam(params.status));

  const [invoices, clientNames] = await Promise.all([
    listInvoices(sandbox.supabase, { issuedIn: range }),
    listClientNames(sandbox.supabase),
  ]);
  const counts = Object.fromEntries(
    INVOICE_TABS.map((t) => [t.value, filterInvoicesByTab(invoices, t.value, today).length]),
  ) as Record<InvoiceTab, number>;

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" actions={<NewInvoiceSheet clientNames={clientNames} today={today} />} />
      <InvoiceTabs range={range} active={tab} counts={counts} />
      <InvoiceTable invoices={filterInvoicesByTab(invoices, tab, today)} today={today} />
    </div>
  );
}
