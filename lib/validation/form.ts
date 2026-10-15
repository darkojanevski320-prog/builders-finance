import type { ZodError } from 'zod';

export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

export function parseItemsJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** First message per field, keyed by dotted path, for example `items.0.quantity`. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
