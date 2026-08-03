import { beforeEach, describe, expect, it } from "vitest";
import { restaurantLocations } from "@/config/brand";
import { getRepository } from "@/repositories";
import { resetMemoryRepositoryForTests } from "@/repositories/memory-repository";

const [yuko, kousushi] = restaurantLocations;

function uniqueCode(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 9000 + 1000)}`;
}

describe("table configuration", () => {
  beforeEach(() => {
    resetMemoryRepositoryForTests();
  });

  it("adds a table that becomes bookable capacity", async () => {
    const repository = getRepository(yuko.id);
    const before = await repository.listTables();
    const created = await repository.createTable({
      code: uniqueCode("T"),
      displayName: "Tavolo veranda",
      minimumCapacity: 2,
      maximumCapacity: 6,
      isOutdoor: true,
      isAccessible: true,
    });

    expect(created.maximumCapacity).toBe(6);
    expect(created.isOutdoor).toBe(true);
    expect(created.diningAreaName).toBe(before.find((table) => table.isOutdoor)?.diningAreaName);

    const after = await repository.listTables();
    expect(after).toHaveLength(before.length + 1);

    // Un tavolo configurato deve entrare nel motore di disponibilità, non
    // restare un record decorativo.
    const context = await repository.getAvailabilityContext();
    expect(context.tables.some((table) => table.id === created.id)).toBe(true);
  });

  it("puts a new table in the area the restaurant already uses", async () => {
    // Le due sedi chiamano le proprie sale in modo diverso. Un tavolo nuovo
    // deve entrare in quella esistente, non far nascere un doppione.
    const repository = getRepository(yuko.id);
    const esistenti = await repository.listTables();
    const esterno = esistenti.find((table) => table.isOutdoor);
    expect(esterno).toBeDefined();

    const creato = await repository.createTable({
      code: uniqueCode("A"), displayName: "Tavolo dehors", minimumCapacity: 2, maximumCapacity: 4, isOutdoor: true, isAccessible: false,
    });

    expect(creato.diningAreaId).toBe(esterno!.diningAreaId);
    expect(creato.diningAreaName).toBe(esterno!.diningAreaName);
  });

  it("refuses two tables with the same number", async () => {
    const repository = getRepository(yuko.id);
    const code = uniqueCode("D");
    await repository.createTable({ code, displayName: "Primo", minimumCapacity: 2, maximumCapacity: 4, isOutdoor: false, isAccessible: false });

    await expect(repository.createTable({ code, displayName: "Secondo", minimumCapacity: 2, maximumCapacity: 4, isOutdoor: false, isAccessible: false }))
      .rejects.toThrowError(/già un tavolo/i);
  });

  it("moves a table between indoor and outdoor keeping the area consistent", async () => {
    const repository = getRepository(yuko.id);
    const esistenti = await repository.listTables();
    const salaInterna = esistenti.find((table) => !table.isOutdoor)!;
    const salaEsterna = esistenti.find((table) => table.isOutdoor)!;

    const created = await repository.createTable({ code: uniqueCode("M"), displayName: "Tavolo mobile", minimumCapacity: 2, maximumCapacity: 4, isOutdoor: false, isAccessible: false });
    expect(created.diningAreaId).toBe(salaInterna.diningAreaId);

    // Spostandolo fuori deve entrare nella sala esterna che il ristorante usa
    // già, qualunque nome le abbia dato.
    const moved = await repository.updateTable(created.id, { isOutdoor: true });
    expect(moved.isOutdoor).toBe(true);
    expect(moved.diningAreaId).toBe(salaEsterna.diningAreaId);
  });

  it("keeps each restaurant's tables private", async () => {
    const created = await getRepository(yuko.id).createTable({
      code: uniqueCode("P"), displayName: "Solo YUKO", minimumCapacity: 2, maximumCapacity: 4, isOutdoor: false, isAccessible: false,
    });

    const otherTables = await getRepository(kousushi.id).listTables();
    expect(otherTables.some((table) => table.id === created.id)).toBe(false);

    await expect(getRepository(kousushi.id).updateTable(created.id, { displayName: "Rubato" }))
      .rejects.toThrowError(/non trovato/i);
  });

  it("blocks deleting a table that still holds an active reservation", async () => {
    const repository = getRepository(yuko.id);
    const reservations = await repository.listReservations();
    const assigned = reservations.find((reservation) =>
      reservation.tableIds.length > 0
      && ["confirmed", "modified", "arriving", "late", "arrived", "seated"].includes(reservation.status));
    expect(assigned).toBeDefined();

    await expect(repository.deleteTable(assigned!.tableIds[0])).rejects.toThrowError(/prenotazioni attive/i);
  });

  it("removes a free table from availability", async () => {
    const repository = getRepository(yuko.id);
    const created = await repository.createTable({ code: uniqueCode("R"), displayName: "Da rimuovere", minimumCapacity: 2, maximumCapacity: 4, isOutdoor: false, isAccessible: false });

    await repository.deleteTable(created.id);

    const remaining = await repository.listTables();
    expect(remaining.some((table) => table.id === created.id)).toBe(false);
  });
});
