import { restaurantConfig } from "@/config/brand";

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function offsetAt(value: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return representedAsUtc - value.getTime();
}

export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string = restaurantConfig.timezone,
) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = new Date(wallClockAsUtc - offsetAt(new Date(wallClockAsUtc), timeZone));
  const correctedOffset = offsetAt(result, timeZone);
  result = new Date(wallClockAsUtc - correctedOffset);
  return result;
}

export function formatTimeInZone(
  value: string | Date,
  timeZone: string = restaurantConfig.timezone,
) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function dateKeyInZone(
  value: string | Date,
  timeZone: string = restaurantConfig.timezone,
) {
  const parts = zonedParts(typeof value === "string" ? new Date(value) : value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}
