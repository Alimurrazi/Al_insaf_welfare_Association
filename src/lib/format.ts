// Shared display formatting for non-technical users. All date math reads
// UTC fields — dates are stored as UTC-midnight, so local-timezone getters
// could shift the displayed day depending on the server's TZ, silently
// disagreeing with toDateInputValue (which is UTC via toISOString).
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${hours}:${minutes}`;
}

// For <input type="date"> defaultValue/value, which requires yyyy-mm-dd —
// kept separate from formatDate (a display string) so a display format
// change can never accidentally break a form's date input.
export function toDateInputValue(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

// "2 hours ago" reads far more naturally on an activity feed than an ISO
// timestamp — but only while it's recent enough to be unambiguous. Past a
// week (and for any future/clock-skewed timestamp) it falls back to the
// friendly absolute date/time instead of an ever-growing, less useful
// "14 days ago".
export function formatRelativeTime(date: Date | string, now: Date): string {
  const d = new Date(date);
  const diffSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSeconds < 0) return formatDateTime(d);
  if (diffSeconds < 60) return "just now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return formatDateTime(d);
}

export function formatMonthYear(month: number, year: number): string {
  return `${MONTH_ABBR[month - 1]} ${year}`;
}

// en-IN groups thousands lakh-style (1,50,000), matching how members here
// actually read money, rather than the 1,50,0,000-vs-150,000 mismatch a
// Western locale would produce for larger amounts.
export function formatCurrency(amount: number): string {
  return `Tk ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Shared search-box matcher (member search on Deposits/Top-ups, etc.) — an
// empty/whitespace-only query matches everything, so a cleared search box
// shows the full list rather than nothing.
export function matchesQuery(text: string, query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length === 0) return true;
  return text.toLowerCase().includes(trimmed.toLowerCase());
}
