"use client";

import { useMemo, useState } from "react";
import { enUS, es, it } from "date-fns/locale";
import { CalendarDays, ChevronDown, Info } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addDaysToDateKey,
  dateFromKey,
  dateKeyFromDate,
  isBookableServiceDate,
  lastBookableDate,
  type BookingCalendarRules,
} from "@/lib/service-calendar";

const calendarLocales = { it, en: enUS, es } as const;

const calendarCopy = {
  it: {
    fieldLabel: "Data del servizio",
    plannerEyebrow: "Pianifica la visita",
    plannerTitle: "Scegli un giorno con servizio online disponibile.",
    availableUntil: "Servizi online fino al",
    notice: "Le richieste rispettano un preavviso minimo di",
    minutes: "minuti",
    selectDate: "Seleziona la data del servizio, attualmente",
  },
  en: {
    fieldLabel: "Service date",
    plannerEyebrow: "Plan your visit",
    plannerTitle: "Choose a day with online booking available.",
    availableUntil: "Online booking available until",
    notice: "Requests respect a minimum notice of",
    minutes: "minutes",
    selectDate: "Select the service date, currently",
  },
  es: {
    fieldLabel: "Fecha del servicio",
    plannerEyebrow: "Planifica tu visita",
    plannerTitle: "Elige un día con reservas online disponibles.",
    availableUntil: "Reservas online disponibles hasta el",
    notice: "Las solicitudes respetan un aviso mínimo de",
    minutes: "minutos",
    selectDate: "Selecciona la fecha del servicio, actualmente",
  },
} as const;

type BookingDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  locale: "it" | "en" | "es";
  rules: BookingCalendarRules;
  minimumNoticeMinutes: number;
};

export function BookingDatePicker({
  value,
  onChange,
  locale,
  rules,
  minimumNoticeMinutes,
}: BookingDatePickerProps) {
  const [open, setOpen] = useState(false);
  const copy = calendarCopy[locale];
  const selectedDate = dateFromKey(value);
  const lastDate = lastBookableDate(rules);
  const shortDate = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(selectedDate);
  const shortcuts = useMemo(() => {
    const candidates: string[] = [];
    for (let offset = 0; offset <= rules.maximumAdvanceDays && candidates.length < 3; offset += 1) {
      const candidate = addDaysToDateKey(rules.firstDate, offset);
      if (isBookableServiceDate(candidate, rules)) candidates.push(candidate);
    }
    return candidates;
  }, [rules]);

  function selectDate(next: Date | undefined) {
    if (!next) return;
    const nextKey = dateKeyFromDate(next);
    if (!isBookableServiceDate(nextKey, rules)) return;
    onChange(nextKey);
    setOpen(false);
  }

  return (
    <div className="surface-3d relative max-w-xl overflow-hidden rounded-3xl border border-foreground/10 bg-card p-3 shadow-[0_22px_60px_-42px_rgba(18,24,16,.62)] sm:p-4">
      <div aria-hidden className="absolute -right-14 -top-16 size-40 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,.35)]">
          <CalendarDays className="size-5" />
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${copy.selectDate} ${shortDate}`}
              className="group min-w-0 flex-1 rounded-2xl px-1 py-1 text-left outline-none transition-colors hover:bg-background/70 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">{copy.fieldLabel}</span>
              <span className="mt-1 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-base font-semibold capitalize sm:text-lg">{shortDate}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180 text-primary")} />
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={12} className="w-[min(calc(100vw-2rem),25rem)] overflow-hidden rounded-3xl border border-foreground/10 bg-popover p-0 shadow-2xl">
            <div className="border-b border-foreground/10 bg-primary/8 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{copy.plannerEyebrow}</p>
              <p className="mt-1 text-sm font-semibold">{copy.plannerTitle}</p>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={selectDate}
              disabled={(candidate) => !isBookableServiceDate(dateKeyFromDate(candidate), rules)}
              startMonth={dateFromKey(rules.firstDate)}
              endMonth={dateFromKey(lastDate)}
              locale={calendarLocales[locale]}
              className="w-full bg-transparent p-4 [--cell-size:--spacing(10)]"
              classNames={{
                root: "w-full",
                months: "w-full",
                month: "w-full gap-3",
                month_caption: "h-10 px-12 text-sm font-semibold capitalize",
                weekdays: "mb-1",
                weekday: "text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground",
                week: "mt-1.5",
                day: "rounded-xl",
                today: "rounded-xl bg-primary/10 text-primary",
                outside: "opacity-30",
                disabled: "cursor-not-allowed opacity-25",
              }}
            />
            {shortcuts.length > 0 && <div className="flex flex-wrap gap-2 border-t border-foreground/10 px-4 py-3">
              {shortcuts.map((candidate) => (
                <Button key={candidate} type="button" size="sm" variant={candidate === value ? "default" : "outline"} onClick={() => { onChange(candidate); setOpen(false); }}>
                  {new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(dateFromKey(candidate))}
                </Button>
              ))}
            </div>}
          </PopoverContent>
        </Popover>
      </div>
      <p className="relative mt-3 flex items-start gap-2 border-t border-foreground/8 pt-3 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <span>{copy.availableUntil} {new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(dateFromKey(lastDate))}. {copy.notice} {minimumNoticeMinutes} {copy.minutes}.</span>
      </p>
    </div>
  );
}
