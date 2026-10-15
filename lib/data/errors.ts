export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number;
}

export const GENERIC_SAVE_ERROR = "Couldn't save. Try again.";
export const SANDBOX_EXPIRED_MESSAGE = 'Your demo copy expired. Open a new one.';
export const RATE_LIMIT_MESSAGE = 'Too many demo copies opened from your network. Try again in a few minutes.';

// Keys raised by the database functions in supabase/migrations/*_functions.sql.
const BY_MESSAGE: Record<string, string> = {
  invoice_already_paid: 'This invoice is already paid.',
  invoice_is_draft: 'Mark this invoice sent before marking it paid.',
  paid_date_in_future: "The payment date can't be in the future.",
  paid_date_before_issue: "The payment date can't be before the issue date.",
  invoice_total_zero: 'This invoice has no amount to pay.',
  invoice_needs_items: 'Add at least one line item.',
  client_required: 'Enter a client name.',
  invalid_status: GENERIC_SAVE_ERROR,
  invoice_not_found: "We couldn't find that invoice.",
  row_limit_reached: 'Your demo copy is full. Reset sample data to start over.',
  not_a_member: SANDBOX_EXPIRED_MESSAGE,
  not_authenticated: SANDBOX_EXPIRED_MESSAGE,
};

export function toUserMessage(error: DbErrorLike): string {
  const message = error.message ?? '';
  if (BY_MESSAGE[message]) return BY_MESSAGE[message];
  if (error.code === '23505' && message.includes('invoices_business_id_number_key')) return 'That invoice number is already used.';
  if (error.code === '23514') return "Some values aren't allowed. Check the form and try again.";
  if (error.code === '42501') return SANDBOX_EXPIRED_MESSAGE;
  return GENERIC_SAVE_ERROR;
}

export function isRateLimitError(error: DbErrorLike): boolean {
  return error.status === 429 || error.code === 'over_request_rate_limit';
}
