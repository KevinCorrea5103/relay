# Relay

**The backend cloud for reliable AI agents.**

Memory, retries, tools, traces, and durable execution — without building
orchestration infrastructure yourself.

[![License](https://img.shields.io/badge/license-Apache%202.0-emerald)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-amber)](#)

```ts
const agent = createAgent({
  model: "claude-sonnet-4-6",
  tools: [github, slack],
});

await agent.run("Review the last PR");
```

Open source under Apache 2.0. Self-host with Docker Compose, or use the
hosted version (waitlist soon).

---

> v0.6 — semantic memory + custom function tools + BYOK encryption.
> Persistent traces, multi-provider routing, three services and Postgres.

## Architecture

```
caller (SDK / curl) ── Authorization: Bearer relay_live_…
     │
     ▼
control-plane (Hono/Node, :4000)
     │   1. authenticate api key → tenant
     │   2. route model (claude-* / gpt-* / o3-* / …) → provider name
     │   3. fetch + decrypt that tenant's credential for that provider
     │   4. POST to runtime with credentials in body
     │   5. persist every SSE event on the way back
     │
     ▼
runtime (Go, :4100)    ← stateless; no API keys, no Postgres
     │
     ├──► Anthropic API
     ├──► OpenAI API
     └──► OpenAI-compatible endpoints (configurable per-credential baseUrl)

dashboard (Next.js, :3000) ──► control-plane (uses its own RELAY_API_KEY)
```

## Data model

```
tenants                  who owns what
  └─ api_keys            Relay's own keys (relay_live_…); sha-256 hashed
  └─ provider_credentials per-provider LLM keys (AES-256-GCM at rest)
  └─ runs                each execution, scoped to a tenant
        └─ run_events    ordered event log per run
  └─ memories            pgvector(1536), namespaced, per-tenant
```

The master key (`RELAY_MASTER_KEY`) wraps the provider credentials. Without it,
nothing decrypts. Generate one with `pnpm db:keygen`.

## Layout

```
packages/
  sdk/             @relay/sdk
  control-plane/   @relay/control-plane
  db/              @relay/db (tenants, api-keys, credentials, runs, events)
runtime/           Go: stateless agent loop + providers (anthropic, openai)
apps/
  dashboard/       Next.js — internal observability (runs list + traces, :3000)
  web/             Next.js — marketing site + docs + login (i18n EN/ES, :3001)
examples/hello-agent/
examples/memory-demo/
migrations/
  001_init.sql
  002_byok.sql
  003_memory.sql
docker-compose.yml
```

## Full setup, first run

Prereqs: Node 20+, pnpm 9+, Go 1.22+, Docker, and at least one provider API key
(Anthropic or OpenAI).

```bash
# one-time install + build
pnpm install
cd runtime && go mod tidy && cd ..
pnpm --filter @relay/sdk build
pnpm --filter @relay/db build

# Postgres + schema
pnpm db:up
pnpm db:migrate

# generate a master key (persist it!)
export RELAY_MASTER_KEY=$(pnpm -s db:keygen)
echo "RELAY_MASTER_KEY=$RELAY_MASTER_KEY"   # save to your .env

# bootstrap: create tenant, mint api key, upload provider creds from env
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
pnpm db:bootstrap
# → prints RELAY_API_KEY=relay_live_…   (save this; not shown again)

export RELAY_API_KEY=relay_live_…
```

Then run the stack — note **no provider API keys** anywhere in service env:

```bash
# terminal A — runtime (stateless; no keys)
pnpm dev:runtime

# terminal B — control plane (needs RELAY_MASTER_KEY to decrypt creds)
RELAY_MASTER_KEY=$RELAY_MASTER_KEY pnpm dev:control-plane

# terminal C — dashboard (needs RELAY_API_KEY to authenticate its calls)
RELAY_API_KEY=$RELAY_API_KEY pnpm dev:dashboard
# open http://localhost:3000

# terminal C′ (optional) — marketing site + docs + login
pnpm dev:web
# open http://localhost:3001 (redirects to /en; also /es for Spanish)

# terminal D — fire agents (RELAY_API_KEY needed by the SDK)
pnpm example                                     # default model
RELAY_MODEL=gpt-4o-mini       pnpm example
RELAY_MODEL=claude-haiku-4-5  pnpm example "Compute (17+8)*3"
```

## Adding or rotating credentials at runtime

No restart needed — every request fetches fresh credentials.

```bash
# upload / rotate an Anthropic key
curl -X PUT http://localhost:4000/v1/credentials/anthropic \
  -H "authorization: Bearer $RELAY_API_KEY" \
  -H "content-type: application/json" \
  -d '{"apiKey":"sk-ant-...","label":"prod"}'

# list (never returns secrets)
curl http://localhost:4000/v1/credentials \
  -H "authorization: Bearer $RELAY_API_KEY"

# delete
curl -X DELETE http://localhost:4000/v1/credentials/openai \
  -H "authorization: Bearer $RELAY_API_KEY"
```

## How to test end-to-end

1. **Postgres healthy.** `docker compose ps` → `relay-postgres` healthy.
2. **Migrations applied.** `pnpm db:migrate` prints `apply 001_init.sql` and
   `apply 002_byok.sql` (or `skip` on re-run).
3. **Master key set.** `echo $RELAY_MASTER_KEY` not empty.
4. **Bootstrap.** `pnpm db:bootstrap` prints a `relay_live_…` key and
   `stored credentials: …` for each provider you had in env.
5. **Runtime health.** `curl localhost:4100/health` →
   `{"ok":true,"providers":["anthropic","openai"]}`.
6. **Control-plane unauth.** `curl localhost:4000/v1/runs` → `401`.
7. **Control-plane authed.** `curl -H "authorization: Bearer $RELAY_API_KEY" localhost:4000/v1/credentials | jq` → list with no `apiKey` fields.
8. **Run with Claude.** `pnpm example` → streams tokens, `→ calculator(…)`,
   then final answer.
9. **Run with OpenAI.** `RELAY_MODEL=gpt-4o-mini pnpm example`.
10. **Cross-tenant isolation.** Mint a second tenant, try to GET another
    tenant's `/v1/runs/:id` with its key → `404`.
11. **Missing creds.** Delete the OpenAI credential, then
    `RELAY_MODEL=gpt-4o-mini pnpm example` → 400 with
    `no openai credentials for this tenant` (run never reaches the runtime).
12. **Dashboard.** Open `http://localhost:3000` — runs from the auth'd tenant
    appear. Click in for the full trace.
13. **OpenAI-compatible.** Upload an Ollama credential with `baseUrl`:
    ```
    curl -X PUT localhost:4000/v1/credentials/openai \
      -H "authorization: Bearer $RELAY_API_KEY" \
      -H "content-type: application/json" \
      -d '{"apiKey":"ollama","baseUrl":"http://localhost:11434/v1"}'
    RELAY_MODEL=openai:llama3.1 pnpm example
    ```

## Memory

Drop a `memory` option on the agent and it will recall relevant past
interactions automatically — no embedding work in your code.

```ts
const agent = createAgent({
  model: "gpt-4o-mini",
  memory: { namespace: `user:${userId}` },   // or `memory: true` for "default"
  system: "You are a helpful assistant.",
});

await agent.run("I'm Kevin. I drink only espresso. Remember this.");
// later, even in another process:
for await (const e of agent.run("What coffee do I drink?")) { ... }
//  → "You drink only espresso, Kevin."
```

Under the hood, on every run with `memory` set:

1. The control plane embeds the user input with OpenAI `text-embedding-3-small`.
2. Top-5 similar memories from that `(tenant, namespace)` get bullet-listed
   into the system prompt as "Relevant context from past interactions".
3. The agent runs as usual.
4. After `done`, the input/output pair is embedded and stored as a new memory
   (linked to its source `run_id`, for trace lookup).

Memory **requires an OpenAI credential** (used for embeddings) even when the
chat model is Claude — Anthropic doesn't expose an embeddings endpoint.

Demo:

```bash
RELAY_MODEL=gpt-4o-mini pnpm example:memory
# RUN 1 teaches the agent. RUN 2 (same script) recalls.
# Run the script a second time — RUN 2's recall now has *more* context.
```

Inspect what's stored:

```bash
curl -s -H "authorization: Bearer $RELAY_API_KEY" \
  "localhost:4000/v1/memories?namespace=demo-user-kevin" | jq

curl -X DELETE -H "authorization: Bearer $RELAY_API_KEY" \
  "localhost:4000/v1/memories?namespace=demo-user-kevin"   # clear namespace
```

## SDK contract

Builtins + custom function tools sit alongside each other. The developer's
`handler` function runs in their own process; Relay just orchestrates.

```ts
import { createAgent, builtin, tool } from "@relay/sdk";

const getUser = tool({
  name: "get_user",
  description: "Look up a user by id",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
  },
  async handler({ id }: { id: string }) {
    return await db.users.findById(id);   // runs locally in your code
  },
});

const agent = createAgent({
  apiKey: process.env.RELAY_API_KEY,
  model: "claude-sonnet-4-6",
  tools: [builtin.calculator, getUser],
});

for await (const event of agent.run("Look up u_001 and tell me their tier")) {
  // event.type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error'
}
```

## How custom tool calls actually round-trip

```
SDK                       control-plane                runtime                LLM
 │── POST /v1/runs ─────────►│                            │                    │
 │                            │── POST /runs ─────────────►│                    │
 │                            │                            │── stream ─────────►│
 │                            │                            │◄── tool_use ──────│
 │                            │◄── SSE: tool_call ────────│                    │
 │◄── tool_call event ───────│   (persisted)             │── GET /internal/   │
 │                            │                            │     tool-result   │
 │   (SDK runs handler        │                            │   (long-poll)     │
 │    locally, no Relay)      │                            │                    │
 │── POST tool-results ──────►│                            │                    │
 │                            │── resolves long-poll ─────►│                    │
 │                            │                            │── stream ─────────►│
 │                            │◄── SSE: tool_result ──────│                    │
 │                            │   (persisted)             │                    │
 │◄── tool_result event ─────│                            │                    │
 │                            │                            │◄── done ──────────│
 │◄── done ──────────────────│                            │                    │
```

The runtime stays stateless. The SDK never talks to the runtime. Every event
is captured in `run_events` on the way through.

## HTTP API (control plane)

| method | path                                              | purpose                                |
|--------|---------------------------------------------------|----------------------------------------|
| GET    | `/health`                                         | public                                 |
| POST   | `/v1/runs`                                        | start a run; SSE stream of events      |
| GET    | `/v1/runs`                                        | list this tenant's runs                |
| GET    | `/v1/runs/:id`                                    | run metadata                           |
| GET    | `/v1/runs/:id/events`                             | run + full event log                   |
| POST   | `/v1/runs/:id/tool-results/:toolUseId`            | SDK posts custom tool output           |
| PUT    | `/v1/credentials/:provider`                       | upload or rotate                       |
| GET    | `/v1/credentials`                                 | list (no secrets returned)             |
| DELETE | `/v1/credentials/:provider`                       | revoke                                 |
| GET    | `/v1/memories?namespace=&limit=`                  | list memories                          |
| DELETE | `/v1/memories/:id`                                | delete one                             |
| DELETE | `/v1/memories?namespace=`                         | clear a namespace                      |
| GET    | `/internal/runs/:id/tool-result/:toolUseId`       | runtime long-poll (internal-auth)      |

All `/v1/*` routes require `Authorization: Bearer relay_live_…`. The single
`/internal/*` route requires `Authorization: Internal $RELAY_INTERNAL_SECRET`
when the secret is set (recommended in production).

## Security notes (v0.4)

- API keys: 256-bit random, base64url, prefixed `relay_live_`. SHA-256 of the
  full key is the lookup index. Constant-time compare via index uniqueness.
- Provider credentials: AES-256-GCM with a random 96-bit IV per record and a
  128-bit auth tag. Master key from `RELAY_MASTER_KEY` (hex or base64).
- Tenant isolation: every read query filters by `tenant_id`. The control plane
  never accepts a tenant id from the client.
- The Go runtime never sees a `relay_live_…` key and has no DB access.

## What's NOT in this iteration

- key rotation UI (CRUD via curl works)
- multiple keys per tenant in UI (DB supports it)
- audit log of key usage / credential reads
- dashboard credentials / API keys settings pages
- dashboard user-level auth (today uses a tenant's API key directly)
- multi-org / per-project credentials (today: one credential per provider per tenant)
- KMS-backed master key
- live tail in dashboard
- tool call cancellation (long-poll times out after 30s; runtime then fails the run)
- non-TS SDKs (the protocol is plain HTTP+SSE — port to any language)
- memory subsystem, durable execution, voice, deploy
