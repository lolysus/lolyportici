import { afterEach, describe, expect, it } from "vitest";
import { restaurantLocations } from "@/config/brand";
import { adminAccessKey, adminAccessPath, restaurantForAccessKey } from "@/config/admin-access";

const [yuko, kousushi] = restaurantLocations;
const original = process.env.ADMIN_ACCESS_PATHS;

afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_ACCESS_PATHS;
  else process.env.ADMIN_ACCESS_PATHS = original;
});

describe("ingressi riservati per sede", () => {
  it("dà a ogni ristorante un indirizzo diverso", () => {
    delete process.env.ADMIN_ACCESS_PATHS;
    // Se i due coincidessero, la porta di servizio non separerebbe nulla.
    expect(adminAccessKey(yuko)).not.toBe(adminAccessKey(kousushi));
    expect(adminAccessPath(yuko)).toBe(`/gestione/${adminAccessKey(yuko)}`);
  });

  it("non usa lo slug del ristorante come indirizzo", () => {
    delete process.env.ADMIN_ACCESS_PATHS;
    // Un indirizzo indovinabile (/gestione/yuko) non è un indirizzo riservato.
    expect(adminAccessKey(yuko)).not.toBe(yuko.slug);
    expect(adminAccessKey(kousushi)).not.toBe(kousushi.slug);
  });

  it("riconosce il ristorante dalla chiave e ignora le altre", () => {
    delete process.env.ADMIN_ACCESS_PATHS;
    expect(restaurantForAccessKey(adminAccessKey(yuko))?.slug).toBe(yuko.slug);
    expect(restaurantForAccessKey(adminAccessKey(kousushi))?.slug).toBe(kousushi.slug);
    expect(restaurantForAccessKey("gestione")).toBeNull();
    expect(restaurantForAccessKey(yuko.slug)).toBeNull();
    expect(restaurantForAccessKey("")).toBeNull();
    expect(restaurantForAccessKey(null)).toBeNull();
  });

  it("permette di sostituire un indirizzo senza toccare il codice", () => {
    process.env.ADMIN_ACCESS_PATHS = "yuko=ardea-nuovo-2026";
    expect(adminAccessKey(yuko)).toBe("ardea-nuovo-2026");
    expect(restaurantForAccessKey("ardea-nuovo-2026")?.slug).toBe(yuko.slug);
    // La sede non riconfigurata mantiene il suo, non resta senza ingresso.
    expect(restaurantForAccessKey(adminAccessKey(kousushi))?.slug).toBe(kousushi.slug);
  });

  it("ignora le voci malformate invece di lasciare una sede senza porta", () => {
    process.env.ADMIN_ACCESS_PATHS = "rotto,ignoto=chiave,=vuoto,yuko=";
    expect(restaurantForAccessKey(adminAccessKey(yuko))?.slug).toBe(yuko.slug);
    expect(restaurantForAccessKey("chiave")).toBeNull();
  });

  it("tratta maiuscole e spazi come lo stesso indirizzo", () => {
    process.env.ADMIN_ACCESS_PATHS = "kousushi=Portici-XYZ";
    expect(restaurantForAccessKey(" portici-xyz ")?.slug).toBe(kousushi.slug);
  });
});
