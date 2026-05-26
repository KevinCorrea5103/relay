import pg from "pg";
import { getAdminPool } from "./client.js";
import type {
  Run,
  RunStatus,
  RunSummary,
  RunTreeNode,
  WorkflowCost,
} from "./types.js";

type Queryable = pg.Pool | pg.PoolClient;
const q = (c?: pg.PoolClient): Queryable => c ?? getAdminPool();

type RunRow = {
  id: string;
  tenant_id: string | null;
  parent_run_id: string | null;
  workflow_id: string | null;
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
    parentRunId: row.parent_run_id,
    workflowId: row.workflow_id,
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

export async function createRun(
  input: {
    tenantId: string;
    model: string;
    system?: string;
    input: string;
    tools: { name: string }[];
    parentRunId?: string | null;
    workflowId?: string | null;
  },
  client?: pg.PoolClient,
): Promise<Run> {
  // workflow_id semantics:
  //   - caller passes one (child run / explicit join)  → use it
  //   - caller passes nothing AND no parent (root run) → set to the row's
  //     own id so descendants can join via workflow_id = root.id.
  // Two-step because Postgres snapshot isolation prevents an UPDATE in
  // the same statement from seeing the just-inserted row through a CTE.
  const ins = await q(client).query<RunRow>(
    `insert into runs
        (tenant_id, status, model, system, input, tools, started_at,
         parent_run_id, workflow_id)
     values ($1, 'running', $2, $3, $4, $5::jsonb, now(), $6, $7)
     returning *`,
    [
      input.tenantId,
      input.model,
      input.system ?? null,
      input.input,
      JSON.stringify(input.tools),
      input.parentRunId ?? null,
      input.workflowId ?? null,
    ],
  );
  let row = ins.rows[0]!;
  if (row.workflow_id === null) {
    const upd = await q(client).query<RunRow>(
      `update runs set workflow_id = id where id = $1 returning *`,
      [row.id],
    );
    row = upd.rows[0]!;
  }
  return mapRun(row);
}

export async function completeRun(
  input: {
    id: string;
    output: string;
    inputTokens: number | null;
    outputTokens: number | null;
  },
  client?: pg.PoolClient,
): Promise<void> {
  await q(client).query(
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

export async function failRun(
  input: { id: string; error: string },
  client?: pg.PoolClient,
): Promise<void> {
  await q(client).query(
    `update runs set status = 'failed', error = $2, completed_at = now() where id = $1`,
    [input.id, input.error],
  );
}

export async function getRun(
  tenantId: string,
  id: string,
  client?: pg.PoolClient,
): Promise<Run | null> {
  const res = await q(client).query<RunRow>(
    "select * from runs where id = $1 and tenant_id = $2",
    [id, tenantId],
  );
  return res.rows[0] ? mapRun(res.rows[0]) : null;
}

export async function listRuns(
  input: {
    tenantId: string;
    limit?: number;
    status?: RunStatus;
    // when true, only return top-level runs (no parent). Useful for
    // dashboard list views where each row should represent a workflow.
    rootsOnly?: boolean;
    workflowId?: string;
  },
  client?: pg.PoolClient,
): Promise<RunSummary[]> {
  const limit = Math.min(input.limit ?? 50, 200);
  const params: unknown[] = [limit, input.tenantId];
  let where = "where tenant_id = $2";
  if (input.status) {
    where += ` and status = $${params.length + 1}`;
    params.push(input.status);
  }
  if (input.rootsOnly) {
    where += " and parent_run_id is null";
  }
  if (input.workflowId) {
    where += ` and workflow_id = $${params.length + 1}`;
    params.push(input.workflowId);
  }
  const res = await q(client).query<RunRow & { duration_ms: number | null }>(
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

// Return the entire run tree under one workflow_id, ordered as a depth-first
// walk so dashboards can render an indented view directly.
export async function getRunTree(
  input: { tenantId: string; workflowId: string },
  client?: pg.PoolClient,
): Promise<RunTreeNode[]> {
  // Recursive CTE: anchor = root of workflow, recurse children by parent_run_id.
  const res = await q(client).query<
    RunRow & { duration_ms: number | null; depth: number }
  >(
    `with recursive tree as (
       select r.*, 0 as depth
         from runs r
        where r.tenant_id = $1
          and r.workflow_id = $2
          and r.parent_run_id is null
       union all
       select r.*, t.depth + 1 as depth
         from runs r
         join tree t on r.parent_run_id = t.id
        where r.tenant_id = $1
     )
     select *,
            case when completed_at is not null and started_at is not null
              then (extract(epoch from (completed_at - started_at)) * 1000)::int
              else null end as duration_ms
       from tree
      order by depth asc, created_at asc`,
    [input.tenantId, input.workflowId],
  );
  return res.rows.map((row) => ({
    id: row.id,
    parentRunId: row.parent_run_id,
    workflowId: row.workflow_id ?? row.id,
    depth: row.depth,
    status: row.status,
    model: row.model,
    inputPreview: row.input.length > 120 ? row.input.slice(0, 117) + "..." : row.input,
    outputPreview:
      row.output && row.output.length > 200
        ? row.output.slice(0, 197) + "..."
        : row.output,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    durationMs: row.duration_ms,
  }));
}

export async function getWorkflowCost(
  input: { tenantId: string; workflowId: string },
  client?: pg.PoolClient,
): Promise<WorkflowCost> {
  const res = await q(client).query<{
    n: string;
    in_t: string | null;
    out_t: string | null;
  }>(
    `select count(*)::text as n,
            coalesce(sum(input_tokens), 0)::text  as in_t,
            coalesce(sum(output_tokens), 0)::text as out_t
       from runs
      where tenant_id = $1 and workflow_id = $2`,
    [input.tenantId, input.workflowId],
  );
  const row = res.rows[0]!;
  return {
    workflowId: input.workflowId,
    runCount: Number(row.n),
    inputTokens: Number(row.in_t ?? 0),
    outputTokens: Number(row.out_t ?? 0),
  };
}
