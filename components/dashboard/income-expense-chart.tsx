'use client';

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCents } from '@/lib/finance/money';
import type { MonthPoint } from '@/lib/finance/summary';

// Fixed hues that read in light and dark mode; the theme's chart tokens are all grays.
const COLORS = { income: '#10b981', expenses: '#f43f5e', net: '#3b82f6' };

export function IncomeExpenseChart({ series }: { series: MonthPoint[] }) {
  const data = series.map((p) => ({
    label: p.label,
    Income: p.incomeCents / 100,
    Expenses: p.expenseCents / 100,
    'Net profit': p.netCents / 100,
  }));

  return (
    <div className="h-72 w-full" role="img" aria-label="Monthly income, expenses, and net profit">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.3} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={56} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(value) => formatCents(Math.round(Number(value) * 100))} />
          <Legend />
          <Bar dataKey="Income" fill={COLORS.income} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Expenses" fill={COLORS.expenses} radius={[3, 3, 0, 0]} />
          <Line dataKey="Net profit" stroke={COLORS.net} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
