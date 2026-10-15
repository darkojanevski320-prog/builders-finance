import { describe, expect, it } from 'vitest';
import { withRange } from './range-query';

describe('withRange', () => {
  it('keeps the range and adds only non-empty extras', () => {
    const range = { from: '2026-01-01', to: '2026-03-31' };
    expect(withRange('/expenses', range)).toBe('/expenses?from=2026-01-01&to=2026-03-31');
    expect(withRange('/invoices', range, { status: 'overdue', q: undefined, vendor: '' })).toBe(
      '/invoices?from=2026-01-01&to=2026-03-31&status=overdue',
    );
  });
});
