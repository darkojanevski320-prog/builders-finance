import { describe, expect, it } from 'vitest';
import { formatCents, invoiceTotalCents, lineTotalCents, parseMoneyToCents, parseQuantity } from './money';

describe('parseMoneyToCents', () => {
  it.each([
    ['12', 1200], ['12.3', 1230], ['12.30', 1230], [' 12.05 ', 1205], ['$12', 1200],
    ['1,234.50', 123450], ['$1,234,567', 123456700], ['0.01', 1], ['0', 0],
  ])('parses %j as %i cents', (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it.each(['', ' ', '-5', '12.345', 'abc', '1e5', '12,34', '1,2345.00', '$', '.5', '12.', '1234567890'])(
    'rejects %j',
    (input) => {
      expect(parseMoneyToCents(input)).toBeNull();
    },
  );
});

describe('formatCents', () => {
  it('formats US dollars with cents', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(-5000)).toBe('-$50.00');
  });
  it('formats whole dollars when asked', () => {
    expect(formatCents(123456, { whole: true })).toBe('$1,235');
  });
});

describe('parseQuantity', () => {
  it.each([['1', 1], ['1.5', 1.5], ['2.25', 2.25], [' 3 ', 3]])('parses %j', (input, q) => {
    expect(parseQuantity(input)).toBe(q);
  });
  it.each(['0', '-1', '1.234', 'abc', '', '10000'])('rejects %j', (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe('invoice math', () => {
  it('rounds each line half away from zero, like Postgres round()', () => {
    expect(lineTotalCents(1.5, 3333)).toBe(5000);
    expect(lineTotalCents(0.33, 1000)).toBe(330);
    expect(lineTotalCents(2.25, 1999)).toBe(4498); // 4497.75
  });
  it('sums rounded lines', () => {
    expect(invoiceTotalCents([
      { quantity: 1.5, unitPriceCents: 3333 },
      { quantity: 1, unitPriceCents: 10000 },
    ])).toBe(15000);
    expect(invoiceTotalCents([])).toBe(0);
  });
});
