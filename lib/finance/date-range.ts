import { addMonths, isValidISODate, startOfMonth } from './dates';
import type { DateRange } from './types';

export const RANGE_PRESETS = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-3-months', label: 'Last 3 months' },
  { value: 'last-12-months', label: 'Last 12 months' },
  { value: 'year-to-date', label: 'Year to date' },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]['value'];

export const DEFAULT_PRESET: RangePreset = 'last-12-months';

export function presetRange(preset: RangePreset, today: string): DateRange {
  switch (preset) {
    case 'this-month':
      return { from: startOfMonth(today), to: today };
    case 'last-3-months':
      return { from: startOfMonth(addMonths(today, -2)), to: today };
    case 'last-12-months':
      return { from: startOfMonth(addMonths(today, -11)), to: today };
    case 'year-to-date':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** Reads ?from=&to= from the URL. Anything invalid falls back to the default preset. */
export function parseRangeParams(params: Record<string, string | string[] | undefined>, today: string): DateRange {
  const { from, to } = params;
  if (typeof from === 'string' && typeof to === 'string' && isValidISODate(from) && isValidISODate(to) && from <= to) {
    return { from, to };
  }
  return presetRange(DEFAULT_PRESET, today);
}

export function matchPreset(range: DateRange, today: string): RangePreset | 'custom' {
  const match = RANGE_PRESETS.find(({ value }) => {
    const preset = presetRange(value, today);
    return preset.from === range.from && preset.to === range.to;
  });
  return match ? match.value : 'custom';
}
