import pg from "pg";

const DEFAULT_URL = "postgres://relay:relay@localhost:5434/relay";

// ─── Pools ─────────────────────────────────────────────────────────────────
//
// We keep two logical pools:
//
//   adminPool — connects as the DB owner (DATABASE_URL). Bypasses RLS by
//     virtue of being the table owner. Used for: migrations, bootstrap,
//     signup (tenant doesn't exist yet), the runtime's `/internal/*`
//     callbacks (which carry their own internal-secret auth).
//
//   appPool   — connects as the `relay_app` role (DATABASE_URL_APP). RLS
//     is enforced. Every checkout must SET app.tenant_id or set
//     app.bypass_rls = 'on' before issuing tenant-scoped queries — without
//     either, the policies hide all rows. That's the defense-in-depth.
//
// If DATABASE_URL_APP is missing we fall back to DATABASE_URL with a
// console warning. This keeps local dev frictionless while making the
// production gap loud.

let adminPool: pg.Pool | null = null;
let appPool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  // Back-compat: `getPool` returns the admin pool. New callers should pick
  // `getAdminPool` or `getAppPool` explicitly.
  return getAdminPool();
}

export function getAdminPool(): pg.Pool {
  if (adminPool) return adminPool;
  const connectionString = process.env.DATABASE_URL ?? DEFAULT_URL;
  adminPool = new pg.Pool({ connectionString, max: 10 });
  return adminPool;
}

export function getAppPool(): pg.Pool {
  if (appPool) return appPool;
  const url = process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL ?? DEFAULT_URL;
  if (!process.env.DATABASE_URL_APP) {
    console.warn(
      "[db] DATABASE_URL_APP not set — falling back to DATABASE_URL. " +
        "Production should connect the app as the relay_app role so RLS " +
        "policies actually enforce.",
    );
  }
  appPool = new pg.Pool({ connectionString: url, max: 10 });
  return appPool;
}

export type DB = pg.Pool;
export type DBClient = pg.PoolClient;

// ─── Per-request scoping ───────────────────────────────────────────────────
//
// Helpers that take a callback and run it inside a transaction with the
// right Postgres session variable set. The session var is consumed by the
// RLS policy in migration 004:
//
//     app.tenant_id    → policies allow rows where tenant_id matches
//     app.bypass_rls   → 'on' fully disables tenant isolation (admin use)
//
// SET LOCAL means the variable lives only for the duration of the
// transaction; pool checkout reuses connections freely without leaking
// state between requests.

export async function runAsTenant<T>(
  tenantId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    throw new Error("runAsTenant requires a tenantId");
  }
  const pool = getAppPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    // set_config(name, value, is_local). is_local = true ≡ SET LOCAL.
    await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function runAsAdmin<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getAppPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.bypass_rls', 'on', true)");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
