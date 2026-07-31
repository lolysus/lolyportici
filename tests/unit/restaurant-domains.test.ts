import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { restaurantLocations } from "@/config/brand";
import { foreignRestaurantSlugs, normalizeHost, restaurantForHost } from "@/config/domains";

const [yuko, kousushi] = restaurantLocations;
const original = process.env.NEXT_PUBLIC_RESTAURANT_DOMAINS;

describe("dedicated restaurant domains", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_RESTAURANT_DOMAINS = "yuko.it=yuko,www.yuko.it=yuko,kousushi.it=kousushi";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_RESTAURANT_DOMAINS;
    else process.env.NEXT_PUBLIC_RESTAURANT_DOMAINS = original;
  });

  it("resolves each domain to its own restaurant", () => {
    expect(restaurantForHost("yuko.it")?.slug).toBe(yuko.slug);
    expect(restaurantForHost("www.yuko.it")?.slug).toBe(yuko.slug);
    expect(restaurantForHost("kousushi.it")?.slug).toBe(kousushi.slug);
  });

  it("ignores port, casing and trailing dot", () => {
    expect(normalizeHost("YUKO.IT:3000")).toBe("yuko.it");
    expect(restaurantForHost("YUKO.it:443")?.slug).toBe(yuko.slug);
    expect(restaurantForHost("yuko.it.")?.slug).toBe(yuko.slug);
  });

  it("leaves unmapped hosts alone so the shared host keeps working", () => {
    expect(restaurantForHost("lolyportici.vercel.app")).toBeNull();
    expect(restaurantForHost(null)).toBeNull();
    expect(restaurantForHost("")).toBeNull();
  });

  it("treats an unconfigured mapping as no dedicated domains", () => {
    delete process.env.NEXT_PUBLIC_RESTAURANT_DOMAINS;
    expect(restaurantForHost("yuko.it")).toBeNull();
  });

  it("skips malformed entries and unknown slugs instead of crashing", () => {
    process.env.NEXT_PUBLIC_RESTAURANT_DOMAINS = "yuko.it=yuko,rotto,ignoto.it=inesistente,=vuoto";
    expect(restaurantForHost("yuko.it")?.slug).toBe(yuko.slug);
    expect(restaurantForHost("ignoto.it")).toBeNull();
  });

  it("names the other restaurant as the one to hide", () => {
    // È la lista che il proxy usa per far sparire l'altro locale: se tornasse
    // vuota, da yuko.it si potrebbe prenotare da KouSushi.
    expect(foreignRestaurantSlugs(yuko)).toEqual([kousushi.slug]);
    expect(foreignRestaurantSlugs(kousushi)).toEqual([yuko.slug]);
  });
});
