// Shared (browser + server) display helpers for uploaded statements. No "use client" here:
// server components (the dashboard) call these while rendering.

const longDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-10-01", "2026-10-28" -> "1 Oct 2026 – 28 Oct 2026". */
export const formatPeriod = (start: string, end: string) =>
  `${longDate.format(new Date(`${start}T00:00:00Z`))} – ${longDate.format(new Date(`${end}T00:00:00Z`))}`;
