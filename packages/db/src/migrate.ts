import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./client.js";

// In dev, migrations live at <repo>/migrations relative to this file.
// In production containers, the Dockerfile copies them to /app/migrations
// and sets MIGRATIONS_DIR. Honor the env first.
const here = fileURLToPath(new URL(".", import.meta.url));
const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? resolve(here, "../../../migrations");

async function main() {
  const pool = getPool();

  await pool.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (await pool.query<{ name: string }>("select name from schema_migrations")).rows.map(
      (r) => r.name,
    ),
  );

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] skip ${file}`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[migrate] apply ${file}`);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations(name) values ($1)", [file]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  console.log("[migrate] done");
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
