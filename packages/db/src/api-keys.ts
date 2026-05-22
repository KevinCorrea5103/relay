import crypto from "node:crypto";
import { getPool } from "./client.js";

export type ApiKeyDescriptor = {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type MintedApiKey = {
  descriptor: ApiKeyDescriptor;
  secret: string;
};

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateSecret(): string {
  return "relay_live_" + crypto.randomBytes(32).toString("base64url");
}

type Row = {
  id: string;
  tenant_id: string;
  name: string;
  prefix: string;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
};

const map = (r: Row): ApiKeyDescriptor => ({
  id: r.id,
  tenantId: r.tenant_id,
  name: r.name,
  prefix: r.prefix,
  createdAt: r.created_at.toISOString(),
  lastUsedAt: r.last_used_at?.toISOString() ?? null,
  revokedAt: r.revoked_at?.toISOString() ?? null,
});

export async function mintApiKey(input: {
  tenantId: string;
  name: string;
}): Promise<MintedApiKey> {
  const pool = getPool();
  const secret = generateSecret();
  const hashed = hashKey(secret);
  const prefix = secret.slice(0, 16) + "…";
  const res = await pool.query<Row>(
    `insert into api_keys (tenant_id, name, prefix, hashed_secret)
     values ($1, $2, $3, $4)
     returning *`,
    [input.tenantId, input.name, prefix, hashed],
  );
  return { descriptor: map(res.rows[0]!), secret };
}

export async function authenticateApiKey(
  secret: string,
): Promise<{ tenantId: string; keyId: string } | null> {
  if (!secret || !secret.startsWith("relay_live_")) return null;
  const pool = getPool();
  const hashed = hashKey(secret);
  const res = await pool.query<{ id: string; tenant_id: string }>(
    `update api_keys
        set last_used_at = now()
      where hashed_secret = $1 and revoked_at is null
      returning id, tenant_id`,
    [hashed],
  );
  return res.rows[0]
    ? { tenantId: res.rows[0].tenant_id, keyId: res.rows[0].id }
    : null;
}

export async function listApiKeys(tenantId: string): Promise<ApiKeyDescriptor[]> {
  const pool = getPool();
  const res = await pool.query<Row>(
    `select * from api_keys where tenant_id = $1 order by created_at desc`,
    [tenantId],
  );
  return res.rows.map(map);
}

export async function revokeApiKey(
  tenantId: string,
  keyId: string,
): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    `update api_keys set revoked_at = now()
      where id = $1 and tenant_id = $2 and revoked_at is null`,
    [keyId, tenantId],
  );
  return (res.rowCount ?? 0) > 0;
}
