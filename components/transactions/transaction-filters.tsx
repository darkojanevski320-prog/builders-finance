import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { withRange } from '@/lib/finance/range-query';
import type { Category, DateRange, TransactionKind } from '@/lib/finance/types';

export function TransactionFilters({
  kind, range, categories, vendors, filters, hasFilters,
}: {
  kind: TransactionKind;
  range: DateRange;
  categories: Category[];
  vendors: string[];
  filters: { categoryId?: string; search?: string; vendor?: string };
  hasFilters: boolean;
}) {
  const path = kind === 'income' ? '/income' : '/expenses';
  return (
    <form method="get" action={path} role="search" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="from" value={range.from} />
      <input type="hidden" name="to" value={range.to} />
      <div className="w-48">
        <Field label="Category">
          <NativeSelect name="category" defaultValue={filters.categoryId ?? ''}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {kind === 'expense' ? (
        <div className="w-56">
          <Field label="Vendor">
            <NativeSelect name="vendor" defaultValue={filters.vendor ?? ''}>
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      ) : null}
      <div className="w-56">
        <Field label="Search">
          <Input name="q" type="search" defaultValue={filters.search ?? ''} placeholder={kind === 'income' ? 'Source or note' : 'Vendor or note'} />
        </Field>
      </div>
      <Button type="submit" variant="secondary">Apply filters</Button>
      {hasFilters ? (
        <Button asChild variant="ghost">
          <Link href={withRange(path, range)}>Clear filters</Link>
        </Button>
      ) : null}
    </form>
  );
}
