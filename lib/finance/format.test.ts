import { describe, expect, it } from 'vitest';
import { dueLabel, formatDisplayDate } from './format';

describe('formatDisplayDate', () => {
  it('shows the stored calendar date regardless of the local time zone', () => {
    expect(formatDisplayDate('2026-10-15')).toBe('Oct 15, 2026');
    expect(formatDisplayDate('2027-01-01')).toBe('Jan 1, 2027');
  });
});

describe('dueLabel', () => {
  it.each([
    [12, 'Overdue 12 days'],
    [1, 'Overdue 1 day'],
    [0, 'Due today'],
    [-1, 'Due tomorrow'],
    [-5, 'Due in 5 days'],
  ])('labels %i days from due as %j', (days, label) => {
    expect(dueLabel(days)).toBe(label);
  });
});
