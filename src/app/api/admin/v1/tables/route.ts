import { z } from "zod";
import { databaseIdSchema } from "@/validators/booking";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { getRepository } from "@/repositories";
import { getAdminLocationFromRequest } from "@/lib/admin/location";

const capacity = z.number().int().min(1).max(40);

const createSchema = z.object({
  code: z.string().trim().min(1).max(12),
  displayName: z.string().trim().min(1).max(60),
  minimumCapacity: capacity,
  maximumCapacity: capacity,
  isOutdoor: z.boolean(),
  isAccessible: z.boolean(),
}).refine((value) => value.maximumCapacity >= value.minimumCapacity, {
  message: "I posti massimi non possono essere meno dei posti minimi.",
  path: ["maximumCapacity"],
});

const updateSchema = z.object({
  id: databaseIdSchema,
  code: z.string().trim().min(1).max(12).optional(),
  displayName: z.string().trim().min(1).max(60).optional(),
  minimumCapacity: capacity.optional(),
  maximumCapacity: capacity.optional(),
  isOutdoor: z.boolean().optional(),
  isAccessible: z.boolean().optional(),
  status: z.enum(["available", "blocked", "out_of_service", "cleaning"]).optional(),
}).refine((value) => value.minimumCapacity === undefined || value.maximumCapacity === undefined || value.maximumCapacity >= value.minimumCapacity, {
  message: "I posti massimi non possono essere meno dei posti minimi.",
  path: ["maximumCapacity"],
});

const deleteSchema = z.object({ id: databaseIdSchema });

export async function GET(request: Request) {
  try {
    const session = await requirePermission("floor:read");
    const location = getAdminLocationFromRequest(request, session);
    return success(await getRepository(location.id).listTables());
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("floor:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    return success(await getRepository(location.id).createTable(parsed.data));
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("floor:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const { id, ...changes } = parsed.data;
    return success(await getRepository(location.id).updateTable(id, changes));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("floor:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    await getRepository(location.id).deleteTable(parsed.data.id);
    return success({ id: parsed.data.id });
  } catch (error) { return failure(error); }
}
