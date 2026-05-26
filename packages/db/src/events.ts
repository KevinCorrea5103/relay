import pg from "pg";
import { getAdminPool } from "./client.js";
import type { RunEvent } from "./types.js";

type Queryable = pg.Pool | pg.PoolClient;
const q = (c?: pg.PoolClient): Queryable => c ?? getAdminPool();

type EventRow = {
  run_id: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  ts: Date;
};

export async function appendEvent(
  input: {
    runId: string;
    tenantId: string;
    seq: number;
    type: string;
    payload: Record<string, unknown>;
  },
  client?: pg.PoolClient,
): Promise<void> {
  await q(client).query(
    `insert into run_events (run_id, tenant_id, seq, type, payload)
     values ($1, $2, $3, $4, $5::jsonb)
     on conflict (run_id, seq) do nothing`,
    [
      input.runId,
      input.tenantId,
      input.seq,
      input.type,
      JSON.stringify(input.payload),
    ],
  );
}

export async function listEvents(
  runId: string,
  client?: pg.PoolClient,
): Promise<RunEvent[]> {
  const res = await q(client).query<EventRow>(
    `select run_id, seq, type, payload, ts
       from run_events
      where run_id = $1
      order by seq asc`,
    [runId],
  );
  return res.rows.map((row) => ({
    runId: row.run_id,
    seq: row.seq,
    type: row.type,
    payload: row.payload,
    ts: row.ts.toISOString(),
  }));
}
