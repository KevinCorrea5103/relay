import pg from "pg";

const DEFAULT_URL = "postgres://relay:relay@localhost:5434/relay";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL ?? DEFAULT_URL;
  pool = new pg.Pool({ connectionString, max: 10 });
  return pool;
}

export type DB = pg.Pool;
