import { z } from "zod";
import { databaseIdSchema } from "@/validators/booking";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { getRepository } from "@/repositories";
import { getAdminLocationFromRequest } from "@/lib/admin/location";

const schema = z.object({ id: databaseIdSchema, status: z.enum(["waiting","offered","converted","expired","cancelled"]) });

export async function PATCH(request: Request) { try { assertSameOrigin(request); const session = await requirePermission("reservations:write"); const location=getAdminLocationFromRequest(request, session); const parsed = schema.safeParse(await request.json()); if (!parsed.success) return validationFailure(parsed.error.flatten()); return success(await getRepository(location.id).updateWaitlist(parsed.data.id, parsed.data.status)); } catch (error) { return failure(error); } }
