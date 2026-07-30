import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required");

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: databaseUrl.includes("railway.internal") ? false : "require",
  connect_timeout: 20,
});

await sql`
  create table if not exists public.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`;

const compatibilityFile = path.join("railway", "0000_supabase_compatibility.sql");
await sql.unsafe(await readFile(compatibilityFile, "utf8"));

const files = [
  ...(await readdir(path.join("supabase", "migrations")))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => path.join("supabase", "migrations", name)),
];

for (const file of files) {
  const migrationName = path.basename(file);
  const [alreadyApplied] = await sql`
    select name
    from public.schema_migrations
    where name = ${migrationName} or name like ${`%${migrationName}`}
  `;
  if (alreadyApplied) {
    console.log(`skip ${file}`);
  } else {
    const source = await readFile(file, "utf8");
    console.log(`apply ${file}`);
    await sql.begin(async (transaction) => {
      await transaction.unsafe(source);
      await transaction`
        insert into public.schema_migrations (name) values (${migrationName})
      `;
    });
  }

  if (file.endsWith("0001_core_schema.sql")) {
    await sql`
      insert into public.organizations
        (id, name, slug, status, plan, timezone, default_locale)
      values
        ('00000000-0000-0000-0000-000000000001', 'Regia Sushi',
         'regia-sushi', 'active', 'mvp', 'Europe/Rome', 'it')
      on conflict (id) do nothing
    `;
  }
}

await sql.end();
console.log("Railway migrations complete");
