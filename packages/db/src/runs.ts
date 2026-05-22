import { getPool } from "./client.js";
import type { Run, RunStatus, RunSummary } from "./types.js";

type RunRow = {
  id: string;
  tenant_id: string | null;
  status: RunStatus;
  model: string;
  system: string | null;
  input: string;
  tools: { name: string }[];
  output: string | null;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
};

function mapRun(row: RunRow): Run {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    status: row.status,
    model: row.model,
    system: row.system,
    input: row.input,
    tools: row.tools ?? [],
    output: row.output,
    error: row.error,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    createdAt: row.created_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

export async function createRun(input: {
  tenantId: string;
  model: string;
  system?: string;
  input: string;
  tools: { name: string }[];
}): Promise<Run> {
  const pool = getPool();
  const res = await pool.query<RunRow>(
    `insert into runs (tenant_id, status, model, system, input, tools, started_at)
     values ($1, 'running', $2, $3, $4, $5::jsonb, now())
     returning *`,
    [
      input.tenantId,
      input.model,
      input.system ?? null,
      input.input,
      JSON.stringify(input.tools),
    ],
  );
  return mapRun(res.rows[0]!);
}

export async function completeRun(input: {
  id: string;
  output: string;
  inputTokens: number | null;
  outputTokens: number | null;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `update runs
       set status = 'completed',
           output = $2,
           input_tokens = $3,
           output_tokens = $4,
           completed_at = now()
     where id = $1`,
    [input.id, input.output, input.inputTokens, input.outputTokens],
  );
}

export async function failRun(input: { id: string; error: string }): Promise<void> {
  const pool = getPool();
  await pool.query(
    `update runs set status = 'failed', error = $2, completed_at = now() where id = $1`,
    [input.id, input.error],
  );
}

export async function getRun(tenantId: string, id: string): Promise<Run | null> {
  const pool = getPool();
  const res = await pool.query<RunRow>(
    "select * from runs where id = $1 and tenant_id = $2",
    [id, tenantId],
  );
  return res.rows[0] ? mapRun(res.rows[0]) : null;
}

export async function listRuns(input: {
  tenantId: string;
  limit?: number;
  status?: RunStatus;
}): Promise<RunSummary[]> {
  const pool = getPool();
  const limit = Math.min(input.limit ?? 50, 200);
  const params: unknown[] = [limit, input.tenantId];
  let where = "where tenant_id = $2";
  if (input.status) {
    where += " and status = $3";
    params.push(input.status);
  }
  const res = await pool.query<
    RunRow & { duration_ms: number | null }
  >(
    `select *,
            case when completed_at is not null and started_at is not null
              then (extract(epoch from (completed_at - started_at)) * 1000)::int
              else null end as duration_ms
       from runs
       ${where}
       order by created_at desc
       limit $1`,
    params,
  );
  return res.rows.map((row) => ({
    id: row.id,
    status: row.status,
    model: row.model,
    inputPreview: row.input.length > 120 ? row.input.slice(0, 117) + "..." : row.input,
    outputPreview:
      row.output && row.output.length > 200 ? row.output.slice(0, 197) + "..." : row.output,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    durationMs: row.duration_ms,
  }));
}
