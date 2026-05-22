import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import {
  appendEvent,
  completeRun,
  createRun,
  deleteCredential,
  deleteMemory,
  deleteNamespace,
  failRun,
  getRun,
  listCredentials,
  listEvents,
  listMemories,
  listRuns,
  resolveCredential,
  upsertCredential,
  type ProviderName,
} from "@relay/db";
import { requireAuth, type AuthVars } from "./auth.js";
import { injectMemory, storeTurn, DEFAULT_NAMESPACE } from "./memory.js";
import { pendingTools } from "./pending-tools.js";
import { routeModel } from "./routing.js";

const RUNTIME_URL = process.env.RUNTIME_URL ?? "http://localhost:4100";
const PORT = Number(process.env.PORT ?? 4000);
const INTERNAL_SECRET = process.env.RELAY_INTERNAL_SECRET;
const TOOL_RESULT_TIMEOUT_MS = Number(
  process.env.RELAY_TOOL_RESULT_TIMEOUT_MS ?? 30_000,
);

if (!INTERNAL_SECRET) {
  console.warn(
    "[control-plane] RELAY_INTERNAL_SECRET is not set — /internal endpoints are unauthenticated. " +
      "Set it in production so only the runtime can call back.",
  );
}

const internalAuth: MiddlewareHandler = async (c, next) => {
  if (INTERNAL_SECRET) {
    const got = c.req.header("authorization");
    if (got !== `Internal ${INTERNAL_SECRET}`) {
      return c.json({ error: "internal auth failed" }, 401);
    }
  }
  await next();
};

const app = new Hono<{ Variables: AuthVars }>();
app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true }));

app.get(
  "/internal/runs/:id/tool-result/:toolUseId",
  internalAuth,
  async (c) => {
    const runId = c.req.param("id");
    const toolUseId = c.req.param("toolUseId");
    try {
      const output = await pendingTools.wait(
        runId,
        toolUseId,
        TOOL_RESULT_TIMEOUT_MS,
      );
      return c.json({ output });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 408);
    }
  },
);

app.use("/v1/*", requireAuth);

app.put("/v1/credentials/:provider", async (c) => {
  const provider = c.req.param("provider") as ProviderName;
  if (provider !== "anthropic" && provider !== "openai") {
    return c.json({ error: "unknown provider" }, 400);
  }
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.apiKey !== "string" || !body.apiKey) {
    return c.json({ error: "apiKey is required" }, 400);
  }
  const cred = await upsertCredential({
    tenantId: c.get("tenantId"),
    provider,
    apiKey: body.apiKey,
    label: typeof body.label === "string" ? body.label : undefined,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
  });
  return c.json({ credential: cred });
});

app.get("/v1/credentials", async (c) => {
  const creds = await listCredentials(c.get("tenantId"));
  return c.json({ credentials: creds });
});

app.delete("/v1/credentials/:provider", async (c) => {
  const provider = c.req.param("provider") as ProviderName;
  if (provider !== "anthropic" && provider !== "openai") {
    return c.json({ error: "unknown provider" }, 400);
  }
  const ok = await deleteCredential(c.get("tenantId"), provider);
  return c.json({ deleted: ok });
});

app.post("/v1/runs", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.input || !body.model) {
    return c.json({ error: "model and input are required" }, 400);
  }

  const routed = routeModel(body.model);
  if (!routed) {
    return c.json(
      { error: `cannot route model "${body.model}": unknown family` },
      400,
    );
  }

  const cred = await resolveCredential(tenantId, routed.provider);
  if (!cred) {
    return c.json(
      {
        error: `no ${routed.provider} credentials for this tenant`,
        hint: `PUT /v1/credentials/${routed.provider} with { apiKey: ... }`,
      },
      400,
    );
  }

  const tools = Array.isArray(body.tools) ? body.tools : [];
  const memoryNamespace = resolveNamespace(body.memory);
  const userInput: string = body.input;
  const baseSystem: string | undefined =
    typeof body.system === "string" ? body.system : undefined;

  const run = await createRun({
    tenantId,
    model: body.model,
    system: baseSystem,
    input: userInput,
    tools: tools.map((t: { name: string }) => ({ name: t.name })),
  });

  let effectiveSystem = baseSystem;
  let memorySeq = 0;
  if (memoryNamespace) {
    try {
      const { system, retrieved } = await injectMemory({
        tenantId,
        namespace: memoryNamespace,
        userInput,
        baseSystem,
      });
      effectiveSystem = system;
      await appendEvent({
        runId: run.id,
        seq: memorySeq++,
        type: "memory_retrieved",
        payload: {
          type: "memory_retrieved",
          namespace: memoryNamespace,
          count: retrieved.length,
          memories: retrieved.map((m) => ({
            id: m.id,
            content: m.content,
            similarity: Number(m.similarity.toFixed(4)),
            createdAt: m.createdAt,
          })),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[control-plane] memory retrieval failed:`, message);
      await failRun({ id: run.id, error: `memory: ${message}` });
      return c.json({ error: "memory retrieval failed", detail: message }, 400);
    }
  }

  const upstream = await fetch(`${RUNTIME_URL}/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-run-id": run.id,
    },
    body: JSON.stringify({
      runId: run.id,
      model: routed.model,
      system: effectiveSystem,
      input: userInput,
      tools,
      credentials: {
        provider: routed.provider,
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl ?? undefined,
      },
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => upstream.statusText);
    await failRun({ id: run.id, error: `runtime ${upstream.status}: ${text}` });
    return c.json({ error: "runtime rejected run", detail: text }, 502);
  }

  const teeStream = tapAndPersist(upstream.body, {
    tenantId,
    runId: run.id,
    startSeq: memorySeq,
    memoryNamespace,
    userInput,
  });

  return new Response(teeStream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-run-id": run.id,
      connection: "keep-alive",
    },
  });
});

app.get("/v1/runs", async (c) => {
  const status = c.req.query("status") as
    | "running"
    | "completed"
    | "failed"
    | "canceled"
    | undefined;
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : undefined;
  const runs = await listRuns({ tenantId: c.get("tenantId"), status, limit });
  return c.json({ runs });
});

app.get("/v1/runs/:id", async (c) => {
  const run = await getRun(c.get("tenantId"), c.req.param("id"));
  if (!run) return c.json({ error: "not found" }, 404);
  return c.json({ run });
});

app.get("/v1/runs/:id/events", async (c) => {
  const run = await getRun(c.get("tenantId"), c.req.param("id"));
  if (!run) return c.json({ error: "not found" }, 404);
  const events = await listEvents(run.id);
  return c.json({ run, events });
});

app.post("/v1/runs/:id/tool-results/:toolUseId", async (c) => {
  const tenantId = c.get("tenantId");
  const runId = c.req.param("id");
  const toolUseId = c.req.param("toolUseId");

  const run = await getRun(tenantId, runId);
  if (!run) return c.json({ error: "not found" }, 404);

  const body = await c.req.json().catch(() => null);
  if (!body || !("output" in body)) {
    return c.json({ error: "output is required" }, 400);
  }

  pendingTools.resolve(runId, toolUseId, body.output);
  return c.json({ ok: true });
});

app.get("/v1/memories", async (c) => {
  const namespace = c.req.query("namespace") ?? undefined;
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : undefined;
  const memories = await listMemories({
    tenantId: c.get("tenantId"),
    namespace,
    limit,
  });
  return c.json({ memories });
});

app.delete("/v1/memories/:id", async (c) => {
  const ok = await deleteMemory(c.get("tenantId"), c.req.param("id"));
  return c.json({ deleted: ok });
});

app.delete("/v1/memories", async (c) => {
  const namespace = c.req.query("namespace");
  if (!namespace) {
    return c.json({ error: "namespace query param is required" }, 400);
  }
  const count = await deleteNamespace(c.get("tenantId"), namespace);
  return c.json({ deleted: count });
});

function resolveNamespace(memory: unknown): string | null {
  if (memory === true) return DEFAULT_NAMESPACE;
  if (typeof memory === "object" && memory !== null) {
    const ns = (memory as { namespace?: unknown }).namespace;
    if (typeof ns === "string" && ns.length > 0) return ns;
    return DEFAULT_NAMESPACE;
  }
  return null;
}

type StreamContext = {
  tenantId: string;
  runId: string;
  startSeq: number;
  memoryNamespace: string | null;
  userInput: string;
};

function tapAndPersist(
  upstream: ReadableStream<Uint8Array>,
  ctx: StreamContext,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let seq = ctx.startSeq;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          if (buffer.trim()) await persistFrame(buffer, ctx, seq++);
          controller.close();
          return;
        }

        controller.enqueue(value);
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          await persistFrame(frame, ctx, seq++);
        }
      } catch (err) {
        console.error(`[control-plane] stream error:`, err);
        await failRun({
          id: ctx.runId,
          error: err instanceof Error ? err.message : String(err),
        }).catch(() => {});
        controller.error(err);
      }
    },
    async cancel(reason) {
      console.warn(`[control-plane] stream canceled run=${ctx.runId}:`, reason);
      await reader.cancel(reason).catch(() => {});
    },
  });
}

async function persistFrame(
  frame: string,
  ctx: StreamContext,
  seq: number,
) {
  const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
  if (!dataLine) return;
  const payload = dataLine.slice(5).trim();
  if (!payload) return;

  let event: { type?: string } & Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return;
  }
  const type = event.type ?? "unknown";

  try {
    await appendEvent({ runId: ctx.runId, seq, type, payload: event });
  } catch (err) {
    console.error(`[control-plane] persist event seq=${seq} failed:`, err);
  }

  if (type === "done") {
    const output = typeof event.output === "string" ? event.output : "";
    await completeRun({
      id: ctx.runId,
      output,
      inputTokens:
        (event.usage as { input_tokens?: number } | undefined)?.input_tokens ??
        null,
      outputTokens:
        (event.usage as { output_tokens?: number } | undefined)?.output_tokens ??
        null,
    }).catch((err: unknown) =>
      console.error(`[control-plane] complete run failed:`, err),
    );

    if (ctx.memoryNamespace && output) {
      storeTurn({
        tenantId: ctx.tenantId,
        namespace: ctx.memoryNamespace,
        runId: ctx.runId,
        userInput: ctx.userInput,
        assistantOutput: output,
      }).catch((err: unknown) =>
        console.error(`[control-plane] memory store failed:`, err),
      );
    }
  } else if (type === "error") {
    const message =
      typeof event.message === "string" ? event.message : "unknown error";
    await failRun({ id: ctx.runId, error: message }).catch((err: unknown) =>
      console.error(`[control-plane] fail run failed:`, err),
    );
  }
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[control-plane] listening on http://localhost:${info.port}`);
  console.log(`[control-plane] proxying runs to ${RUNTIME_URL}`);
});
