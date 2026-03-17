/**
 * Date utilities — all timestamps stored in UTC, displayed in Asia/Manila.
 */
import { formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

const TZ = 'Asia/Manila';

/** Returns today's date string as YYYY-MM-DD in Manila timezone.
 *  Use this instead of new Date().toISOString().split('T')[0] which returns
 *  the UTC date and will be wrong for Manila users before 8am local time. */
export function getTodayManila(): string {
  // 'en-CA' locale formats dates as YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Returns a new date string (YYYY-MM-DD) by adding `days` to a base date string. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days); // local Date arithmetic (no timezone shift)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Formats an ISO date string to "Mar 13, 2026" in Manila timezone */
export function formatDate(iso: string): string {
  const date = parseISO(iso);
  return date.toLocaleDateString('en-PH', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Formats an ISO date string to "Mar 13, 2026, 3:45 PM" in Manila timezone */
export function formatDateTime(iso: string): string {
  const date = parseISO(iso);
  return date.toLocaleString('en-PH', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Formats an ISO date string to "HH:mm" in Manila timezone */
export function formatTime(iso: string): string {
  const date = parseISO(iso);
  return date.toLocaleString('en-PH', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Returns relative time string like "3 days ago" */
export function timeAgo(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
}

/** Returns number of calendar days between today (Manila) and a due date string
 *  (YYYY-MM-DD). Negative means overdue. */
export function daysUntil(dateStr: string): number {
  // Compare Manila calendar dates to avoid UTC off-by-one for PH users.
  // e.g. at 11pm Manila on the 16th, UTC is still the 16th but Manila is
  // almost the 17th — we must use Manila's "today" for correct day counting.
  return differenceInDays(parseISO(dateStr), parseISO(getTodayManila()));
}

/** Formats a date-only string (YYYY-MM-DD) for display */
export function formatDueDate(dateStr: string): string {
  // Append Manila midnight offset so the date is never shifted by local tz.
  const date = parseISO(dateStr + 'T00:00:00+08:00');
  return date.toLocaleDateString('en-PH', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
