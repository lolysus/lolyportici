import "server-only";

import postgres, { type Sql } from "postgres";

const globalDatabase = globalThis as typeof globalThis & { __lolyPostgres?: Sql };

export function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL);
}

export function getPostgres() {
  const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  globalDatabase.__lolyPostgres ??= postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: databaseUrl.includes("railway.internal") ? false : "require",
    transform: { undefined: null },
  });
  return globalDatabase.__lolyPostgres;
}
