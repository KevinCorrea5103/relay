import { getPool } from "./client.js";

export type Memory = {
  id: string;
  tenantId: string;
  namespace: string;
  content: string;
  metadata: Record<string, unknown>;
  sourceRunId: string | null;
  createdAt: string;
  ttlAt: string | null;
};

export type MemoryWithScore = Memory & { similarity: number };

type Row = {
  id: string;
  tenant_id: string;
  namespace: string;
  content: string;
  metadata: Record<string, unknown>;
  source_run_id: string | null;
  created_at: Date;
  ttl_at: Date | null;
};

const map = (row: Row): Memory => ({
  id: row.id,
  tenantId: row.tenant_id,
  namespace: row.namespace,
  content: row.content,
  metadata: row.metadata,
  sourceRunId: row.source_run_id,
  createdAt: row.created_at.toISOString(),
  ttlAt: row.ttl_at?.toISOString() ?? null,
});

function toVectorLiteral(embedding: number[]): string {
  return "[" + embedding.join(",") + "]";
}

export async function insertMemory(input: {
  tenantId: string;
  namespace: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  sourceRunId?: string | null;
  ttlAt?: Date | null;
}): Promise<Memory> {
  const pool = getPool();
  const res = await pool.query<Row>(
    `insert into memories
        (tenant_id, namespace, content, embedding, metadata, source_run_id, ttl_at)
     values ($1, $2, $3, $4::vector, $5::jsonb, $6, $7)
     returning *`,
    [
      input.tenantId,
      input.namespace,
      input.content,
      toVectorLiteral(input.embedding),
      JSON.stringify(input.metadata ?? {}),
      input.sourceRunId ?? null,
      input.ttlAt ?? null,
    ],
  );
  return map(res.rows[0]!);
}

export async function searchMemories(input: {
  tenantId: string;
  namespace: string;
  queryEmbedding: number[];
  limit?: number;
}): Promise<MemoryWithScore[]> {
  const pool = getPool();
  const limit = Math.min(input.limit ?? 5, 50);
  const vec = toVectorLiteral(input.queryEmbedding);
  const res = await pool.query<Row & { similarity: number }>(
    `select *, (1 - (embedding <=> $1::vector))::float8 as similarity
       from memories
      where tenant_id = $2
        and namespace = $3
        and (ttl_at is null or ttl_at > now())
      order by embedding <=> $1::vector asc
      limit $4`,
    [vec, input.tenantId, input.namespace, limit],
  );
  return res.rows.map((r) => ({ ...map(r), similarity: r.similarity }));
}

export async function listMemories(input: {
  tenantId: string;
  namespace?: string;
  limit?: number;
}): Promise<Memory[]> {
  const pool = getPool();
  const limit = Math.min(input.limit ?? 100, 500);
  const params: unknown[] = [input.tenantId, limit];
  let where = "where tenant_id = $1";
  if (input.namespace) {
    where += " and namespace = $3";
    params.push(input.namespace);
  }
  const res = await pool.query<Row>(
    `select * from memories ${where} order by created_at desc limit $2`,
    params,
  );
  return res.rows.map(map);
}

export async function deleteMemory(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    `delete from memories where tenant_id = $1 and id = $2`,
    [tenantId, id],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function deleteNamespace(
  tenantId: string,
  namespace: string,
): Promise<number> {
  const pool = getPool();
  const res = await pool.query(
    `delete from memories where tenant_id = $1 and namespace = $2`,
    [tenantId, namespace],
  );
  return res.rowCount ?? 0;
}
