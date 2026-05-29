/**
 * Local-calendar date formatting. `toISOString()` is UTC, which can render a
 * date a day off from the user's wall clock (e.g. JST is UTC+9); these helpers
 * use the local calendar day so generated/capture dates match the user's day.
 */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}
