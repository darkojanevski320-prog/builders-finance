import { toUTCDate } from './dates';

const displayDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function formatDisplayDate(iso: string): string {
  return displayDate.format(toUTCDate(iso));
}
