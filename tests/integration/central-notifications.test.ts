import { beforeEach, describe, expect, it } from "vitest";
import { GET as listReservations } from "@/app/api/admin/v1/reservations/route";
import { restaurantLocations } from "@/config/brand";
import { getRepository } from "@/repositories";
import { resetMemoryRepositoryForTests } from "@/repositories/memory-repository";

describe("central notification reservation feed", () => {
  beforeEach(() => {
    resetMemoryRepositoryForTests();
  });

  it("returns reservations from both restaurants for the CEO notification feed", async () => {
    const expectedCount = (await Promise.all(
      restaurantLocations.map((location) => getRepository(location.id).listReservations()),
    )).flat().length;

    const response = await listReservations(new Request("http://localhost/api/admin/v1/reservations?scope=all"));
    const payload = await response.json() as { data: Array<{ locationId: string; createdAt: string }> };

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(expectedCount);
    expect(new Set(payload.data.map((reservation) => reservation.locationId))).toEqual(new Set(restaurantLocations.map((location) => location.id)));
    expect(payload.data.map((reservation) => reservation.createdAt)).toEqual([...payload.data].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((reservation) => reservation.createdAt));
  });
});
