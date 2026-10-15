import type { DateRange } from './types';

/** Builds a link that keeps the selected date range, for example `/expenses?from=...&to=...`. */
export function withRange(path: string, range: DateRange, extra: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  for (const [key, value] of Object.entries(extra)) {
    if (value) query.set(key, value);
  }
  return `${path}?${query.toString()}`;
}
