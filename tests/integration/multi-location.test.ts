import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { restaurantLocations } from "@/config/brand";
import { getRestaurantSettings, updateRestaurantSettings } from "@/domains/settings/settings-service";
import { adminLocationCookie, getAdminLocationFromRequest } from "@/lib/admin/location";
import { getRepository } from "@/repositories";
import { resetMemoryRepositoryForTests } from "@/repositories/memory-repository";
import type { RestaurantSettings } from "@/types/settings";
import type { StaffSession } from "@/types/domain";

describe("multi-location administration", () => {
  let originalCentro: RestaurantSettings;
  let originalMare: RestaurantSettings;

  beforeEach(async () => {
    resetMemoryRepositoryForTests();
    [originalCentro, originalMare] = await Promise.all(restaurantLocations.map((location) => getRestaurantSettings(location.id)));
  });

  afterEach(async () => {
    await Promise.all([
      updateRestaurantSettings(originalCentro, restaurantLocations[0].id),
      updateRestaurantSettings(originalMare, restaurantLocations[1].id),
    ]);
  });

  it("keeps reservations scoped to the selected location", async () => {
    const [centro, mare] = await Promise.all(restaurantLocations.map((location) => getRepository(location.id).listReservations()));

    expect(centro.length).toBeGreaterThan(0);
    expect(mare.length).toBeGreaterThan(0);
    expect(centro.every((reservation) => reservation.locationId === restaurantLocations[0].id)).toBe(true);
    expect(mare.every((reservation) => reservation.locationId === restaurantLocations[1].id)).toBe(true);
  });

  it("keeps customer directories scoped to reservations of the selected location", async () => {
    for (const location of restaurantLocations) {
      const repository = getRepository(location.id);
      const [reservations, customers] = await Promise.all([repository.listReservations(), repository.listCustomers()]);
      const customerIds = new Set(reservations.map((reservation) => reservation.customerId));
      expect(customers.length).toBeGreaterThan(0);
      expect(customers.every((customer) => customerIds.has(customer.id))).toBe(true);
    }
  });

  it("keeps settings independent between Centro and Mare", async () => {
    await updateRestaurantSettings({
      ...originalMare,
      service: { ...originalMare.service, maximumCovers: 44 },
    }, restaurantLocations[1].id);

    expect((await getRestaurantSettings(restaurantLocations[1].id)).service.maximumCovers).toBe(44);
    expect((await getRestaurantSettings(restaurantLocations[0].id)).service.maximumCovers).toBe(originalCentro.service.maximumCovers);
  });

  it("keeps contact details independent between the two restaurants", async () => {
    // Le due sedi partono con recapiti diversi (seminati da brand.ts): prima
    // ancora di scrivere, non devono già essere uguali per un bug di lettura.
    expect(originalCentro.contact.phone).not.toBe(originalMare.contact.phone);

    await updateRestaurantSettings({
      ...originalMare,
      contact: { ...originalMare.contact, whatsapp: "+39 000 0000000" },
    }, restaurantLocations[1].id);

    expect((await getRestaurantSettings(restaurantLocations[1].id)).contact.whatsapp).toBe("+39 000 0000000");
    expect((await getRestaurantSettings(restaurantLocations[0].id)).contact.whatsapp).toBe(originalCentro.contact.whatsapp);
  });

  it("pauses bookings only for the selected location", async () => {
    await updateRestaurantSettings({
      ...originalMare,
      operations: { ...originalMare.operations, serviceMode: "paused" },
    }, restaurantLocations[1].id);

    const [centroContext, mareContext] = await Promise.all([
      getRepository(restaurantLocations[0].id).getAvailabilityContext(),
      getRepository(restaurantLocations[1].id).getAvailabilityContext(),
    ]);

    expect(centroContext.locationAvailable).toBe(true);
    expect(mareContext.locationAvailable).toBe(false);
  });

  it("applies the weekly schedule to the availability engine", async () => {
    const targetDay = 3;
    await updateRestaurantSettings({
      ...originalCentro,
      schedule: originalCentro.schedule.map((day) => day.dayOfWeek === targetDay
        ? { ...day, lunch: { ...day.lunch, enabled: false }, dinner: { ...day.dinner, enabled: false } }
        : day),
    }, restaurantLocations[0].id);

    const context = await getRepository(restaurantLocations[0].id).getAvailabilityContext();
    expect(context.servicePeriods.filter((service) => service.dayOfWeek === targetDay && service.isActive)).toHaveLength(0);
  });

  it("resolves the active location from the administration cookie", () => {
    const request = new Request("http://localhost/admin/dashboard", {
      headers: { cookie: `${adminLocationCookie}=${restaurantLocations[1].slug}` },
    });

    const session = {
      locationId: restaurantLocations[0].id,
      accessibleLocationIds: restaurantLocations.map((location) => location.id),
    } as StaffSession;
    expect(getAdminLocationFromRequest(request, session).id).toBe(restaurantLocations[1].id);
  });

  it("rejects a cookie that points outside the staff location scope", () => {
    const request = new Request("http://localhost/admin/dashboard", {
      headers: { cookie: `${adminLocationCookie}=${restaurantLocations[1].slug}` },
    });
    const session = {
      locationId: restaurantLocations[0].id,
      accessibleLocationIds: [restaurantLocations[0].id],
    } as StaffSession;
    expect(getAdminLocationFromRequest(request, session).id).toBe(restaurantLocations[0].id);
  });

  it("tiene separato l'avviso sulla puntualità fra le due sedi", async () => {
    // È il testo a cui il ristorante si appella quando deve spostare un tavolo:
    // ogni sede ha la sua tolleranza, e un testo condiviso ne farebbe applicare
    // a Portici una regola scritta per Ardea.
    expect(originalCentro.guestExperience.punctualityNotice.length).toBeGreaterThan(20);

    await updateRestaurantSettings({
      ...originalMare,
      guestExperience: { ...originalMare.guestExperience, punctualityNotice: "A Portici teniamo il tavolo dieci minuti." },
    }, restaurantLocations[1].id);

    const [centro, mare] = await Promise.all(restaurantLocations.map((location) => getRestaurantSettings(location.id)));
    expect(mare.guestExperience.punctualityNotice).toBe("A Portici teniamo il tavolo dieci minuti.");
    expect(centro.guestExperience.punctualityNotice).toBe(originalCentro.guestExperience.punctualityNotice);
  });
});
