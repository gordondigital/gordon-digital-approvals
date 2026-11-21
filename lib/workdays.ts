/** Working days (Monday to Friday) since a date, not counting the day itself. Uses Brisbane time. */
export function workDays(iso?: string | null, now: Date = new Date()): number {
  if (!iso) return 0;
  const day = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "Australia/Brisbane" }));
  const d = day(new Date(iso));
  d.setHours(0, 0, 0, 0);
  const t = day(now);
  t.setHours(0, 0, 0, 0);
  let n = 0;
  let guard = 0;
  d.setDate(d.getDate() + 1);
  while (d <= t && guard++ < 4000) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}
