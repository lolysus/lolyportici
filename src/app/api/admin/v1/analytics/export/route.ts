import { requirePermission } from "@/lib/auth/dal";
import { failure } from "@/lib/api/response";
import { getRepository } from "@/repositories";
import { getAdminLocationFromRequest } from "@/lib/admin/location";
import { formatTimeInZone } from "@/lib/datetime";

// Next passa sempre la richiesta a un route handler: dichiararla opzionale
// fa fallire il typecheck contro i tipi di rotta generati (visto già su
// /api/admin/v1/reservations).
export async function GET(request: Request) {
  try {
    const session = await requirePermission("analytics:read");
    const location = getAdminLocationFromRequest(request, session);
    const rows = await getRepository(location.id).listReservations();
    const csv = ["code,date,time,party_size,status,source", ...rows.map((row) => [row.reservationCode, row.reservationDate, formatTimeInZone(row.startAt), row.partySize, row.status, row.source].join(","))].join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=sushi-${location.slug}-analytics.csv` } });
  } catch (error) { return failure(error); }
}
