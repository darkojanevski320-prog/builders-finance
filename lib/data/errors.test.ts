import { describe, expect, it } from 'vitest';
import { GENERIC_SAVE_ERROR, isRateLimitError, RATE_LIMIT_MESSAGE, SANDBOX_EXPIRED_MESSAGE, toUserMessage } from './errors';

describe('toUserMessage', () => {
  it.each([
    [{ code: 'P0001', message: 'invoice_already_paid' }, 'This invoice is already paid.'],
    [{ code: 'P0001', message: 'invoice_is_draft' }, 'Mark this invoice sent before marking it paid.'],
    [{ code: 'P0001', message: 'paid_date_in_future' }, "The payment date can't be in the future."],
    [{ code: 'P0001', message: 'paid_date_before_issue' }, "The payment date can't be before the issue date."],
    [{ code: '22023', message: 'invoice_needs_items' }, 'Add at least one line item.'],
    [{ code: 'P0002', message: 'invoice_not_found' }, "We couldn't find that invoice."],
    [{ code: '42501', message: 'not_a_member' }, SANDBOX_EXPIRED_MESSAGE],
    [{ code: 'P0001', message: 'row_limit_reached' }, 'Your demo copy is full. Reset sample data to start over.'],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "invoices_business_id_number_key"' }, 'That invoice number is already used.'],
    [{ code: '23514', message: 'new row violates check constraint' }, "Some values aren't allowed. Check the form and try again."],
    [{ code: 'XX000', message: 'internal error with details' }, GENERIC_SAVE_ERROR],
    [{}, GENERIC_SAVE_ERROR],
  ])('maps %j', (error, message) => {
    expect(toUserMessage(error)).toBe(message);
  });
});

describe('isRateLimitError', () => {
  it('detects Supabase auth rate limits', () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ code: 'over_request_rate_limit' })).toBe(true);
    expect(isRateLimitError({ status: 400, code: 'validation_failed' })).toBe(false);
    expect(RATE_LIMIT_MESSAGE).toBe('Too many demo copies opened from your network. Try again in a few minutes.');
  });
});
