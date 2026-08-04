import "server-only";

import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { getPostgres, isPostgresConfigured } from "@/lib/postgres";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { ContactSettings, DayScheduleSettings, RestaurantSettings, ServiceWindowSettings } from "@/types/settings";

type ServiceRow = {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_interval_minutes: number;
  turnaround_minutes: number;
  maximum_covers: number;
  maximum_arrivals_per_slot: number;
  online_booking_enabled: boolean;
  phone_booking_enabled: boolean;
  is_active: boolean;
};

type StoredConditions = {
  contact?: Partial<ContactSettings>;
  durationByParty?: Partial<RestaurantSettings["durations"]>;
  features?: Partial<RestaurantSettings["features"]>;
  notifications?: Partial<RestaurantSettings["notifications"]>;
  guestExperience?: Partial<RestaurantSettings["guestExperience"]>;
  operations?: Partial<RestaurantSettings["operations"]>;
  voiceAI?: Partial<RestaurantSettings["voiceAI"]>;
  explicitManualApproval?: boolean;
};

function createDefaultSchedule(): DayScheduleSettings[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    lunch: {
      enabled: dayOfWeek === 0 || dayOfWeek === 6,
      startTime: "12:00",
      endTime: "15:00",
    },
    dinner: { enabled: true, startTime: "19:00", endTime: "23:30" },
  }));
}

const defaults: RestaurantSettings = {
  contact: {
    phone: "",
    whatsapp: "",
    whatsappMessage: "Ciao! Vorrei prenotare un tavolo da {ristorante}.",
    officialWebsite: "",
    instagramUrl: "",
    seatingIndoor: 0,
    seatingOutdoor: 0,
  },
  operations: {
    serviceMode: "live",
    capacityWarningPercent: 80,
    waitlistAlertCount: 4,
    largePartyAlertSize: 8,
  },
  service: {
    startTime: "19:00",
    endTime: "23:30",
    slotIntervalMinutes: 30,
    turnaroundMinutes: 15,
    maximumCovers: 62,
    maximumArrivalsPerSlot: 8,
    onlineBookingEnabled: true,
    phoneBookingEnabled: true,
  },
  schedule: createDefaultSchedule(),
  durations: { party1To2: 90, party3To4: 120, party5To6: 150, party7To10: 180 },
  rules: {
    minimumPartySize: 1,
    maximumPartySize: 10,
    requiresManualApproval: false,
    requiresDeposit: false,
    depositAmount: 0,
  },
  policies: {
    minimumNoticeMinutes: 60,
    maximumAdvanceDays: 90,
    lateToleranceMinutes: 15,
    noShowAfterMinutes: 30,
    cancellationDeadlineHours: 12,
  },
  features: {
    waitlistEnabled: true,
    customerModificationEnabled: true,
    customerCancellationEnabled: true,
    automaticNotificationsEnabled: true,
  },
  notifications: {
    emailConfirmationEnabled: true,
    smsConfirmationEnabled: true,
    staffAllergyAlertsEnabled: true,
    staffLargePartyAlertsEnabled: true,
    staffWaitlistAlertsEnabled: true,
  },
  guestExperience: {
    arrivalMessage: "Ti aspettiamo cinque minuti prima dell’orario di prenotazione.",
    directions: "Raggiungi il ristorante seguendo le indicazioni di Google Maps.",
    parkingInfo: "Parcheggi pubblici disponibili nelle vicinanze.",
    accessibilityInfo: "Accesso senza barriere disponibile su richiesta.",
    dietaryNotice: "Segnala allergie e intolleranze durante la prenotazione: lo staff confermerà ogni dettaglio.",
  },
  voiceAI: {
    assistantName: "Assistente prenotazioni",
    greeting: "Buongiorno, sono l’assistente virtuale del ristorante. Come posso aiutarla?",
    defaultLanguage: "it",
    allowNewReservations: true,
    allowModifyReservations: true,
    allowCancellation: true,
    allowWaitlist: true,
    transferOnAllergies: true,
    transferPartySize: 10,
  },
};

const globalSettings = globalThis as typeof globalThis & {
  __sushiSettings?: Map<string, RestaurantSettings>;
};

function defaultSettingsForLocation(locationId: string) {
  const settings = structuredClone(defaults);
  const location = getRestaurantLocationById(locationId);
  if (!location) return settings;

  settings.voiceAI.assistantName = `Assistente ${location.name}`;
  settings.voiceAI.greeting = `Buongiorno, sono l’assistente virtuale di ${location.name}. Come posso aiutarla?`;
  settings.service.maximumCovers = location.capacity;
  settings.contact = {
    phone: location.phone,
    whatsapp: location.whatsapp,
    whatsappMessage: `Ciao! Vorrei prenotare un tavolo da ${location.shortName}.`,
    officialWebsite: location.officialWebsite,
    instagramUrl: location.instagramUrl,
    seatingIndoor: location.seating.indoor,
    seatingOutdoor: location.seating.outdoor,
  };
  settings.operations.capacityWarningPercent = location.slug === "kousushi" ? 78 : 82;
  settings.operations.waitlistAlertCount = location.slug === "kousushi" ? 3 : 4;
  if (location.slug === "kousushi") {
    settings.guestExperience.directions = "Raggiungi Corso Giuseppe Garibaldi 130, Portici, seguendo Google Maps.";
    settings.guestExperience.parkingInfo = "Controlla la disponibilità dei parcheggi pubblici nelle vicinanze prima della partenza.";
    settings.guestExperience.accessibilityInfo = "Segnala in prenotazione eventuali esigenze di accesso: il team KouSushi ti assisterà.";
  } else {
    settings.guestExperience.directions = "Raggiungi Via Severiana, Ardea, seguendo Google Maps.";
    settings.guestExperience.parkingInfo = "Controlla la disponibilità dei parcheggi pubblici nelle vicinanze prima della partenza.";
  }
  return settings;
}

function timeValue(value: unknown, fallback: string) {
  const normalized = String(value ?? "").slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : fallback;
}

function scheduleFromServices(services: ServiceRow[], fallback: DayScheduleSettings[]) {
  const schedule = structuredClone(fallback);
  for (const service of services) {
    const day = schedule.find((item) => item.dayOfWeek === Number(service.day_of_week));
    const period = service.name.toLocaleLowerCase("it").includes("pranzo") ? "lunch" : service.name.toLocaleLowerCase("it").includes("cena") ? "dinner" : null;
    if (!day || !period) continue;
    const current = day[period];
    day[period] = {
      enabled: Boolean(service.is_active),
      startTime: timeValue(service.start_time, current.startTime),
      endTime: timeValue(service.end_time, current.endTime),
    };
  }
  return schedule;
}

export function getInMemoryRestaurantSettings(locationId: string = restaurantConfig.locationId) {
  globalSettings.__sushiSettings ??= new Map();
  if (!globalSettings.__sushiSettings.has(locationId)) {
    globalSettings.__sushiSettings.set(locationId, defaultSettingsForLocation(locationId));
  }
  return structuredClone(globalSettings.__sushiSettings.get(locationId)!);
}

async function readSettingsFromPostgres(locationId: string): Promise<RestaurantSettings> {
  const sql = getPostgres();
  const [services, rules, locations] = await Promise.all([
    sql<ServiceRow[]>`select * from public.service_periods where location_id=${locationId} order by day_of_week, start_time`,
    sql<RuleRow[]>`select * from public.booking_rules where location_id=${locationId} and is_active order by created_at limit 1`,
    sql<{ booking_enabled: boolean }[]>`select booking_enabled from public.locations where id=${locationId}`,
  ]);
  return settingsFromRows(locationId, [...services], rules[0] ?? null, locations[0]?.booking_enabled);
}

async function writeSettingsToPostgres(settings: RestaurantSettings, locationId: string) {
  const sql = getPostgres();
  const conditions = storedConditions(settings);

  for (const day of settings.schedule) {
    for (const { name, window } of [
      { name: "Pranzo" as const, window: day.lunch },
      { name: "Cena" as const, window: day.dinner },
    ]) {
      const payload = servicePayload(settings, name, day.dayOfWeek, window);
      // Un servizio è identificato da sede, nome e giorno: se esiste si
      // aggiorna, altrimenti nasce. Senza questo controllo ogni salvataggio
      // creerebbe un doppione e la disponibilità verrebbe contata due volte.
      const existing = await sql<{ id: string }[]>`
        select id from public.service_periods
        where location_id=${locationId} and name=${name} and day_of_week=${day.dayOfWeek}
        limit 1`;
      if (existing[0]) {
        await sql`
          update public.service_periods set
            start_time=${payload.start_time}, end_time=${payload.end_time},
            slot_interval_minutes=${payload.slot_interval_minutes},
            default_duration_minutes=${payload.default_duration_minutes},
            turnaround_minutes=${payload.turnaround_minutes},
            maximum_covers=${payload.maximum_covers},
            maximum_arrivals_per_slot=${payload.maximum_arrivals_per_slot},
            online_booking_enabled=${payload.online_booking_enabled},
            phone_booking_enabled=${payload.phone_booking_enabled},
            is_active=${payload.is_active}
          where id=${existing[0].id}`;
      } else {
        await sql`
          insert into public.service_periods
            (location_id,name,day_of_week,start_time,end_time,slot_interval_minutes,default_duration_minutes,turnaround_minutes,maximum_covers,maximum_arrivals_per_slot,online_booking_enabled,phone_booking_enabled,is_active)
          values (${locationId},${name},${day.dayOfWeek},${payload.start_time},${payload.end_time},${payload.slot_interval_minutes},${payload.default_duration_minutes},${payload.turnaround_minutes},${payload.maximum_covers},${payload.maximum_arrivals_per_slot},${payload.online_booking_enabled},${payload.phone_booking_enabled},${payload.is_active})`;
      }
    }
  }

  await sql`update public.locations set booking_enabled=${settings.operations.serviceMode !== "paused"} where id=${locationId}`;
  await sql`
    update public.booking_rules set
      minimum_party_size=${settings.rules.minimumPartySize},
      maximum_party_size=${settings.rules.maximumPartySize},
      default_duration_minutes=${settings.durations.party3To4},
      turnaround_minutes=${settings.service.turnaroundMinutes},
      requires_manual_approval=${settings.rules.requiresManualApproval || settings.operations.serviceMode === "approval"},
      requires_deposit=${settings.rules.requiresDeposit},
      deposit_amount=${settings.rules.requiresDeposit ? settings.rules.depositAmount : null},
      minimum_notice_minutes=${settings.policies.minimumNoticeMinutes},
      maximum_advance_days=${settings.policies.maximumAdvanceDays},
      late_tolerance_minutes=${settings.policies.lateToleranceMinutes},
      no_show_after_minutes=${settings.policies.noShowAfterMinutes},
      cancellation_deadline_hours=${settings.policies.cancellationDeadlineHours},
      conditions=${sql.json(conditions as never)}
    where location_id=${locationId} and is_active`;
}

function storedConditions(settings: RestaurantSettings): StoredConditions {
  return {
    contact: settings.contact,
    durationByParty: settings.durations,
    features: settings.features,
    notifications: settings.notifications,
    guestExperience: settings.guestExperience,
    operations: settings.operations,
    voiceAI: settings.voiceAI,
    explicitManualApproval: settings.rules.requiresManualApproval,
  };
}

export async function getRestaurantSettings(locationId: string = restaurantConfig.locationId): Promise<RestaurantSettings> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return getInMemoryRestaurantSettings(locationId);
  // In produzione il database è PostgreSQL su Railway. Prima questo ramo non
  // esisteva e le impostazioni tornavano sempre da una mappa in memoria: gli
  // orari salvati dal ristoratore sparivano al primo deploy.
  if (isPostgresConfigured()) return readSettingsFromPostgres(locationId);
  if (!isSupabaseConfigured()) return getInMemoryRestaurantSettings(locationId);

  const db = getSupabaseAdmin();
  const [servicesResult, rulesResult, locationResult] = await Promise.all([
    db.from("service_periods").select("*").eq("location_id", locationId).order("day_of_week").order("start_time"),
    db.from("booking_rules").select("*").eq("location_id", locationId).eq("is_active", true).order("created_at").limit(1).maybeSingle(),
    db.from("locations").select("booking_enabled").eq("id", locationId).maybeSingle(),
  ]);
  if (servicesResult.error) throw servicesResult.error;
  if (rulesResult.error) throw rulesResult.error;
  if (locationResult.error) throw locationResult.error;

  return settingsFromRows(
    locationId,
    (servicesResult.data ?? []) as ServiceRow[],
    rulesResult.data as RuleRow | null,
    locationResult.data?.booking_enabled as boolean | undefined,
  );
}

type RuleRow = {
  minimum_party_size: number;
  maximum_party_size: number;
  requires_manual_approval: boolean;
  requires_deposit: boolean;
  deposit_amount: number | string | null;
  minimum_notice_minutes: number;
  maximum_advance_days: number;
  late_tolerance_minutes: number;
  no_show_after_minutes: number;
  cancellation_deadline_hours: number;
  conditions: unknown;
};

/**
 * Riga per riga il database non descrive le impostazioni come le vede il
 * ristoratore: gli orari stanno nei periodi di servizio, le regole in
 * booking_rules e il resto in un blob JSON. La ricomposizione è la stessa
 * qualunque sia il motore, quindi vive qui una volta sola.
 */
function settingsFromRows(
  locationId: string,
  services: ServiceRow[],
  rule: RuleRow | null,
  bookingEnabled: boolean | undefined,
): RestaurantSettings {
  const locationDefaults = defaultSettingsForLocation(locationId);
  const primaryService = services.find((service) => service.name.toLocaleLowerCase("it").includes("cena") && service.is_active)
    ?? services.find((service) => service.is_active);
  const conditions = (rule?.conditions ?? {}) as StoredConditions;
  const storedOperations = conditions.operations ?? {};
  const serviceMode = storedOperations.serviceMode
    ?? (bookingEnabled === false ? "paused" : "live");

  return {
    contact: { ...locationDefaults.contact, ...conditions.contact },
    operations: { ...locationDefaults.operations, ...storedOperations, serviceMode },
    service: primaryService ? {
      startTime: timeValue(primaryService.start_time, locationDefaults.service.startTime),
      endTime: timeValue(primaryService.end_time, locationDefaults.service.endTime),
      slotIntervalMinutes: primaryService.slot_interval_minutes,
      turnaroundMinutes: primaryService.turnaround_minutes,
      maximumCovers: primaryService.maximum_covers,
      maximumArrivalsPerSlot: primaryService.maximum_arrivals_per_slot,
      onlineBookingEnabled: primaryService.online_booking_enabled,
      phoneBookingEnabled: primaryService.phone_booking_enabled,
    } : locationDefaults.service,
    schedule: scheduleFromServices(services, locationDefaults.schedule),
    durations: { ...locationDefaults.durations, ...conditions.durationByParty },
    rules: rule ? {
      minimumPartySize: rule.minimum_party_size,
      maximumPartySize: rule.maximum_party_size,
      requiresManualApproval: conditions.explicitManualApproval ?? rule.requires_manual_approval,
      requiresDeposit: rule.requires_deposit,
      depositAmount: Number(rule.deposit_amount ?? 0),
    } : locationDefaults.rules,
    policies: rule ? {
      minimumNoticeMinutes: rule.minimum_notice_minutes,
      maximumAdvanceDays: rule.maximum_advance_days,
      lateToleranceMinutes: rule.late_tolerance_minutes,
      noShowAfterMinutes: rule.no_show_after_minutes,
      cancellationDeadlineHours: rule.cancellation_deadline_hours,
    } : locationDefaults.policies,
    features: { ...locationDefaults.features, ...conditions.features },
    notifications: { ...locationDefaults.notifications, ...conditions.notifications },
    guestExperience: { ...locationDefaults.guestExperience, ...conditions.guestExperience },
    voiceAI: { ...locationDefaults.voiceAI, ...conditions.voiceAI },
  };
}

function servicePayload(
  settings: RestaurantSettings,
  periodName: "Pranzo" | "Cena",
  dayOfWeek: number,
  window: ServiceWindowSettings,
) {
  const isPaused = settings.operations.serviceMode === "paused";
  return {
    name: periodName,
    day_of_week: dayOfWeek,
    start_time: window.startTime,
    end_time: window.endTime,
    slot_interval_minutes: settings.service.slotIntervalMinutes,
    default_duration_minutes: settings.durations.party3To4,
    turnaround_minutes: settings.service.turnaroundMinutes,
    maximum_covers: periodName === "Pranzo"
      ? Math.max(1, Math.round(settings.service.maximumCovers * 0.88))
      : settings.service.maximumCovers,
    maximum_arrivals_per_slot: settings.service.maximumArrivalsPerSlot,
    online_booking_enabled: settings.service.onlineBookingEnabled && !isPaused,
    phone_booking_enabled: settings.service.phoneBookingEnabled && !isPaused,
    is_active: window.enabled,
  };
}

export async function updateRestaurantSettings(
  settings: RestaurantSettings,
  locationId: string = restaurantConfig.locationId,
) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true" && isPostgresConfigured()) {
    await writeSettingsToPostgres(settings, locationId);
    return structuredClone(settings);
  }
  if (!isSupabaseConfigured() || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    globalSettings.__sushiSettings ??= new Map();
    globalSettings.__sushiSettings.set(locationId, structuredClone(settings));
    return structuredClone(settings);
  }

  const db = getSupabaseAdmin();
  const existingResult = await db.from("service_periods").select("id,name,day_of_week").eq("location_id", locationId);
  if (existingResult.error) throw existingResult.error;
  const existingServices = (existingResult.data ?? []) as Array<{ id: string; name: string; day_of_week: number }>;

  const serviceMutations = settings.schedule.flatMap((day) => ([
    { name: "Pranzo" as const, window: day.lunch },
    { name: "Cena" as const, window: day.dinner },
  ]).map(async ({ name, window }) => {
    const updatePayload = servicePayload(settings, name, day.dayOfWeek, window);
    const existing = existingServices.find((service) => service.day_of_week === day.dayOfWeek && service.name === name);
    const mutation = existing
      ? await db.from("service_periods").update(updatePayload).eq("id", existing.id)
      : await db.from("service_periods").insert({ ...updatePayload, location_id: locationId });
    if (mutation.error) throw mutation.error;
  }));

  const conditions: StoredConditions = storedConditions(settings);

  const [locationMutation, ruleMutation] = await Promise.all([
    db.from("locations").update({ booking_enabled: settings.operations.serviceMode !== "paused" }).eq("id", locationId),
    db.from("booking_rules").update({
      minimum_party_size: settings.rules.minimumPartySize,
      maximum_party_size: settings.rules.maximumPartySize,
      default_duration_minutes: settings.durations.party3To4,
      turnaround_minutes: settings.service.turnaroundMinutes,
      requires_manual_approval: settings.rules.requiresManualApproval || settings.operations.serviceMode === "approval",
      requires_deposit: settings.rules.requiresDeposit,
      deposit_amount: settings.rules.requiresDeposit ? settings.rules.depositAmount : null,
      minimum_notice_minutes: settings.policies.minimumNoticeMinutes,
      maximum_advance_days: settings.policies.maximumAdvanceDays,
      late_tolerance_minutes: settings.policies.lateToleranceMinutes,
      no_show_after_minutes: settings.policies.noShowAfterMinutes,
      cancellation_deadline_hours: settings.policies.cancellationDeadlineHours,
      conditions,
    }).eq("location_id", locationId).eq("is_active", true),
    ...serviceMutations,
  ]);
  if (locationMutation.error) throw locationMutation.error;
  if (ruleMutation.error) throw ruleMutation.error;
  return structuredClone(settings);
}
