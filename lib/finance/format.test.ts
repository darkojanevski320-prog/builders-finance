import { describe, expect, it } from 'vitest';
import { formatDisplayDate } from './format';

describe('formatDisplayDate', () => {
  it('shows the stored calendar date regardless of the local time zone', () => {
    expect(formatDisplayDate('2026-10-15')).toBe('Oct 15, 2026');
    expect(formatDisplayDate('2027-01-01')).toBe('Jan 1, 2027');
  });
});
