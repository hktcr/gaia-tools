function zonedParts(date, timeZone) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));
}

function timeZoneOffsetMs(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  ) - date.getTime();
}

export function isoToZonedDateTimeLocal(value, timeZone = "Europe/Stockholm") {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function zonedDateTimeToIso(value, timeZone = "Europe/Stockholm") {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00"] = match;
  const normalizedInput = `${year}-${month}-${day}T${hour}:${minute}`;
  const naive = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  let instant = naive - timeZoneOffsetMs(new Date(naive), timeZone);
  instant = naive - timeZoneOffsetMs(new Date(instant), timeZone);
  const iso = new Date(instant).toISOString();
  return isoToZonedDateTimeLocal(iso, timeZone) === normalizedInput ? iso : null;
}
