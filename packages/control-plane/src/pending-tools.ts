import {
  connect,
  StringCodec,
  type NatsConnection,
  type KV,
} from "nats";

type Key = `${string}:${string}`;

export interface ToolBroker {
  wait(runId: string, toolUseId: string, timeoutMs: number): Promise<unknown>;
  resolve(runId: string, toolUseId: string, value: unknown): Promise<void> | void;
}

// ─── In-memory broker (default, single-instance) ───────────────────────────

type Waiter = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

const RESULT_BUFFER_TTL_MS = 60_000;

class MemoryBroker implements ToolBroker {
  private waiters = new Map<Key, Waiter>();
  private results = new Map<Key, { value: unknown; gc: NodeJS.Timeout }>();

  private static makeKey(runId: string, toolUseId: string): Key {
    return `${runId}:${toolUseId}`;
  }

  wait(runId: string, toolUseId: string, timeoutMs: number): Promise<unknown> {
    const key = MemoryBroker.makeKey(runId, toolUseId);

    const buffered = this.results.get(key);
    if (buffered) {
      clearTimeout(buffered.gc);
      this.results.delete(key);
      return Promise.resolve(buffered.value);
    }

    if (this.waiters.has(key)) {
      return Promise.reject(new Error(`already awaiting result for ${key}`));
    }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(key);
        reject(new Error("tool result timed out"));
      }, timeoutMs);
      this.waiters.set(key, { resolve, reject, timer });
    });
  }

  resolve(runId: string, toolUseId: string, value: unknown): void {
    const key = MemoryBroker.makeKey(runId, toolUseId);
    const waiter = this.waiters.get(key);
    if (waiter) {
      clearTimeout(waiter.timer);
      this.waiters.delete(key);
      waiter.resolve(value);
      return;
    }
    const gc = setTimeout(() => this.results.delete(key), RESULT_BUFFER_TTL_MS);
    this.results.set(key, { value, gc });
  }
}

// ─── NATS JetStream KV broker (horizontal scale) ───────────────────────────
//
// Why: with multiple control-plane instances, an SDK POST can land on
// instance A while the runtime is long-polling instance B. The in-memory
// map can't reconcile that. NATS JetStream KV gives us a shared store
// with TTL and a `watch` primitive for the long-poll side.
//
// Layout:
//   bucket: relay_tool_results
//   key:    <runId>.<toolUseId>          (NATS subjects use `.` separators)
//   value:  JSON.stringify({ output })
//   ttl:    RESULT_BUFFER_TTL_MS         (KV-level GC, no timers needed)

const KV_BUCKET = "relay_tool_results";
const sc = StringCodec();

function kvKey(runId: string, toolUseId: string): string {
  // NATS KV keys must match /[-/_=\.a-zA-Z0-9]+/. UUIDs are safe.
  return `${runId}.${toolUseId}`;
}

class NatsBroker implements ToolBroker {
  constructor(private nc: NatsConnection, private kv: KV) {}

  static async connect(natsUrl: string): Promise<NatsBroker> {
    const nc = await connect({ servers: natsUrl, name: "relay-control-plane" });
    const js = nc.jetstream();
    // js.views.kv opens an existing bucket or creates it if missing.
    const kv = await js.views.kv(KV_BUCKET, {
      ttl: RESULT_BUFFER_TTL_MS,
      history: 1,
      description: "Pending custom-tool results, broker-side rendezvous.",
    });
    return new NatsBroker(nc, kv);
  }

  async wait(
    runId: string,
    toolUseId: string,
    timeoutMs: number,
  ): Promise<unknown> {
    const key = kvKey(runId, toolUseId);

    // Fast path: SDK already POSTed before runtime polled.
    const entry = await this.kv.get(key);
    if (entry && entry.operation === "PUT") {
      // consume so we never serve the same result twice
      await this.kv.delete(key).catch(() => undefined);
      return decode(entry.value);
    }

    // Slow path: watch for the next PUT on this key, bounded by timeout.
    const watch = await this.kv.watch({
      key,
      // include_history: false by default; we already checked current state above
    });

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        watch.stop();
        reject(new Error("tool result timed out"));
      }, timeoutMs);

      (async () => {
        try {
          for await (const e of watch) {
            if (e.operation !== "PUT") continue;
            clearTimeout(timer);
            watch.stop();
            await this.kv.delete(key).catch(() => undefined);
            resolve(decode(e.value));
            return;
          }
        } catch (err) {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      })();
    });
  }

  async resolve(
    runId: string,
    toolUseId: string,
    value: unknown,
  ): Promise<void> {
    const key = kvKey(runId, toolUseId);
    const payload = sc.encode(JSON.stringify({ output: value }));
    await this.kv.put(key, payload);
  }

  async close(): Promise<void> {
    await this.nc.drain();
  }
}

function decode(bytes: Uint8Array): unknown {
  const text = sc.decode(bytes);
  try {
    const parsed = JSON.parse(text);
    return parsed?.output;
  } catch {
    return text;
  }
}

// ─── Public singleton + bootstrap ──────────────────────────────────────────

let active: ToolBroker = new MemoryBroker();

export const pendingTools: ToolBroker = {
  wait: (runId, toolUseId, timeoutMs) =>
    active.wait(runId, toolUseId, timeoutMs),
  resolve: (runId, toolUseId, value) =>
    active.resolve(runId, toolUseId, value),
};

export async function initBroker(): Promise<{ kind: "memory" | "nats" }> {
  const natsUrl = process.env.NATS_URL?.trim();
  if (!natsUrl) {
    return { kind: "memory" };
  }
  try {
    active = await NatsBroker.connect(natsUrl);
    return { kind: "nats" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[control-plane] NATS_URL set but connection failed: ${message}. ` +
        `Falling back to in-memory broker (single-instance only).`,
    );
    return { kind: "memory" };
  }
}

// Test seam: only used by unit tests.
export const __TESTING__ = { MemoryBroker, NatsBroker };
