import { randomUUID } from "node:crypto";
import { z } from "zod";
import { checkAvailability } from "@/domains/availability/availability-service";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { getAdminLocationFromRequest } from "@/lib/admin/location";
import { getRepository } from "@/repositories";
import { formatTimeInZone } from "@/lib/datetime";

/**
 * Le prenotazioni prese da chi lavora in sala: al telefono o al banco.
 *
 * Passa dagli stessi due passaggi del cliente online — `createHold` poi
 * `confirmHold` — non da una scrittura diretta sul database. È lo stesso
 * arbitro (la funzione atomica Postgres con i lucchetti per tavolo e per
 * fascia) a decidere se il posto c'è ancora: un "sì" detto al telefono da chi
 * guarda una schermata non aggiornata da tre minuti non deve poter superare i
 * tavoli, i coperti o il limite di fascia che fermerebbero un cliente online.
 */
const manualSource = z.enum(["phone_staff", "walk_in"]);

const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida."),
  partySize: z.coerce.number().int().min(1).max(100),
  source: manualSource.default("phone_staff"),
});

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida."),
  startAt: z.iso.datetime(),
  partySize: z.number().int().min(1).max(100),
  source: manualSource,
  accessibilityRequirements: z.boolean().optional(),
  customer: z.object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(6).max(30),
    email: z.union([z.email(), z.literal("")]).optional(),
    allergies: z.string().trim().max(500).optional(),
    accessibilityNeeds: z.string().trim().max(500).optional(),
  }),
  customerNotes: z.string().trim().max(1000).optional(),
});

/** Gli stessi orari che vedrebbe un cliente online, per la stessa data e lo stesso numero di persone. */
export async function GET(request: Request) {
  try {
    const session = await requirePermission("reservations:read");
    const location = getAdminLocationFromRequest(request, session);
    const url = new URL(request.url);
    const parsed = availabilityQuerySchema.safeParse({
      date: url.searchParams.get("date"),
      partySize: url.searchParams.get("partySize"),
      source: url.searchParams.get("source") ?? undefined,
    });
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const context = await getRepository(location.id).getAvailabilityContext();
    const result = checkAvailability({ locationId: location.id, ...parsed.data }, context);
    return success({
      availableOptions: result.availableOptions.map((option) => ({ startAt: option.startAt, endAt: option.endAt, time: formatTimeInZone(option.startAt, context.timezone) })),
      restrictions: result.restrictions,
      requiresManualApproval: result.requiresManualApproval,
    });
  } catch (error) { return failure(error); }
}

/**
 * Occupa il tavolo, scala la disponibilità, aggiorna la fascia: la stessa cosa
 * che farebbe la conferma online, perché è lo stesso codice a farla.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("reservations:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const { date, startAt, partySize, source, accessibilityRequirements, customer, customerNotes } = parsed.data;
    const repository = getRepository(location.id);
    const sessionId = `staff_${randomUUID()}`;
    const hold = await repository.createHold({
      availability: { locationId: location.id, date, partySize, source, accessibilityRequirements },
      startAt,
      sessionId,
    });
    const result = await repository.confirmHold({
      holdId: hold.id,
      idempotencyKey: randomUUID(),
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email?.trim() || undefined,
        preferredLanguage: "it",
        // Chi prenota per telefono o al banco dà il consenso nella
        // conversazione, non spuntando una casella: lo staff lo raccoglie
        // registrando la prenotazione, non un modulo assente in questo flusso.
        marketingConsent: false,
        privacyConsent: true,
        allergies: customer.allergies || undefined,
        accessibilityNeeds: customer.accessibilityNeeds || undefined,
      },
      customerNotes,
    });
    return success(result, { status: 201 });
  } catch (error) { return failure(error); }
}
