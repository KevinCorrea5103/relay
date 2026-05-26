// ClickHouse sink for run_events.
//
// Behavior is gated by env so we can introduce ClickHouse incrementally:
//
//   CLICKHOUSE_URL    unset      → ClickHouse disabled. Postgres-only.
//   CLICKHOUSE_URL    set        → events are written to Postgres AND
//                                  ClickHouse (double-write). Reads still
//                                  come from Postgres.
//   READ_EVENTS_FROM=clickhouse  → reads use ClickHouse instead of Postgres.
//                                  Only flip this after a double-write
//                                  window where you've verified counts
//                                  match.
//
// Implementation note: we batch inserts in memory and flush every 500ms or
// 1k events. Single-event writes to ClickHouse are anti-pattern (each one
// creates a part) — batching is essential.

type EventInsert = {
  tenantId: string;
  runId: string;
  seq: number;
  eventType: string;
  payload: Record<string, unknown>;
  ts?: Date;
};

const FLUSH_MS = 500;
const FLUSH_SIZE = 1000;

class ClickHouseSink {
  private url: string;
  private user: string;
  private password: string;
  private database: string;
  private buffer: EventInsert[] = [];
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;
  private enabled: boolean;

  constructor() {
    const raw = process.env.CLICKHOUSE_URL?.trim() ?? "";
    this.enabled = raw.length > 0;
    // CLICKHOUSE_URL format: http(s)://user:password@host:8123/database
    if (!this.enabled) {
      this.url = "";
      this.user = "";
      this.password = "";
      this.database = "default";
      return;
    }
    const u = new URL(raw);
    this.user = decodeURIComponent(u.username) || "default";
    this.password = decodeURIComponent(u.password) || "";
    this.database = u.pathname.replace(/^\//, "") || "default";
    u.username = "";
    u.password = "";
    u.pathname = "/";
    this.url = u.toString().replace(/\/$/, "");
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Fire-and-forget. The caller (the SSE persistence path) cannot block on
  // ClickHouse — Postgres remains the source of truth during double-write.
  enqueue(e: EventInsert): void {
    if (!this.enabled) return;
    this.buffer.push(e);
    if (this.buffer.length >= FLUSH_SIZE) {
      void this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), FLUSH_MS);
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flushing = true;
    const batch = this.buffer;
    this.buffer = [];
    try {
      const body = batch
        .map((e) =>
          JSON.stringify({
            tenant_id: e.tenantId,
            run_id: e.runId,
            seq: e.seq,
            event_type: e.eventType,
            payload: JSON.stringify(e.payload),
            ts: (e.ts ?? new Date()).toISOString().replace("T", " ").replace("Z", ""),
          }),
        )
        .join("\n");
      const params = new URLSearchParams({
        database: this.database,
        query:
          "INSERT INTO run_events (tenant_id, run_id, seq, event_type, payload, ts) FORMAT JSONEachRow",
      });
      const res = await fetch(`${this.url}/?${params.toString()}`, {
        method: "POST",
        headers: {
          "content-type": "application/x-ndjson",
          authorization:
            "Basic " +
            Buffer.from(`${this.user}:${this.password}`).toString("base64"),
        },
        body,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(
          `[clickhouse] insert failed: HTTP ${res.status} — ${text.slice(0, 200)}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[clickhouse] flush failed: ${message}`);
    } finally {
      this.flushing = false;
    }
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    if (!this.enabled) {
      throw new Error("CLICKHOUSE_URL not set");
    }
    const params = new URLSearchParams({
      database: this.database,
      query: sql + " FORMAT JSONEachRow",
    });
    const res = await fetch(`${this.url}/?${params.toString()}`, {
      method: "POST",
      headers: {
        authorization:
          "Basic " +
          Buffer.from(`${this.user}:${this.password}`).toString("base64"),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`clickhouse query failed: HTTP ${res.status} — ${text}`);
    }
    const text = await res.text();
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  }
}

export const clickhouse = new ClickHouseSink();

// Convenience for the persistence path. Called alongside the existing
// appendEvent(Postgres) call so writes are mirrored. Best-effort.
export function mirrorEventToClickhouse(input: {
  tenantId: string;
  runId: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
}): void {
  clickhouse.enqueue({
    tenantId: input.tenantId,
    runId: input.runId,
    seq: input.seq,
    eventType: input.type,
    payload: input.payload,
  });
}

export function shouldReadEventsFromClickhouse(): boolean {
  return (
    clickhouse.isEnabled() &&
    process.env.READ_EVENTS_FROM === "clickhouse"
  );
}
