'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { matchPreset, parseRangeParams, presetRange, RANGE_PRESETS, type RangePreset } from '@/lib/finance/date-range';
import type { DateRange } from '@/lib/finance/types';

export function DateRangePicker({ today }: { today: string }) {
  const params = useSearchParams();
  const range = parseRangeParams({ from: params.get('from') ?? undefined, to: params.get('to') ?? undefined }, today);
  // Remount when the URL range changes so the custom inputs start from the current range.
  return <RangeControls key={`${range.from}:${range.to}`} range={range} today={today} />;
}

function RangeControls({ range, today }: { range: DateRange; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const preset = matchPreset(range, today);
  const [showCustom, setShowCustom] = useState(preset === 'custom');
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  function go(next: DateRange) {
    const query = new URLSearchParams(params.toString());
    query.set('from', next.from);
    query.set('to', next.to);
    router.push(`${pathname}?${query.toString()}`);
  }

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (from && to && from <= to) go({ from, to });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Date range</span>
        <NativeSelect
          value={showCustom ? 'custom' : preset}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'custom') {
              setShowCustom(true);
              return;
            }
            setShowCustom(false);
            go(presetRange(value as RangePreset, today));
          }}
          className="w-44"
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom range</option>
        </NativeSelect>
      </label>
      {showCustom ? (
        <form onSubmit={applyCustom} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <Input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">To</span>
            <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
          <Button type="submit" variant="secondary">Apply</Button>
          {from > to ? <p className="w-full text-sm text-destructive">The start date must be before the end date.</p> : null}
        </form>
      ) : null}
    </div>
  );
}
