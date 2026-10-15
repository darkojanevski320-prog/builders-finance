// All dates are calendar dates as YYYY-MM-DD. Math runs on UTC midnight so the
// local time zone of the server or browser never shifts a date.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isValidISODate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function toUTCDate(iso: string): Date {
  if (!isValidISODate(iso)) throw new Error(`Invalid date: ${iso}`);
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function fromUTCDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date()): string {
  return fromUTCDate(now);
}

export function addDays(iso: string, days: number): string {
  const date = toUTCDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTCDate(date);
}

export function daysInMonth(iso: string): number {
  const date = toUTCDate(iso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function addMonths(iso: string, months: number): string {
  const date = toUTCDate(iso);
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = daysInMonth(fromUTCDate(firstOfTarget));
  firstOfTarget.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return fromUTCDate(firstOfTarget);
}

export function startOfMonth(iso: string): string {
  toUTCDate(iso);
  return `${iso.slice(0, 8)}01`;
}

export function endOfMonth(iso: string): string {
  return `${iso.slice(0, 8)}${String(daysInMonth(iso)).padStart(2, '0')}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTCDate(a).getTime() - toUTCDate(b).getTime()) / DAY_MS);
}

export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let cursor = startOfMonth(from); cursor <= to; cursor = addMonths(cursor, 1)) {
    months.push(monthKey(cursor));
  }
  return months;
}
