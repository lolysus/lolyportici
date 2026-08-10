import { z } from "zod";
import { databaseIdSchema } from "@/validators/booking";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { getAdminLocationFromRequest } from "@/lib/admin/location";
import { getRepository } from "@/repositories";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido.");

const createSchema = z.object({
  startTime: timeSchema,
  endTime: timeSchema,
  maxArrivals: z.number().int().min(1).max(200),
  isActive: z.boolean().optional(),
}).refine((value) => value.endTime > value.startTime, {
  message: "L'ora di fine deve venire dopo quella di inizio.",
  path: ["endTime"],
});

const updateSchema = z.object({
  id: databaseIdSchema,
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  maxArrivals: z.number().int().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 1, "Inserisci almeno una modifica.");

const deleteSchema = z.object({ id: databaseIdSchema });

export async function GET(request: Request) {
  try {
    const session = await requirePermission("reservations:read");
    const location = getAdminLocationFromRequest(request, session);
    return success(await getRepository(location.id).listCapacityBands());
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("settings:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    return success(await getRepository(location.id).createCapacityBand(parsed.data), { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("settings:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const { id, ...changes } = parsed.data;
    return success(await getRepository(location.id).updateCapacityBand(id, changes));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("settings:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    await getRepository(location.id).deleteCapacityBand(parsed.data.id);
    return success({ id: parsed.data.id });
  } catch (error) { return failure(error); }
}
