import { toUTCDate } from './dates';

const displayDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function formatDisplayDate(iso: string): string {
  return displayDate.format(toUTCDate(iso));
}
/** daysFromDue is positive when overdue, zero on the due date, negative before it. */
export function dueLabel(daysFromDue: number): string {
  if (daysFromDue > 0) return `Overdue ${daysFromDue} ${daysFromDue === 1 ? 'day' : 'days'}`;
  if (daysFromDue === 0) return 'Due today';
  if (daysFromDue === -1) return 'Due tomorrow';
  return `Due in ${-daysFromDue} days`;
}
