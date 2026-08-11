import { z } from "zod";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { getRestaurantSettings, updateRestaurantSettings } from "@/domains/settings/settings-service";
import { getAdminLocationFromRequest } from "@/lib/admin/location";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const serviceWindowSchema = z.object({
  enabled: z.boolean(),
  startTime: timeSchema,
  endTime: timeSchema,
}).refine((value) => !value.enabled || value.endTime > value.startTime, {
  message: "La fine del servizio deve seguire l'inizio.",
});

// Un href valido o vuoto: niente di più severo, sono link a servizi esterni
// (WhatsApp, sito, Instagram) che il ristoratore incolla da altrove.
const optionalUrl = z.union([z.url(), z.literal("")]);

const settingsSchema = z.object({
  contact: z.object({
    phone: z.string().trim().max(40),
    whatsapp: z.string().trim().max(40),
    whatsappMessage: z.string().trim().max(300),
    officialWebsite: optionalUrl,
    instagramUrl: optionalUrl,
    seatingIndoor: z.number().int().min(0).max(2000),
    seatingOutdoor: z.number().int().min(0).max(2000),
  }),
  operations: z.object({
    serviceMode: z.enum(["live", "approval", "paused"]),
    capacityWarningPercent: z.number().int().min(50).max(100),
    waitlistAlertCount: z.number().int().min(1).max(100),
    largePartyAlertSize: z.number().int().min(2).max(100),
  }),
  service: z.object({
    startTime: timeSchema,
    endTime: timeSchema,
    slotIntervalMinutes: z.number().int().min(5).max(180),
    turnaroundMinutes: z.number().int().min(0).max(120),
    maximumCovers: z.number().int().min(1).max(500),
    maximumArrivalsPerSlot: z.number().int().min(1).max(100),
    onlineBookingEnabled: z.boolean(),
    phoneBookingEnabled: z.boolean(),
  }).refine((value) => value.endTime > value.startTime, { message: "La fine deve seguire l'inizio." }),
  schedule: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    lunch: serviceWindowSchema,
    dinner: serviceWindowSchema,
  })).length(7).superRefine((schedule, context) => {
    if (new Set(schedule.map((day) => day.dayOfWeek)).size !== 7) {
      context.addIssue({ code: "custom", message: "Ogni giorno della settimana deve essere configurato una sola volta." });
    }
  }),
  durations: z.object({
    party1To2: z.number().int().min(45).max(360),
    party3To4: z.number().int().min(45).max(360),
    party5To6: z.number().int().min(45).max(360),
    party7To10: z.number().int().min(45).max(360),
  }),
  rules: z.object({
    minimumPartySize: z.number().int().min(1).max(20),
    maximumPartySize: z.number().int().min(1).max(100),
    requiresManualApproval: z.boolean(),
    requiresDeposit: z.boolean(),
    depositAmount: z.number().min(0).max(10_000),
  }).refine((value) => value.maximumPartySize >= value.minimumPartySize, { message: "Il massimo deve essere maggiore o uguale al minimo." }),
  policies: z.object({
    minimumNoticeMinutes: z.number().int().min(0).max(10_080),
    maximumAdvanceDays: z.number().int().min(1).max(730),
    lateToleranceMinutes: z.number().int().min(0).max(120),
    noShowAfterMinutes: z.number().int().min(0).max(180),
    cancellationDeadlineHours: z.number().int().min(0).max(168),
  }),
  features: z.object({
    waitlistEnabled: z.boolean(),
    customerModificationEnabled: z.boolean(),
    customerCancellationEnabled: z.boolean(),
    automaticNotificationsEnabled: z.boolean(),
  }),
  notifications: z.object({
    emailConfirmationEnabled: z.boolean(),
    smsConfirmationEnabled: z.boolean(),
    staffAllergyAlertsEnabled: z.boolean(),
    staffLargePartyAlertsEnabled: z.boolean(),
    staffWaitlistAlertsEnabled: z.boolean(),
  }),
  guestExperience: z.object({
    // Occhiello e titolo della pagina di prenotazione: vuoti = testo predefinito.
    heroEyebrow: z.string().trim().max(80),
    heroTitle: z.string().trim().max(120),
    arrivalMessage: z.string().trim().min(10).max(300),
    // Non può restare vuoto: è la condizione che fa perdere il tavolo, e una
    // ricevuta che non la riporta lascia il ristorante senza appoggio quando
    // deve spostare qualcuno.
    punctualityNotice: z.string().trim().min(20).max(400),
    // Vuoto è legittimo: significa "nessun riquadro in evidenza".
    highlight: z.string().trim().max(120),
    directions: z.string().trim().min(5).max(300),
    parkingInfo: z.string().trim().min(5).max(300),
    accessibilityInfo: z.string().trim().min(5).max(300),
    dietaryNotice: z.string().trim().min(10).max(500),
  }),
});

// Next passa sempre la richiesta a un route handler: dichiararla opzionale
// fa fallire il typecheck contro i tipi di rotta generati.
export async function GET(request: Request) {
  try {
    const session = await requirePermission("settings:write");
    const location = getAdminLocationFromRequest(request, session);
    return success(await getRestaurantSettings(location.id));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("settings:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const settings = await updateRestaurantSettings(parsed.data, location.id);
    return success(settings);
  } catch (error) {
    return failure(error);
  }
}
