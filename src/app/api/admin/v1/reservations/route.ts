import { requirePermission } from "@/lib/auth/dal";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { getRepository } from "@/repositories";
import { z } from "zod";
import { reservationStatuses } from "@/types/domain";
import { databaseIdSchema } from "@/validators/booking";
import { getAccessibleAdminLocations, getAdminLocationFromRequest } from "@/lib/admin/location";
import { PermissionDeniedError } from "@/domains/bookings/errors";

const updateSchema = z.object({ id: databaseIdSchema, status: z.enum(reservationStatuses).optional(), tableIds: z.array(databaseIdSchema).min(1).optional(), customerNotes: z.string().trim().max(1000).optional() })
  .refine((value) => value.status !== undefined || value.tableIds !== undefined || value.customerNotes !== undefined, { message: "Nessuna modifica richiesta." });

export async function GET(request?: Request) {
  try {
    const session = await requirePermission("reservations:read");
    const scope = request ? new URL(request.url).searchParams.get("scope") : null;
    if (scope === "all") {
      if (!session.centralAccess) throw new PermissionDeniedError();
      const reservations = (await Promise.all(
        getAccessibleAdminLocations(session).map((location) => getRepository(location.id).listReservations()),
      )).flat().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return success(reservations);
    }
    const location = getAdminLocationFromRequest(request, session);
    return success(await getRepository(location.id).listReservations());
  }
  catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("reservations:write");
    const location = getAdminLocationFromRequest(request, session);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const { id, ...changes } = parsed.data;
    return success(await getRepository(location.id).updateReservationByStaff(id, changes));
  } catch (error) { return failure(error); }
}
