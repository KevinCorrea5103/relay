import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import {
  appendEvent,
  completeRun,
  createRun,
  createTenant,
  deleteCredential,
  deleteMemory,
  deleteNamespace,
  failRun,
  findTenantByName,
  getRun,
  listApiKeys,
  listAuditEvents,
  listCredentials,
  listEvents,
  listMemories,
  getRunTree,
  getWorkflowCost,
  listRuns,
  mintApiKey,
  recordAudit,
  resolveCredential,
  revokeApiKey,
  runAsTenant,
  upsertCredential,
  type ProviderName,
} from "@relayhq/db";
import { requireAuth, type AuthVars } from "./auth.js";
import { injectMemory, storeTurn, DEFAULT_NAMESPACE } from "./memory.js";
import { initBroker, pendingTools } from "./pending-tools.js";
import { initRateLimit, rateLimit } from "./rate-limit.js";
import { clickhouse, mirrorEventToClickhouse } from "./clickhouse.js";
import { handleSynthesize, handleTranscribe } from "./voice.js";
import { sendWelcomeEmail } from "./resend.js";
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

app.get("/", (c) =>
  c.json({
    name: "Relay API",
    description: "The backend cloud for reliable AI agents.",
    docs: "https://relaygh.dev/en/docs/api",
    landing: "https://relaygh.dev",
    repo: "https://github.com/KevinCorrea5103/relay",
    sdk: "https://www.npmjs.com/package/@relayhq/sdk",
    endpoints: {
      health: "/health",
      signup: "POST /v1/signup",
      runs: "POST /v1/runs (auth required)",
    },
  }),
);

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

// ─── Public: signup (no auth) ────────────────────────────────────────────
//
// Body:
//   {
//     email: string,
//     openaiApiKey?: string,
//     anthropicApiKey?: string,
//     openaiBaseUrl?: string
//   }
//
// Response (200):
//   { apiKey, tenant, providers, email: { sent, reason? } }
//
// Errors: 400 (invalid input), 409 (email already registered).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/v1/signup", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "invalid json body" }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return c.json({ error: "valid email required" }, 400);
  }

  const openaiApiKey =
    typeof body.openaiApiKey === "string" && body.openaiApiKey
      ? body.openaiApiKey.trim()
      : null;
  const anthropicApiKey =
    typeof body.anthropicApiKey === "string" && body.anthropicApiKey
      ? body.anthropicApiKey.trim()
      : null;
  const openaiBaseUrl =
    typeof body.openaiBaseUrl === "string" && body.openaiBaseUrl
      ? body.openaiBaseUrl.trim()
      : undefined;

  if (!openaiApiKey && !anthropicApiKey) {
    return c.json(
      { error: "at least one of openaiApiKey or anthropicApiKey is required" },
      400,
    );
  }

  const existing = await findTenantByName(email);
  if (existing) {
    return c.json(
      {
        error: "email already registered",
        hint: "API keys are hashed and can't be retrieved — sign up with a different email or contact the maintainer to reset.",
      },
      409,
    );
  }

  const tenant = await createTenant(email);
  const minted = await mintApiKey({
    tenantId: tenant.id,
    name: "cloud signup",
  });

  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = c.req.header("user-agent") ?? null;

  await recordAudit({
    tenantId: tenant.id,
    actor: { kind: "signup" },
    action: "tenant.signed_up",
    targetType: "tenant",
    targetId: tenant.id,
    metadata: { email },
    ipAddress: ip,
    userAgent: ua,
  });
  await recordAudit({
    tenantId: tenant.id,
    actor: { kind: "signup" },
    action: "api_key.created",
    targetType: "api_key",
    targetId: minted.descriptor.id,
    metadata: { name: minted.descriptor.name, prefix: minted.descriptor.prefix },
    ipAddress: ip,
    userAgent: ua,
  });

  const stored: ProviderName[] = [];
  if (openaiApiKey) {
    await upsertCredential({
      tenantId: tenant.id,
      provider: "openai",
      apiKey: openaiApiKey,
      label: "via signup",
      baseUrl: openaiBaseUrl,
    });
    stored.push("openai");
    await recordAudit({
      tenantId: tenant.id,
      actor: { kind: "signup" },
      action: "credential.created",
      targetType: "provider_credentials",
      targetId: "openai",
      ipAddress: ip,
      userAgent: ua,
    });
  }
  if (anthropicApiKey) {
    await upsertCredential({
      tenantId: tenant.id,
      provider: "anthropic",
      apiKey: anthropicApiKey,
      label: "via signup",
    });
    stored.push("anthropic");
    await recordAudit({
      tenantId: tenant.id,
      actor: { kind: "signup" },
      action: "credential.created",
      targetType: "provider_credentials",
      targetId: "anthropic",
      ipAddress: ip,
      userAgent: ua,
    });
  }

  const emailResult = await sendWelcomeEmail({
    to: email,
    apiKey: minted.secret,
  });
  if (!emailResult.sent) {
    console.warn(`[signup] welcome email not sent (${emailResult.reason})`);
  }

  return c.json({
    apiKey: minted.secret,
    tenant: { id: tenant.id, name: tenant.name },
    providers: stored,
    email: emailResult,
  });
});

app.use("/v1/*", requireAuth);
app.use("/v1/*", rateLimit("default"));

app.put("/v1/credentials/:provider", async (c) => {
  const provider = c.req.param("provider") as ProviderName;
  if (provider !== "anthropic" && provider !== "openai") {
    return c.json({ error: "unknown provider" }, 400);
  }
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.apiKey !== "string" || !body.apiKey) {
    return c.json({ error: "apiKey is required" }, 400);
  }
  const tenantId = c.get("tenantId");
  const { cred, wasUpdate } = await runAsTenant(tenantId, async (client) => {
    const existing = await listCredentials(tenantId, client);
    const wasUpdate = existing.some((cr) => cr.provider === provider);
    const cred = await upsertCredential(
      {
        tenantId,
        provider,
        apiKey: body.apiKey,
        label: typeof body.label === "string" ? body.label : undefined,
        baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      },
      client,
    );
    return { cred, wasUpdate };
  });
  await recordAudit({
    tenantId,
    actor: { kind: "api_key", keyId: c.get("keyId") },
    action: wasUpdate ? "credential.updated" : "credential.created",
    targetType: "provider_credentials",
    targetId: provider,
    metadata: { label: cred.label, hasBaseUrl: cred.baseUrl != null },
  });
  return c.json({ credential: cred });
});

app.get("/v1/credentials", async (c) => {
  const tenantId = c.get("tenantId");
  const creds = await runAsTenant(tenantId, (client) =>
    listCredentials(tenantId, client),
  );
  return c.json({ credentials: creds });
});

app.delete("/v1/credentials/:provider", async (c) => {
  const provider = c.req.param("provider") as ProviderName;
  if (provider !== "anthropic" && provider !== "openai") {
    return c.json({ error: "unknown provider" }, 400);
  }
  const tenantId = c.get("tenantId");
  const ok = await runAsTenant(tenantId, (client) =>
    deleteCredential(tenantId, provider, client),
  );
  if (ok) {
    await recordAudit({
      tenantId,
      actor: { kind: "api_key", keyId: c.get("keyId") },
      action: "credential.deleted",
      targetType: "provider_credentials",
      targetId: provider,
    });
  }
  return c.json({ deleted: ok });
});

// ─── API key rotation ──────────────────────────────────────────────────────
//
// Tenants manage their own set of bearer tokens. Typical rotation flow:
//   1. POST /v1/keys              → mint the new key, copy it into the
//                                   calling client(s)
//   2. (verify new key works)
//   3. DELETE /v1/keys/:oldKeyId  → revoke the previous one
//
// The hashed secret is never stored as plaintext — once minted, the secret
// is returned ONCE and cannot be recovered. The descriptor (id, prefix,
// timestamps) is always retrievable.

app.post("/v1/keys", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 120)
      : "rotated";
  const tenantId = c.get("tenantId");
  const minted = await runAsTenant(tenantId, (client) =>
    mintApiKey({ tenantId, name }, client),
  );
  await recordAudit({
    tenantId,
    actor: { kind: "api_key", keyId: c.get("keyId") },
    action: "api_key.created",
    targetType: "api_key",
    targetId: minted.descriptor.id,
    metadata: { name, prefix: minted.descriptor.prefix },
  });
  return c.json({ apiKey: minted.secret, descriptor: minted.descriptor }, 201);
});

app.get("/v1/keys", async (c) => {
  const tenantId = c.get("tenantId");
  const keys = await runAsTenant(tenantId, (client) =>
    listApiKeys(tenantId, client),
  );
  return c.json({ keys });
});

app.delete("/v1/keys/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const keyId = c.req.param("id");
  const callingKey = c.get("keyId");

  // Make accidental self-revocation a deliberate act.
  const force = c.req.query("force") === "true";
  if (keyId === callingKey && !force) {
    return c.json(
      {
        error:
          "refusing to revoke the API key used for this request. " +
          "Append ?force=true to override.",
      },
      400,
    );
  }

  const ok = await runAsTenant(tenantId, (client) =>
    revokeApiKey(tenantId, keyId, client),
  );
  if (ok) {
    await recordAudit({
      tenantId,
      actor: { kind: "api_key", keyId: callingKey },
      action: "api_key.revoked",
      targetType: "api_key",
      targetId: keyId,
      metadata: { selfRevoke: keyId === callingKey },
    });
  }
  return c.json({ revoked: ok });
});

// ─── Voice (Pattern A: pre/post) ───────────────────────────────────────────
//
// Both endpoints use the tenant's BYOK OpenAI credential. Audio bytes
// never hit our DB — we relay to OpenAI and stream the response back.

app.post("/v1/transcribe", (c) => handleTranscribe(c));
app.post("/v1/synthesize", (c) => handleSynthesize(c));

// ─── Audit log read endpoint ───────────────────────────────────────────────

app.get("/v1/audit", async (c) => {
  const tenantId = c.get("tenantId");
  const events = await runAsTenant(tenantId, (client) =>
    listAuditEvents(
      {
        tenantId,
        action: c.req.query("action") ?? undefined,
        limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
        before: c.req.query("before") ?? undefined,
      },
      client,
    ),
  );
  return c.json({ events });
});

app.post("/v1/runs", rateLimit("runs"), async (c) => {
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

  // Sub-agent composition: a run can declare itself a child of another.
  // The server validates the parent belongs to the same tenant (RLS would
  // catch it anyway, but a 400 is friendlier than a server-side surprise)
  // and propagates the parent's workflow_id so the whole tree shares one.
  let parentRunId: string | null = null;
  let workflowId: string | null = null;
  if (typeof body.parentRunId === "string" && body.parentRunId) {
    const parent = await getRun(tenantId, body.parentRunId);
    if (!parent) {
      return c.json(
        { error: `parentRunId "${body.parentRunId}" not found for this tenant` },
        400,
      );
    }
    parentRunId = parent.id;
    workflowId = parent.workflowId ?? parent.id;
  } else if (typeof body.workflowId === "string" && body.workflowId) {
    // Explicit workflowId without parent: a sibling join (rare but useful
    // for parallel fan-out where the caller created the workflow root).
    workflowId = body.workflowId;
  }

  const run = await createRun({
    tenantId,
    model: body.model,
    system: baseSystem,
    input: userInput,
    tools: tools.map((t: { name: string }) => ({ name: t.name })),
    parentRunId,
    workflowId,
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
        tenantId,
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
      "x-workflow-id": run.workflowId ?? run.id,
      "access-control-expose-headers": "x-run-id, x-workflow-id",
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
  const rootsOnly = c.req.query("roots") === "true";
  const workflowId = c.req.query("workflow") ?? undefined;
  const tenantId = c.get("tenantId");
  const runs = await runAsTenant(tenantId, (client) =>
    listRuns({ tenantId, status, limit, rootsOnly, workflowId }, client),
  );
  return c.json({ runs });
});

// Returns the full tree (depth-first) for a workflow. Each row is a run
// in the tree with `depth` and `parentRunId` for indented rendering.
app.get("/v1/workflows/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const workflowId = c.req.param("id");
  const [tree, cost] = await runAsTenant(tenantId, async (client) => {
    const tree = await getRunTree({ tenantId, workflowId }, client);
    if (tree.length === 0) return [tree, null];
    const cost = await getWorkflowCost({ tenantId, workflowId }, client);
    return [tree, cost];
  });
  if (tree.length === 0) return c.json({ error: "not found" }, 404);
  return c.json({ workflowId, runs: tree, cost });
});

app.get("/v1/runs/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const run = await runAsTenant(tenantId, (client) =>
    getRun(tenantId, c.req.param("id"), client),
  );
  if (!run) return c.json({ error: "not found" }, 404);
  return c.json({ run });
});

app.get("/v1/runs/:id/events", async (c) => {
  const tenantId = c.get("tenantId");
  const result = await runAsTenant(tenantId, async (client) => {
    const run = await getRun(tenantId, c.req.param("id"), client);
    if (!run) return null;
    const events = await listEvents(run.id, client);
    return { run, events };
  });
  if (!result) return c.json({ error: "not found" }, 404);
  return c.json(result);
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
  const tenantId = c.get("tenantId");
  const namespace = c.req.query("namespace") ?? undefined;
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : undefined;
  const memories = await runAsTenant(tenantId, (client) =>
    listMemories({ tenantId, namespace, limit }, client),
  );
  return c.json({ memories });
});

app.delete("/v1/memories/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const ok = await runAsTenant(tenantId, (client) =>
    deleteMemory(tenantId, id, client),
  );
  if (ok) {
    await recordAudit({
      tenantId,
      actor: { kind: "api_key", keyId: c.get("keyId") },
      action: "memory.deleted",
      targetType: "memory",
      targetId: id,
    });
  }
  return c.json({ deleted: ok });
});

app.delete("/v1/memories", async (c) => {
  const namespace = c.req.query("namespace");
  if (!namespace) {
    return c.json({ error: "namespace query param is required" }, 400);
  }
  const tenantId = c.get("tenantId");
  const count = await runAsTenant(tenantId, (client) =>
    deleteNamespace(tenantId, namespace, client),
  );
  if (count > 0) {
    await recordAudit({
      tenantId,
      actor: { kind: "api_key", keyId: c.get("keyId") },
      action: "memory.namespace_cleared",
      targetType: "namespace",
      targetId: namespace,
      metadata: { rowsDeleted: count },
    });
  }
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
    await appendEvent({
      runId: ctx.runId,
      tenantId: ctx.tenantId,
      seq,
      type,
      payload: event,
    });
    mirrorEventToClickhouse({
      runId: ctx.runId,
      tenantId: ctx.tenantId,
      seq,
      type,
      payload: event,
    });
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

async function start() {
  const [broker, rl] = await Promise.all([initBroker(), initRateLimit()]);
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`[control-plane] listening on http://localhost:${info.port}`);
    console.log(`[control-plane] proxying runs to ${RUNTIME_URL}`);
    console.log(
      `[control-plane] tool broker: ${broker.kind}` +
        (broker.kind === "memory"
          ? " (single-instance only — set NATS_URL to scale horizontally)"
          : ""),
    );
    console.log(
      `[control-plane] rate-limit backend: ${rl.kind}` +
        (rl.kind === "memory"
          ? " (per-replica only — set REDIS_URL to enforce fleet-wide)"
          : ""),
    );
    console.log(
      `[control-plane] clickhouse mirror: ${clickhouse.isEnabled() ? "on" : "off"}` +
        (clickhouse.isEnabled()
          ? process.env.READ_EVENTS_FROM === "clickhouse"
            ? " (READING from ClickHouse)"
            : " (double-write only, reading from Postgres)"
          : ""),
    );
  });
}

start().catch((err) => {
  console.error("[control-plane] failed to start:", err);
  process.exit(1);
});
