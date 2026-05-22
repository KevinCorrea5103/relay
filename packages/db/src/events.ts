import { getPool } from "./client.js";
import type { RunEvent } from "./types.js";

type EventRow = {
  run_id: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  ts: Date;
};

export async function appendEvent(input: {
  runId: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `insert into run_events (run_id, seq, type, payload)
     values ($1, $2, $3, $4::jsonb)
     on conflict (run_id, seq) do nothing`,
    [input.runId, input.seq, input.type, JSON.stringify(input.payload)],
  );
}

export async function listEvents(runId: string): Promise<RunEvent[]> {
  const pool = getPool();
  const res = await pool.query<EventRow>(
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
