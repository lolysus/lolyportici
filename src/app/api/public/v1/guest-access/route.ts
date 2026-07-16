import { z } from "zod";
import { restaurantLocations } from "@/config/brand";
import { ReservationNotFoundError } from "@/domains/bookings/errors";
import { normalizePhone } from "@/domains/customers/normalization";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { getRepository } from "@/repositories";

const accessSchema = z.object({
  reservationCode: z.string().trim().min(4).max(40),
  phone: z.string().trim().min(6).max(40),
});

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "guest-access", 8);
    const parsed = accessSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const reservationCode = parsed.data.reservationCode.replace(/\s+/g, "").toUpperCase();
    const phone = normalizePhone(parsed.data.phone);
    const matches = await Promise.all(restaurantLocations.map(async (location) => {
      const reservations = await getRepository(location.id).listReservations();
      const reservation = reservations.find((item) => item.reservationCode.replace(/\s+/g, "").toUpperCase() === reservationCode && normalizePhone(item.customer.phone) === phone);
      return reservation ? { location, reservation } : null;
    }));
    const match = matches.find((item) => item !== null);
    if (!match) throw new ReservationNotFoundError();
    return success({
      customerName: match.reservation.customer.firstName,
      reservation: {
        code: match.reservation.reservationCode,
        status: match.reservation.status,
        partySize: match.reservation.partySize,
        reservationDate: match.reservation.reservationDate,
        startAt: match.reservation.startAt,
        restaurant: {
          name: match.location.name,
          shortName: match.location.shortName,
          slug: match.location.slug,
          logoPath: match.location.logoPath,
          address: match.location.address,
          city: match.location.city,
        },
      },
    });
  } catch (error) {
    return failure(error);
  }
}
