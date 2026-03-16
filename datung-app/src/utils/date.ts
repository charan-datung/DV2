/**
 * Date utilities — all timestamps stored in UTC, displayed in Asia/Manila.
 */
import { format, formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

const TZ = 'Asia/Manila';

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

/** Returns number of days between now and a date (negative = overdue) */
export function daysUntil(iso: string): number {
  return differenceInDays(parseISO(iso), new Date());
}

/** Formats a date-only string (YYYY-MM-DD) for display */
export function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-PH', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
