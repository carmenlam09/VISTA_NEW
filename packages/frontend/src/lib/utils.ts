import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// dd-mm-yyyy everywhere, not the browser's en-US m/d/yyyy default - this
// app's vendors and reviewers are Malaysian/Singaporean, where day-first is
// the normal reading order, and m/d/yyyy is genuinely ambiguous to them
// (5/6/2015 reads as 5 June, not May 6th). Every date in the app should read
// the same way, so this is the one place that decides the order.
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * For a genuine point-in-time timestamp (createdAt, generatedAt, ...) -
 * shown in the viewer's own local calendar day, which is the correct
 * behaviour for "this happened at this moment": two reviewers in different
 * timezones can legitimately see a timestamp near midnight fall on different
 * local dates.
 */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

/**
 * For a genuine calendar DATE column with no time-of-day (e.g. SSM's date of
 * incorporation) - read with UTC getters rather than `formatDate`'s local
 * ones. Prisma serializes a DATE as UTC midnight, and a legally meaningful
 * date like this must never appear to shift by a day depending on which
 * timezone the reviewer's browser happens to be in.
 */
export function formatCalendarDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getUTCDate())}-${pad2(date.getUTCMonth() + 1)}-${date.getUTCFullYear()}`;
}

/** `formatDate` plus a local time-of-day, for timestamps where the time matters too. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${formatDate(date)}, ${time}`;
}

/**
 * Reformats whatever digits the reviewer has typed so far into dd-mm-yyyy,
 * live as they type - e.g. typing "16092026" becomes "16-09-2026" without
 * the reviewer having to type the dashes themselves. Non-digit characters
 * (including dashes they do type) are stripped first, so typing either way
 * lands on the same result. Used to back a plain text date filter instead of
 * a native `<input type="date">`, whose segment order follows the browser's
 * locale (month-first for en-US) rather than this app's day-first
 * convention - a reviewer typing day-first into a month-first field has
 * their input silently rejected as an invalid month.
 */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("-");
}

/**
 * Parses a complete dd-mm-yyyy string into a Date, or null for anything
 * incomplete or implausible - deliberately permissive of "not finished
 * typing yet" rather than throwing, since this backs a live-as-you-type
 * filter, not a form submit.
 */
export function parseDdMmYyyy(value: string): Date | null {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  // Reject e.g. 31-04-2026 - April has 30 days, and Date would otherwise
  // silently roll it over into May rather than reporting it as invalid.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

// Financial/share-count fields arrive as Decimal-typed strings over JSON
// (e.g. "250000.5") - format with thousand separators for read-only display.
export function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("en-US");
}
