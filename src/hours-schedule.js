export const MAX_HOURS_EXCEPTIONS = 60;
export const SCHEDULE_DAYS = 366;
const validTime = value => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Calendar arithmetic stays independent of the browser's zone and DST offsets.
export function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function dateLabel(date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

export function normalizeException(value) {
  if (!value || typeof value !== "object") return null;
  if (value.closed === true) return { closed: true };
  if (value.closed === false && validTime(value.open) && validTime(value.close) && value.open < value.close) {
    return { closed: false, open: value.open, close: value.close };
  }
  return null;
}

export function normalizeSchedule(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([date, entry]) => validDate(date) && normalizeException(entry)).map(([date, entry]) => [date, normalizeException(entry)]));
}

export function scheduledHoursPatch(current, date, entry, expected, today, now = Date.now(), expectedOverride = null) {
  if (!validDate(date) || date < today || date > addDays(today, SCHEDULE_DAYS)) throw new Error("Choose a date from today through the next year, in shop time.");
  const value = entry === null ? null : normalizeException(entry);
  if (entry !== null && !value) throw new Error("Choose valid opening and closing times, with closing after opening. Overnight hours are not supported.");
  const schedule = normalizeSchedule(current.scheduledHours);
  if (JSON.stringify(schedule[date] || null) !== JSON.stringify(normalizeException(expected))) throw new Error("Hours for that date changed. Select the date again to review the latest hours.");
  const overrideKey = value => value?.date === today ? JSON.stringify([value.date, value.closed, value.open, value.close, value.mode]) : "";
  if (date === today && overrideKey(current.hoursOverride) !== overrideKey(expectedOverride)) throw new Error("Today’s hours changed. Select the date again before saving.");
  // Prune expired exceptions only during an explicit staff save, never on reads.
  const scheduledHours = Object.fromEntries(Object.entries(schedule).filter(([key]) => key >= today));
  if (value) scheduledHours[date] = value;
  else delete scheduledHours[date];
  if (Object.keys(scheduledHours).length > MAX_HOURS_EXCEPTIONS) throw new Error(`Keep at most ${MAX_HOURS_EXCEPTIONS} upcoming dates. Remove an exception before adding another.`);
  return { scheduledHours, updatedAt: now,
    // Editing today's planned hours must not be hidden by an earlier quick override.
    ...(date === today && current.hoursOverride?.date === today ? { hoursOverride: null } : {}) };
}
