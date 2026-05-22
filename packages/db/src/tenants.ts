import { getPool } from "./client.js";

export type Tenant = {
  id: string;
  name: string;
  createdAt: string;
};

type Row = { id: string; name: string; created_at: Date };

const map = (r: Row): Tenant => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at.toISOString(),
});

export async function createTenant(name: string): Promise<Tenant> {
  const pool = getPool();
  const res = await pool.query<Row>(
    `insert into tenants (name) values ($1) returning *`,
    [name],
  );
  return map(res.rows[0]!);
}

export async function findTenantByName(name: string): Promise<Tenant | null> {
  const pool = getPool();
  const res = await pool.query<Row>(
    `select * from tenants where name = $1`,
    [name],
  );
  return res.rows[0] ? map(res.rows[0]) : null;
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const pool = getPool();
  const res = await pool.query<Row>(`select * from tenants where id = $1`, [id]);
  return res.rows[0] ? map(res.rows[0]) : null;
}
