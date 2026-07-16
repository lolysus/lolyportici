import type { ServicePeriod } from "@/types/domain";

export type BookingCalendarRules = {
  firstDate: string;
  maximumAdvanceDays: number;
  enabledWeekdays: number[];
  closedDates?: string[];
};

export type TimedReservation = {
  startAt: string;
  endAt: string;
};

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export function dateKeyFromDate(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayOfWeekForDateKey(dateKey: string) {
  return parseDateKey(dateKey).getUTCDay();
}

export function lastBookableDate(rules: BookingCalendarRules) {
  return addDaysToDateKey(rules.firstDate, rules.maximumAdvanceDays);
}

export function isBookableServiceDate(dateKey: string, rules: BookingCalendarRules) {
  if (dateKey < rules.firstDate || dateKey > lastBookableDate(rules)) return false;
  if (rules.closedDates?.includes(dateKey)) return false;
  return rules.enabledWeekdays.includes(dayOfWeekForDateKey(dateKey));
}

export function firstBookableServiceDate(rules: BookingCalendarRules) {
  for (let offset = 0; offset <= rules.maximumAdvanceDays; offset += 1) {
    const candidate = addDaysToDateKey(rules.firstDate, offset);
    if (isBookableServiceDate(candidate, rules)) return candidate;
  }
  return null;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const rest = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${rest}`;
}

export function buildServiceTimeSlots(service: Pick<ServicePeriod, "startTime" | "endTime" | "slotIntervalMinutes">) {
  const start = timeToMinutes(service.startTime);
  const end = timeToMinutes(service.endTime);
  const slots: string[] = [];
  for (let cursor = start; cursor < end; cursor += service.slotIntervalMinutes) {
    slots.push(minutesToTime(cursor));
  }
  return slots;
}

export function serviceForDate(servicePeriods: ServicePeriod[], dateKey: string) {
  const day = dayOfWeekForDateKey(dateKey);
  return servicePeriods
    .filter((service) => service.isActive && service.dayOfWeek === day)
    .sort((first, second) => first.startTime.localeCompare(second.startTime));
}

export function buildReservationLanes<T extends TimedReservation>(reservations: T[]) {
  const lanes: T[][] = [];
  for (const reservation of [...reservations].sort((first, second) => first.startAt.localeCompare(second.startAt))) {
    const lane = lanes.find((candidate) => {
      const last = candidate[candidate.length - 1];
      return !last || new Date(last.endAt).getTime() <= new Date(reservation.startAt).getTime();
    });
    if (lane) lane.push(reservation);
    else lanes.push([reservation]);
  }
  return lanes;
}

export function slotSpan(startTime: string, endTime: string, slotIntervalMinutes: number) {
  const duration = Math.max(slotIntervalMinutes, timeToMinutes(endTime) - timeToMinutes(startTime));
  return Math.max(1, Math.ceil(duration / slotIntervalMinutes));
}

export function slotStartIndex(startTime: string, service: Pick<ServicePeriod, "startTime" | "slotIntervalMinutes">) {
  return Math.max(0, Math.floor((timeToMinutes(startTime) - timeToMinutes(service.startTime)) / service.slotIntervalMinutes));
}
