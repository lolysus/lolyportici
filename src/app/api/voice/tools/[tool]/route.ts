import { brandConfig, defaultRestaurantLocation, getRestaurantLocationById, getRestaurantLocationBySlug } from "@/config/brand";
import { checkAvailability } from "@/domains/availability/availability-service";
import { DomainError, ReservationNotFoundError, WebhookVerificationError } from "@/domains/bookings/errors";
import { sendReservationConfirmation } from "@/domains/notifications/notification-service";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { verifyRetellSignature } from "@/lib/security";
import { localDateTimeToUtc } from "@/lib/datetime";
import { getRepository } from "@/repositories";
import { availabilitySchema, databaseIdSchema, holdSchema, reservationCreateSchema, waitlistSchema } from "@/validators/booking";
import { z } from "zod";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { listKnowledgeItems } from "@/domains/knowledge/knowledge-service";
import type { ReservationRepository } from "@/repositories/repository";

const staffMutationSchema = z.object({ reservationId: databaseIdSchema, customerNotes: z.string().max(1000).optional() });
const voiceEscalationContextSchema = z.object({
  callerPhone: z.string().trim().min(6).max(30).optional(),
  callId: z.string().trim().min(1).max(128).optional(),
  call_id: z.string().trim().min(1).max(128).optional(),
  sessionId: z.string().trim().min(1).max(128).optional(),
}).passthrough();

const voiceLocationSchema = z.object({
  locationId: databaseIdSchema.optional(),
  locationSlug: z.string().trim().min(2).max(100).optional(),
}).passthrough();

function resolveVoiceLocation(body: unknown) {
  const parsed = voiceLocationSchema.safeParse(body);
  if (!parsed.success) return defaultRestaurantLocation;
  const location = parsed.data.locationId
    ? getRestaurantLocationById(parsed.data.locationId)
    : parsed.data.locationSlug
      ? getRestaurantLocationBySlug(parsed.data.locationSlug)
      : defaultRestaurantLocation;
  if (!location) throw new DomainError("VOICE_LOCATION_NOT_FOUND", "La sede richiesta non è valida.", 404);
  return location;
}

async function requestStaffCallback(
  repository: ReservationRepository,
  body: unknown,
  input: { reason: string; summary: string; callerPhone?: string },
) {
  const context = voiceEscalationContextSchema.safeParse(body);
  return repository.recordVoiceEscalation({
    callerPhone: input.callerPhone ?? (context.success ? context.data.callerPhone : undefined),
    providerCallId: context.success ? context.data.callId ?? context.data.call_id ?? context.data.sessionId : undefined,
    reason: input.reason,
    summary: input.summary,
  });
}

async function assertVoiceCancellationWindow(repository: ReservationRepository, reservationId: string, cancellationDeadlineHours: number) {
  const reservation = (await repository.listReservations()).find((item) => item.id === reservationId);
  if (!reservation) throw new ReservationNotFoundError();
  const deadline = new Date(reservation.startAt).getTime() - cancellationDeadlineHours * 60 * 60 * 1000;
  if (Date.now() >= deadline) {
    throw new DomainError("CANCELLATION_DEADLINE_PASSED", "Il termine per la cancellazione è scaduto. Trasferisci la chiamata al personale.", 409);
  }
}

export async function POST(request: Request, context: RouteContext<"/api/voice/tools/[tool]">) {
  try {
    enforceRateLimit(request, "voice-tools", 120);
    const rawBody = await request.text();
    const verified = verifyRetellSignature(rawBody, request.headers.get("x-retell-signature"));
    if (!verified) throw new WebhookVerificationError();
    const body = rawBody ? JSON.parse(rawBody) as unknown : {};
    const { tool } = await context.params;
    const location = resolveVoiceLocation(body);
    const repository = getRepository(location.id);
    const settings = await getRestaurantSettings(location.id);

    if (tool === "restaurant-information") {
      return success({ name: location.name, location: location.shortName, address: location.address, phone: location.phone, email: location.email, website: brandConfig.website, timezone: location.timezone, arrival: settings.guestExperience, knowledgeBaseOnly: true, assistant: { name: settings.voiceAI.assistantName, greeting: settings.voiceAI.greeting, defaultLanguage: settings.voiceAI.defaultLanguage }, capabilities: { newReservation: settings.operations.serviceMode !== "paused" && settings.voiceAI.allowNewReservations, modifyReservation: settings.voiceAI.allowModifyReservations, cancellation: settings.voiceAI.allowCancellation, waitlist: settings.features.waitlistEnabled && settings.voiceAI.allowWaitlist } });
    }
    if (!settings.service.phoneBookingEnabled || settings.operations.serviceMode === "paused") throw new DomainError("PHONE_BOOKING_DISABLED", "Il canale di prenotazione telefonica è disattivato.", 503);
    if (tool === "knowledge-answer") {
      const parsed = z.object({ query: z.string().trim().min(2).max(500), language: z.enum(["it", "en", "es"]).default(settings.voiceAI.defaultLanguage) }).safeParse(body);
      if (!parsed.success) return validationFailure(parsed.error.flatten());
      const terms = parsed.data.query.toLocaleLowerCase(parsed.data.language).split(/\W+/).filter((term) => term.length > 2);
      const candidates = (await listKnowledgeItems(location.id)).filter((item) => item.isActive && item.isPublic && item.language === parsed.data.language).map((item) => ({ item, score: terms.filter((term) => `${item.category} ${item.question}`.toLocaleLowerCase(parsed.data.language).includes(term)).length })).sort((a, b) => b.score - a.score || b.item.priority - a.item.priority);
      const match = candidates[0];
      return match?.score ? success({ answer: match.item.answer, sourceId: match.item.id, verified: true, transferRequired: false }) : success({ answer: "Non ho una risposta verificata. La metto in contatto con il personale.", verified: false, transferRequired: true });
    }
    if (tool === "check-availability") {
      const parsed = availabilitySchema.safeParse({ ...(body as object), locationId: location.id, source: "phone_ai" });
      if (!parsed.success) return validationFailure(parsed.error.flatten());
      if (parsed.data.partySize >= settings.voiceAI.transferPartySize) {
        const escalation = await requestStaffCallback(repository, body, {
          reason: `Gruppo da ${parsed.data.partySize} ospiti`,
          summary: `Richiesta telefonica per ${parsed.data.partySize} ospiti il ${parsed.data.date}: contattare il cliente per la gestione manuale.`,
        });
        return success({ requestedSlotAvailable: false, availableOptions: [], alternativeSlots: [], restrictions: [`I gruppi da ${settings.voiceAI.transferPartySize} persone richiedono il trasferimento al personale.`], requiresManualApproval: true, transferRequired: true, escalationId: escalation.id });
      }
      return success(checkAvailability(parsed.data, await repository.getAvailabilityContext()));
    }
    if (tool === "create-hold") {
      const transferCandidate = holdSchema.safeParse({ ...(body as object), locationId: location.id, source: "phone_ai" });
      if (transferCandidate.success && transferCandidate.data.partySize >= settings.voiceAI.transferPartySize) {
        const escalation = await requestStaffCallback(repository, body, {
          reason: `Gruppo da ${transferCandidate.data.partySize} ospiti`,
          summary: `Richiesta telefonica per ${transferCandidate.data.partySize} ospiti il ${transferCandidate.data.date}: nessun hold creato, serve gestione manuale.`,
        });
        return success({ status: "transfer_required", reason: "Il gruppo richiede l’intervento del personale.", escalationId: escalation.id }, { status: 202 });
      }
      if (!settings.voiceAI.allowNewReservations) throw new DomainError("VOICE_NEW_RESERVATIONS_DISABLED", "L’assistente non può creare nuove prenotazioni.", 409);
      const parsed = holdSchema.safeParse({ ...(body as object), locationId: location.id, source: "phone_ai" });
      if (!parsed.success) return validationFailure(parsed.error.flatten());
      if (parsed.data.partySize >= settings.voiceAI.transferPartySize) throw new DomainError("VOICE_TRANSFER_REQUIRED", "Il gruppo richiede l’intervento del personale.", 409);
      const { startAt, sessionId, ...availability } = parsed.data;
      return success(await repository.createHold({ availability, startAt, sessionId }), { status: 201 });
    }
    if (tool === "confirm-reservation") {
      if (!settings.voiceAI.allowNewReservations) throw new DomainError("VOICE_NEW_RESERVATIONS_DISABLED", "L’assistente non può creare nuove prenotazioni.", 409);
      const parsed = reservationCreateSchema.safeParse({ ...(body as object), locationId: location.id });
      if (!parsed.success) return validationFailure(parsed.error.flatten());
      if (settings.voiceAI.transferOnAllergies && parsed.data.customer.allergies) {
        const reason = "Allergia o intolleranza segnalata: conferma umana necessaria.";
        const escalation = await requestStaffCallback(repository, body, {
          callerPhone: parsed.data.customer.phone,
          reason: "Allergia o intolleranza segnalata",
          summary: `Allergia o intolleranza segnalata: ${parsed.data.customer.allergies}. Ricontattare il cliente prima della conferma.`,
        });
        await repository.releaseHold(parsed.data.holdId);
        return success({ status: "transfer_required", reason, escalationId: escalation.id, holdReleased: true }, { status: 202 });
      }
      const confirmed = await repository.confirmHold(parsed.data);
      const notification = settings.features.automaticNotificationsEnabled
        ? await sendReservationConfirmation(confirmed.reservation, {
          emailEnabled: settings.notifications.emailConfirmationEnabled,
          smsEnabled: settings.notifications.smsConfirmationEnabled,
        }).catch((error: unknown) => ({ status: "failed" as const, error: error instanceof Error ? error.message : "Unknown notification error" }))
        : { status: "disabled" as const, attempts: 0 };
      return success({ ...confirmed, notification }, { status: 201 });
    }
    if (tool === "find-reservation") {
      const query = z.object({ phone: z.string().optional(), reservationCode: z.string().optional(), date: z.string().optional() }).parse(body);
      const reservation = (await repository.listReservations()).find((row) => (!query.phone || row.customer.phone.replace(/\D/g, "") === query.phone.replace(/\D/g, "")) && (!query.reservationCode || row.reservationCode === query.reservationCode) && (!query.date || row.reservationDate === query.date));
      if (!reservation) throw new ReservationNotFoundError();
      return success(reservation);
    }
    if (tool === "modify-reservation" || tool === "add-reservation-note") {
      if (!settings.voiceAI.allowModifyReservations) throw new DomainError("VOICE_MODIFICATION_DISABLED", "L’assistente non può modificare prenotazioni.", 409);
      const parsed = staffMutationSchema.safeParse(body);
      if (!parsed.success) return validationFailure(parsed.error.flatten());
      return success(await repository.updateReservationByStaff(parsed.data.reservationId, { customerNotes: parsed.data.customerNotes }));
    }
    if (tool === "cancel-reservation") {
      if (!settings.voiceAI.allowCancellation) throw new DomainError("VOICE_CANCELLATION_DISABLED", "L’assistente non può cancellare prenotazioni.", 409);
      const parsed = staffMutationSchema.safeParse(body);
      if (!parsed.success) return validationFailure(parsed.error.flatten());
      await assertVoiceCancellationWindow(repository, parsed.data.reservationId, settings.policies.cancellationDeadlineHours);
      return success(await repository.updateReservationByStaff(parsed.data.reservationId, { status: "cancelled_by_customer", customerNotes: parsed.data.customerNotes }));
    }
    if (tool === "waitlist") {
      if (!settings.features.waitlistEnabled || !settings.voiceAI.allowWaitlist) throw new DomainError("VOICE_WAITLIST_DISABLED", "La lista d’attesa telefonica non è attiva.", 409);
      const parsed = waitlistSchema.safeParse({ ...(body as object), locationId: location.id });
      if (!parsed.success) return validationFailure(parsed.error.flatten());
      const { firstName, lastName, phone, requestedTime, ...rest } = parsed.data;
      return success(await repository.addWaitlist({ ...rest, customer: { firstName, lastName, phone }, requestedStartAt: localDateTimeToUtc(rest.requestedDate, requestedTime).toISOString() }), { status: 201 });
    }
    if (tool === "request-callback") {
      const parsed = z.object({
        callerPhone: z.string().trim().min(6).max(30),
        reason: z.string().trim().min(3).max(500),
        callId: z.string().trim().min(1).max(128).optional(),
        call_id: z.string().trim().min(1).max(128).optional(),
        sessionId: z.string().trim().min(1).max(128).optional(),
      }).safeParse(body);
      if (!parsed.success) return validationFailure(parsed.error.flatten());
      const escalation = await requestStaffCallback(repository, parsed.data, {
        callerPhone: parsed.data.callerPhone,
        reason: parsed.data.reason,
        summary: `Richiamata richiesta dall’assistente: ${parsed.data.reason}`,
      });
      return success({ callbackRequestId: escalation.id, status: "queued", reason: parsed.data.reason }, { status: 202 });
    }
    if (tool === "send-booking-confirmation") {
      const parsed = z.object({ reservationId: databaseIdSchema }).safeParse(body);
      if (!parsed.success) return validationFailure(parsed.error.flatten());
      const reservation = (await repository.listReservations()).find((row) => row.id === parsed.data.reservationId);
      if (!reservation) throw new ReservationNotFoundError();
      return success(await sendReservationConfirmation(reservation, {
        resend: true,
        emailEnabled: settings.notifications.emailConfirmationEnabled,
        smsEnabled: settings.notifications.smsConfirmationEnabled,
      }));
    }
    throw new DomainError("VOICE_TOOL_NOT_FOUND", "Strumento vocale non riconosciuto.", 404);
  } catch (error) { return failure(error); }
}
