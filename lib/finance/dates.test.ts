import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, daysInMonth, diffDays, endOfMonth, fromUTCDate, isValidISODate,
  monthKey, monthsBetween, startOfMonth, toUTCDate, todayISO,
} from './dates';

describe('isValidISODate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidISODate('2026-10-15')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
  });
  it('rejects impossible or malformed dates', () => {
    for (const v of ['2026-02-29', '2026-13-01', '2026-10-32', '2026-1-05', '15-10-2026', '', 'abc']) {
      expect(isValidISODate(v)).toBe(false);
    }
  });
});

describe('UTC round trip', () => {
  it('never shifts a date in a non-UTC time zone', () => {
    for (const iso of ['2026-01-01', '2026-03-08', '2026-11-01', '2026-12-31']) {
      expect(fromUTCDate(toUTCDate(iso))).toBe(iso);
    }
  });
  it('todayISO uses the UTC calendar date', () => {
    // 2026-10-15 23:30 in Honolulu is 2026-10-16 09:30 UTC.
    expect(todayISO(new Date('2026-10-16T09:30:00Z'))).toBe('2026-10-16');
  });
  it('toUTCDate throws on invalid input', () => {
    expect(() => toUTCDate('2026-02-30')).toThrow('Invalid date: 2026-02-30');
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('adds months and clamps to the month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-10-15', -17)).toBe('2025-05-15');
  });
  it('finds month boundaries', () => {
    expect(startOfMonth('2026-10-15')).toBe('2026-10-01');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(daysInMonth('2026-04-03')).toBe(30);
  });
  it('computes day differences and month keys', () => {
    expect(diffDays('2026-10-15', '2026-10-01')).toBe(14);
    expect(diffDays('2026-03-09', '2026-03-08')).toBe(1);
    expect(monthKey('2026-10-15')).toBe('2026-10');
  });
  it('lists months between two dates inclusive', () => {
    expect(monthsBetween('2025-11-20', '2026-02-03')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsBetween('2026-10-01', '2026-10-31')).toEqual(['2026-10']);
  });
});
