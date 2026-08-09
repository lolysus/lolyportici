import "server-only";

import postgres, { type Sql } from "postgres";

const globalDatabase = globalThis as typeof globalThis & { __lolyPostgres?: Sql };

export function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL);
}

/**
 * Quante connessioni tenere aperte, per istanza.
 *
 * Railway è **un** processo che vive a lungo: dieci connessioni sono un pool
 * sano. Vercel è tante istanze corte, e ognuna aprirebbe il proprio pool: con
 * dieci a testa bastano cinquanta istanze in contemporanea per esaurire le 500
 * connessioni del database e far cadere tutto, pagine e API insieme. Tre per
 * istanza lasciano lo stesso margine con molte più istanze.
 *
 * Il numero non è una micro-ottimizzazione: è la differenza fra un picco di
 * traffico servito e un errore di connessione su entrambi i ristoranti.
 */
function poolSize() {
  return process.env.VERCEL ? 3 : 10;
}

export function getPostgres() {
  const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  globalDatabase.__lolyPostgres ??= postgres(databaseUrl, {
    max: poolSize(),
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: databaseUrl.includes("railway.internal") ? false : "require",
    transform: { undefined: null },
  });
  return globalDatabase.__lolyPostgres;
}
