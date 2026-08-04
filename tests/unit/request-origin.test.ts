import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getRequestOrigin/getRequestUrl are what keep canonical tags, sitemap and
 * robots.txt pointed at the domain a request actually arrived on. A single
 * static NEXT_PUBLIC_APP_URL used to feed all of these — every page on
 * every domain canonicalized to the same wrong host, verified live in
 * production before this fix. These tests pin the fix, not the symptom.
 */
function mockHeaders(values: Record<string, string>) {
  vi.doMock("next/headers", () => ({
    headers: async () => ({
      get: (key: string) => values[key.toLowerCase()] ?? null,
    }),
  }));
}

describe("getRequestOrigin", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("next/headers"));

  it("uses the real Host header of the incoming request", async () => {
    mockHeaders({ host: "yukoardea.it" });
    const { getRequestOrigin } = await import("@/lib/public-url");
    expect(await getRequestOrigin()).toBe("https://yukoardea.it");
  });

  it("prefers x-forwarded-host over host, as set by the platform proxy", async () => {
    mockHeaders({ host: "internal.railway.app", "x-forwarded-host": "kousushiportici.it", "x-forwarded-proto": "https" });
    const { getRequestOrigin } = await import("@/lib/public-url");
    expect(await getRequestOrigin()).toBe("https://kousushiportici.it");
  });

  it("falls back to the static app URL when headers() is unavailable", async () => {
    vi.doMock("next/headers", () => ({
      headers: async () => { throw new Error("no request context"); },
    }));
    const { getRequestOrigin, getPublicAppUrl } = await import("@/lib/public-url");
    expect(await getRequestOrigin()).toBe(getPublicAppUrl());
  });

  it("builds an absolute URL for a given path on the resolved host", async () => {
    mockHeaders({ host: "yukoardea.it" });
    const { getRequestUrl } = await import("@/lib/public-url");
    expect(await getRequestUrl("/it/book/yuko")).toBe("https://yukoardea.it/it/book/yuko");
  });
});
