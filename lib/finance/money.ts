const PLAIN = /^\d{1,9}(\.\d{1,2})?$/;
const GROUPED = /^\d{1,3}(,\d{3}){1,2}(\.\d{1,2})?$/;
const QUANTITY = /^\d{1,4}(\.\d{1,2})?$/;

/** Parses user-typed dollars into integer cents without floating point math. */
export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, '');
  if (!PLAIN.test(trimmed) && !GROUPED.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.replace(/,/g, '').split('.');
  if (whole.length > 9) return null;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

const formatters = {
  cents: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  whole: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
};

export function formatCents(cents: number, opts: { whole?: boolean } = {}): string {
  return (opts.whole ? formatters.whole : formatters.cents).format(cents / 100);
}

/** Quantity above 0 and below 10,000 with at most 2 decimals. */
export function parseQuantity(input: string): number | null {
  const trimmed = input.trim();
  if (!QUANTITY.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** quantity x unit price, rounded half away from zero to match Postgres round(numeric). */
export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  const hundredths = Math.round(quantity * 100);
  return Math.round((hundredths * unitPriceCents) / 100);
}

export function invoiceTotalCents(items: { quantity: number; unitPriceCents: number }[]): number {
  return items.reduce((sum, item) => sum + lineTotalCents(item.quantity, item.unitPriceCents), 0);
}
