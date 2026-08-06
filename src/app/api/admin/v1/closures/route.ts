import { z } from "zod";
import { databaseIdSchema } from "@/validators/booking";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { getAdminLocationFromRequest } from "@/lib/admin/location";
import { getRepository } from "@/repositories";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido.");

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida."),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  type: z.enum(["full_closure", "partial_closure", "private_event", "maintenance"]),
  reason: z.string().trim().min(2).max(200),
})
  // Il database ha lo stesso vincolo: o entrambi gli orari o nessuno. Meglio
  // dirlo qui con parole comprensibili che far tornare un errore di constraint.
  .refine((value) => Boolean(value.startTime) === Boolean(value.endTime), {
    message: "Indica sia l’ora di inizio sia quella di fine, oppure nessuna delle due per chiudere tutto il giorno.",
    path: ["endTime"],
  })
  .refine((value) => !value.startTime || !value.endTime || value.endTime > value.startTime, {
    message: "L’ora di fine deve venire dopo quella di inizio.",
    path: ["endTime"],
  });

const deleteSchema = z.object({ id: databaseIdSchema });

export async function GET(request: Request) {
  try {
    const session = await requirePermission("reservations:read");
    const location = getAdminLocationFromRequest(request, session);
    return success(await getRepository(location.id).listClosures());
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("settings:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    return success(await getRepository(location.id).createClosure(parsed.data));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("settings:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    await getRepository(location.id).deleteClosure(parsed.data.id);
    return success({ id: parsed.data.id });
  } catch (error) { return failure(error); }
}
