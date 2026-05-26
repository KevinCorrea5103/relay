import pg from "pg";
import { getAdminPool } from "./client.js";
import { open, seal } from "./encryption.js";

type Queryable = pg.Pool | pg.PoolClient;
const q = (c?: pg.PoolClient): Queryable => c ?? getAdminPool();

export type ProviderName = "anthropic" | "openai";

export type CredentialDescriptor = {
  tenantId: string;
  provider: ProviderName;
  label: string | null;
  baseUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedCredential = CredentialDescriptor & {
  apiKey: string;
};

type Row = {
  tenant_id: string;
  provider: ProviderName;
  label: string | null;
  ciphertext: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
  base_url: string | null;
  created_at: Date;
  updated_at: Date;
};

const mapDescriptor = (r: Row): CredentialDescriptor => ({
  tenantId: r.tenant_id,
  provider: r.provider,
  label: r.label,
  baseUrl: r.base_url,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export async function upsertCredential(
  input: {
    tenantId: string;
    provider: ProviderName;
    apiKey: string;
    label?: string;
    baseUrl?: string;
  },
  client?: pg.PoolClient,
): Promise<CredentialDescriptor> {
  const sealed = seal(input.apiKey);
  const res = await q(client).query<Row>(
    `insert into provider_credentials
        (tenant_id, provider, label, ciphertext, iv, auth_tag, base_url, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (tenant_id, provider) do update
        set label = excluded.label,
            ciphertext = excluded.ciphertext,
            iv = excluded.iv,
            auth_tag = excluded.auth_tag,
            base_url = excluded.base_url,
            updated_at = now()
     returning *`,
    [
      input.tenantId,
      input.provider,
      input.label ?? null,
      sealed.ciphertext,
      sealed.iv,
      sealed.authTag,
      input.baseUrl ?? null,
    ],
  );
  return mapDescriptor(res.rows[0]!);
}

export async function listCredentials(
  tenantId: string,
  client?: pg.PoolClient,
): Promise<CredentialDescriptor[]> {
  const res = await q(client).query<Row>(
    `select * from provider_credentials where tenant_id = $1 order by provider`,
    [tenantId],
  );
  return res.rows.map(mapDescriptor);
}

export async function resolveCredential(
  tenantId: string,
  provider: ProviderName,
  client?: pg.PoolClient,
): Promise<ResolvedCredential | null> {
  const res = await q(client).query<Row>(
    `select * from provider_credentials where tenant_id = $1 and provider = $2`,
    [tenantId, provider],
  );
  const row = res.rows[0];
  if (!row) return null;
  const apiKey = open({
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.auth_tag,
  });
  return { ...mapDescriptor(row), apiKey };
}

export async function deleteCredential(
  tenantId: string,
  provider: ProviderName,
  client?: pg.PoolClient,
): Promise<boolean> {
  const res = await q(client).query(
    `delete from provider_credentials where tenant_id = $1 and provider = $2`,
    [tenantId, provider],
  );
  return (res.rowCount ?? 0) > 0;
}
