import pg from "pg";
import { getAdminPool } from "./client.js";

type Queryable = pg.Pool | pg.PoolClient;
const q = (c?: pg.PoolClient): Queryable => c ?? getAdminPool();

export type AuditActor =
  | { kind: "api_key"; keyId: string }
  | { kind: "admin" }
  | { kind: "system" }
  | { kind: "signup" };

export type AuditAction =
  // tenants
  | "tenant.signed_up"
  | "tenant.deleted"
  // api keys
  | "api_key.created"
  | "api_key.revoked"
  | "api_key.listed"
  // provider credentials
  | "credential.created"
  | "credential.updated"
  | "credential.deleted"
  // master key
  | "master_key.rotated"
  // memory
  | "memory.deleted"
  | "memory.namespace_cleared"
  // runs (security-relevant subset only)
  | "run.failed";

export type AuditEvent = {
  id: string;
  tenantId: string;
  actor: string;
  action: AuditAction | string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
};

function actorToString(actor: AuditActor): string {
  switch (actor.kind) {
    case "api_key":
      return `api_key:${actor.keyId}`;
    case "admin":
      return "admin";
    case "system":
      return "system";
    case "signup":
      return "signup";
  }
}

function map(r: Row): AuditEvent {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    actor: r.actor,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    metadata: r.metadata,
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    createdAt: r.created_at.toISOString(),
  };
}

// Fire-and-forget audit write. Best-effort; logging the failure but never
// throwing — an audit failure must NEVER mask the underlying business
// outcome from the caller. We use the admin pool here so the write doesn't
// depend on whatever session-scoped tenant context the caller has.
export async function recordAudit(input: {
  tenantId: string;
  actor: AuditActor;
  action: AuditAction | string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const pool = getAdminPool();
    await pool.query(
      `insert into audit_events
          (tenant_id, actor, action, target_type, target_id, metadata, ip_address, user_agent)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        input.tenantId,
        actorToString(input.actor),
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[audit] failed to record action=${input.action} tenant=${input.tenantId}: ${message}`,
    );
  }
}

export async function listAuditEvents(
  input: {
    tenantId: string;
    action?: string;
    limit?: number;
    before?: string;
  },
  client?: pg.PoolClient,
): Promise<AuditEvent[]> {
  const limit = Math.min(input.limit ?? 100, 500);
  const params: unknown[] = [input.tenantId, limit];
  let where = "where tenant_id = $1";
  if (input.action) {
    where += ` and action = $${params.length + 1}`;
    params.push(input.action);
  }
  if (input.before) {
    where += ` and created_at < $${params.length + 1}`;
    params.push(new Date(input.before));
  }
  const res = await q(client).query<Row>(
    `select * from audit_events ${where}
       order by created_at desc
       limit $2`,
    params,
  );
  return res.rows.map(map);
}
