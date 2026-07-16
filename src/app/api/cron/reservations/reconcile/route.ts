import { timingSafeEqual } from "node:crypto";
import { reconcileReservationLifecycle } from "@/domains/bookings/reservation-lifecycle-service";

export const dynamic = "force-dynamic";

function hasValidCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) return Response.json({ success: false, error: { code: "UNAUTHORIZED", message: "Non autorizzato." } }, { status: 401 });
  const result = await reconcileReservationLifecycle();
  return Response.json({ success: true, data: result });
}
