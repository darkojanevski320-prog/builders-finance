import { AttentionList } from '@/components/dashboard/attention-list';
import { CategoryBars } from '@/components/dashboard/category-bars';
import { EmptyBusiness } from '@/components/dashboard/empty-business';
import { IncomeExpenseChart } from '@/components/dashboard/income-expense-chart';
import { KpiTiles } from '@/components/dashboard/kpi-tiles';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { getDashboard } from '@/lib/data/dashboard';
import { requireSandbox } from '@/lib/data/sandbox';
import { parseRangeParams } from '@/lib/finance/date-range';
import { todayISO } from '@/lib/finance/dates';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sandbox = await requireSandbox();
  const today = todayISO();
  const range = parseRangeParams(await searchParams, today);
  const data = await getDashboard(sandbox.supabase, range, today);

  if (data.isEmpty) return <EmptyBusiness />;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />
      <KpiTiles totals={data.totals} receivables={data.receivables} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Income and expenses by month</h2>
          <IncomeExpenseChart series={data.series} />
        </Card>
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Expenses by category</h2>
          <CategoryBars items={data.byCategory} />
        </Card>
      </div>
      <Card className="gap-3 p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Needs attention</h2>
        <AttentionList items={data.attention} today={today} />
      </Card>
    </div>
  );
}
