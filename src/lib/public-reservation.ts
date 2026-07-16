import "server-only";

import { restaurantLocations } from "@/config/brand";
import { getRepository } from "@/repositories";

export async function findReservationForManagementToken(token: string) {
  const matches = await Promise.all(restaurantLocations.map(async (location) => {
    const repository = getRepository(location.id);
    const reservation = await repository.findReservationByToken(token);
    return reservation ? { location, repository, reservation } : null;
  }));
  return matches.find((match) => match !== null) ?? null;
}
