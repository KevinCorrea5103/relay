import { Code } from "@/components/Code";
import {
  Callout,
  DocsPage,
  H2,
  H3,
  InlineCode,
  P,
  Table,
  Td,
  Th,
} from "@/components/DocsPage";

export default async function ApiDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="api"
      lang={lang}
      title="HTTP API"
      description="Every control-plane endpoint, with the auth model and curl examples. The SDK is a thin wrapper around this — you can call it directly from any language."
    >
      <section>
        <H2 id="auth">Authentication</H2>
        <P>
          All <InlineCode>/v1/*</InlineCode> routes require a{" "}
          <InlineCode>Bearer</InlineCode> token — your tenant&apos;s{" "}
          <InlineCode>relay_live_…</InlineCode> key from{" "}
          <InlineCode>pnpm bootstrap</InlineCode>.
        </P>
        <Code lang="bash" code={`-H "authorization: Bearer relay_live_…"`} />
        <P>
          The single <InlineCode>/internal/*</InlineCode> route requires{" "}
          <InlineCode>Internal $RELAY_INTERNAL_SECRET</InlineCode> when the
          secret is configured — it&apos;s how the runtime calls back to the
          control plane for custom tool results. Don&apos;t expose this from
          your client.
        </P>
      </section>

      <section>
        <H2 id="endpoints">Endpoints at a glance</H2>
        <Table>
          <thead>
            <tr>
              <Th>Method</Th>
              <Th>Path</Th>
              <Th>Purpose</Th>
            </tr>
          </thead>
          <tbody>
            <tr><Td mono>GET</Td><Td mono>/health</Td><Td>public liveness</Td></tr>
            <tr><Td mono>POST</Td><Td mono>/v1/signup</Td><Td>create a tenant + mint the first API key (no auth)</Td></tr>
            <tr><Td mono>POST</Td><Td mono>/v1/runs</Td><Td>start a run; returns an SSE event stream</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/runs</Td><Td>list runs (filters: <InlineCode>status</InlineCode>, <InlineCode>roots</InlineCode>, <InlineCode>workflow</InlineCode>)</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/runs/:id</Td><Td>run metadata</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/runs/:id/events</Td><Td>full event log (ordered)</Td></tr>
            <tr><Td mono>POST</Td><Td mono>/v1/runs/:id/tool-results/:toolUseId</Td><Td>SDK posts a custom tool output</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/workflows/:id</Td><Td>full run tree + aggregated cost for a workflow</Td></tr>
            <tr><Td mono>POST</Td><Td mono>/v1/keys</Td><Td>mint a new API key (for rotation)</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/keys</Td><Td>list this tenant&apos;s keys (no secrets)</Td></tr>
            <tr><Td mono>DELETE</Td><Td mono>/v1/keys/:id</Td><Td>revoke a key</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/audit</Td><Td>security-relevant audit log for this tenant</Td></tr>
            <tr><Td mono>PUT</Td><Td mono>/v1/credentials/:provider</Td><Td>upload or rotate provider key</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/credentials</Td><Td>list (no secrets returned)</Td></tr>
            <tr><Td mono>DELETE</Td><Td mono>/v1/credentials/:provider</Td><Td>revoke</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/memories?namespace=&amp;limit=</Td><Td>list memories</Td></tr>
            <tr><Td mono>DELETE</Td><Td mono>/v1/memories/:id</Td><Td>delete one</Td></tr>
            <tr><Td mono>DELETE</Td><Td mono>/v1/memories?namespace=</Td><Td>clear a namespace</Td></tr>
            <tr><Td mono>POST</Td><Td mono>/v1/transcribe</Td><Td>audio → text (Whisper, multipart upload)</Td></tr>
            <tr><Td mono>POST</Td><Td mono>/v1/synthesize</Td><Td>text → audio stream (OpenAI TTS)</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/internal/runs/:id/tool-result/:toolUseId</Td><Td>runtime long-poll (internal-auth)</Td></tr>
          </tbody>
        </Table>
        <Callout kind="note">
          All <InlineCode>/v1/*</InlineCode> responses include rate-limit
          headers (<InlineCode>RateLimit-Limit</InlineCode>,{" "}
          <InlineCode>RateLimit-Remaining</InlineCode>,{" "}
          <InlineCode>RateLimit-Reset</InlineCode>) and a HTTP{" "}
          <InlineCode>429</InlineCode> with{" "}
          <InlineCode>Retry-After</InlineCode> when exceeded. Defaults:
          60 req/min default · 30 runs/min on POST /v1/runs.
        </Callout>
      </section>

      <section>
        <H2 id="signup">POST /v1/signup</H2>
        <P>
          Create a tenant and mint its first API key. The only unauthenticated
          mutation in the API — protect with a captcha at the edge in
          production if you allow self-service signup.
        </P>
        <Code
          lang="bash"
          code={`curl -X POST $RELAY_URL/v1/signup \\
  -H "content-type: application/json" \\
  -d '{
    "email": "you@example.com",
    "openaiApiKey": "sk-...",
    "anthropicApiKey": "sk-ant-..."
  }'

# Response:
# {
#   "apiKey": "relay_live_<long-secret>",   // shown once, NEVER returned again
#   "tenant": { "id": "uuid", "name": "you@example.com" },
#   "providers": ["openai", "anthropic"],
#   "email": { "sent": true, "reason": null }
# }`}
        />
        <Callout kind="warn">
          The <InlineCode>apiKey</InlineCode> is returned exactly once. Lose
          it → you can&apos;t recover (the DB only stores its SHA-256). Mint
          a new one via <InlineCode>POST /v1/keys</InlineCode> if you still
          have any active key.
        </Callout>
      </section>

      <section>
        <H2 id="post-runs">POST /v1/runs</H2>
        <P>Start an agent run. Returns an SSE stream of events.</P>
        <Code
          lang="bash"
          code={`curl -N -X POST $RELAY_URL/v1/runs \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{\n    "model": "gpt-4o-mini",\n    "system": "You are a helpful assistant.",\n    "input": "What is 23 * 47?",\n    "tools": [{ "name": "calculator", "kind": "builtin" }],\n    "memory": { "namespace": "demo-user" }\n  }'`}
        />
        <H3 id="post-runs-response">Response: text/event-stream</H3>
        <P>Every event is one SSE frame. Frames look like:</P>
        <Code
          lang="text"
          code={`data: {"type":"token","text":"23"}\n\ndata: {"type":"token","text":" *"}\n\ndata: {"type":"tool_call","id":"call_…","name":"calculator","input":{"a":23,"b":47,"op":"*"}}\n\ndata: {"type":"tool_result","id":"call_…","output":1081}\n\ndata: {"type":"done","output":"…","usage":{"input_tokens":234,"output_tokens":12}}`}
        />
        <P>
          The response header <InlineCode>x-run-id</InlineCode> carries the
          run id — you need it to post tool results.
        </P>
        <H3 id="post-runs-errors">Errors</H3>
        <Table>
          <thead>
            <tr><Th>Status</Th><Th>Cause</Th></tr>
          </thead>
          <tbody>
            <tr><Td mono>400</Td><Td>missing model/input; unknown model family; no credential for that provider</Td></tr>
            <tr><Td mono>401</Td><Td>missing or invalid bearer token</Td></tr>
            <tr><Td mono>502</Td><Td>runtime rejected the run (network, provider error, etc.)</Td></tr>
          </tbody>
        </Table>
      </section>

      <section>
        <H2 id="post-tool-results">POST /v1/runs/:id/tool-results/:toolUseId</H2>
        <P>
          Used by the SDK when a custom tool fires. You can hit it directly if
          you&apos;re implementing your own SDK.
        </P>
        <Code
          lang="bash"
          code={`curl -X POST $RELAY_URL/v1/runs/$RUN_ID/tool-results/$TOOL_USE_ID \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{ "output": { "ok": true, "user": { "id": "u_001" } } }'`}
        />
        <Callout kind="warn">
          The runtime is long-polling for this result. If nothing arrives
          within <InlineCode>RELAY_TOOL_RESULT_TIMEOUT_MS</InlineCode> (default
          30s) the run fails with{" "}
          <InlineCode>tool result timed out</InlineCode>.
        </Callout>
      </section>

      <section>
        <H2 id="credentials">Credentials</H2>
        <Code
          lang="bash"
          code={`# upload / rotate\ncurl -X PUT $RELAY_URL/v1/credentials/openai \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{"apiKey":"sk-...","label":"prod","baseUrl":"..."}'   # baseUrl optional\n\n# list (apiKey field is never returned)\ncurl -H "authorization: Bearer $RELAY_API_KEY" $RELAY_URL/v1/credentials\n\n# revoke\ncurl -X DELETE -H "authorization: Bearer $RELAY_API_KEY" \\\n  $RELAY_URL/v1/credentials/openai`}
        />
      </section>

      <section>
        <H2 id="memories">Memories</H2>
        <Code
          lang="bash"
          code={`curl -H "authorization: Bearer $RELAY_API_KEY" \\\n  "$RELAY_URL/v1/memories?namespace=user:42&limit=50"\n\ncurl -X DELETE -H "authorization: Bearer $RELAY_API_KEY" \\\n  "$RELAY_URL/v1/memories/<memory-id>"\n\ncurl -X DELETE -H "authorization: Bearer $RELAY_API_KEY" \\\n  "$RELAY_URL/v1/memories?namespace=user:42"`}
        />
      </section>

      <section>
        <H2 id="runs-read">List &amp; inspect runs</H2>
        <Code
          lang="bash"
          code={`# list runs (paginated by ?limit, filtered by ?status)
curl -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/runs?status=completed&limit=20"

# only top-level (root) runs — one row per workflow
curl -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/runs?roots=true"

# all runs in a specific workflow (filter on workflow_id)
curl -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/runs?workflow=<workflow-id>"

# run metadata
curl -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/runs/<run-id>"

# full event log
curl -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/runs/<run-id>/events"`}
        />
      </section>

      <section>
        <H2 id="workflows">GET /v1/workflows/:id</H2>
        <P>
          Returns the entire tree of runs that share a{" "}
          <InlineCode>workflow_id</InlineCode> (sub-agents, Graph steps),
          ordered depth-first for indented rendering, plus aggregated cost
          across the whole tree.
        </P>
        <Code
          lang="bash"
          code={`curl -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/workflows/<workflow-id>"

# Response:
# {
#   "workflowId": "uuid",
#   "runs": [
#     { "id": "...", "depth": 0, "parentRunId": null, "model": "...", ... },
#     { "id": "...", "depth": 1, "parentRunId": "...", "model": "...", ... },
#     { "id": "...", "depth": 2, "parentRunId": "...", "model": "...", ... }
#   ],
#   "cost": {
#     "workflowId": "uuid",
#     "runCount": 3,
#     "inputTokens": 1240,
#     "outputTokens": 488
#   }
# }`}
        />
        <P>
          See <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/workflows`}>Workflows</a>{" "}
          for how trees are formed (subagent + Graph).
        </P>
      </section>

      <section>
        <H2 id="keys">API keys</H2>
        <P>
          Zero-downtime rotation: mint a new one, verify, revoke the old.
        </P>
        <Code
          lang="bash"
          code={`# mint a new key (current key authorizes; new key returned ONCE)
curl -X POST $RELAY_URL/v1/keys \\
  -H "authorization: Bearer $OLD_KEY" \\
  -H "content-type: application/json" \\
  -d '{"name":"rotated 2026-05"}'
# → { "apiKey": "relay_live_...NEW", "descriptor": { "id": "...", "prefix": "..." } }

# list (no secrets — only id, prefix, name, timestamps, revokedAt)
curl -H "authorization: Bearer $RELAY_API_KEY" $RELAY_URL/v1/keys

# revoke a specific key
curl -X DELETE -H "authorization: Bearer $RELAY_API_KEY" \\
  $RELAY_URL/v1/keys/<key-id>

# Self-revocation is refused unless you pass ?force=true (prevents
# accidentally locking yourself out — the secret can't be recovered).
curl -X DELETE -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/keys/<calling-key-id>?force=true"`}
        />
      </section>

      <section>
        <H2 id="audit">GET /v1/audit</H2>
        <P>
          Security-relevant actions are logged per tenant. The log is
          RLS-protected — a tenant can only see their own rows.
        </P>
        <Code
          lang="bash"
          code={`# recent events
curl -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/audit?limit=100"

# filter by action
curl -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/audit?action=api_key.created"

# paginate backward by createdAt
curl -H "authorization: Bearer $RELAY_API_KEY" \\
  "$RELAY_URL/v1/audit?before=2026-05-26T00:00:00Z&limit=200"

# Event shape:
# {
#   "id": "uuid",
#   "tenantId": "uuid",
#   "actor": "api_key:<keyId>" | "signup" | "admin" | "system",
#   "action": "api_key.created" | "credential.updated" | "master_key.rotated" | ...,
#   "targetType": "api_key" | "provider_credentials" | ...,
#   "targetId": "...",
#   "metadata": { ... },
#   "ipAddress": "x.x.x.x" | null,
#   "userAgent": "..." | null,
#   "createdAt": "ISO-8601"
# }`}
        />
        <P>
          See <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/security#audit-log`}>Security → Audit log</a>{" "}
          for the full list of recorded actions.
        </P>
      </section>

      <section>
        <H2 id="voice">Voice — transcribe + synthesize</H2>
        <P>
          Both endpoints use the tenant&apos;s existing OpenAI BYOK
          credential. Audio bytes pass through to OpenAI and back —
          never persisted on the Relay side.
        </P>
        <Code
          lang="bash"
          code={`# Speech → text (Whisper)
curl -X POST $RELAY_URL/v1/transcribe \\
  -H "authorization: Bearer $RELAY_API_KEY" \\
  -F file=@clip.mp3 \\
  -F language=es
# → {"text": "Hola, esto es una prueba."}

# Text → speech (OpenAI TTS, streams audio bytes)
curl -X POST $RELAY_URL/v1/synthesize \\
  -H "authorization: Bearer $RELAY_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "input": "Hola desde Relay",
    "model": "tts-1",
    "voice": "nova",
    "format": "mp3"
  }' \\
  --output hello.mp3`}
        />
        <P>
          Full reference (voices, models, formats, limits) on the{" "}
          <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/voice`}>Voice</a>{" "}
          page.
        </P>
      </section>

      <section>
        <H2 id="parent-runs">Parent / workflow params on POST /v1/runs</H2>
        <P>
          To link a run as a child of another (for sub-agent / graph
          composition without using the SDK helpers), pass{" "}
          <InlineCode>parentRunId</InlineCode> or{" "}
          <InlineCode>workflowId</InlineCode> on the body. The server
          validates the parent belongs to the same tenant.
        </P>
        <Code
          lang="bash"
          code={`curl -N -X POST $RELAY_URL/v1/runs \\
  -H "authorization: Bearer $RELAY_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "input": "do the thing",
    "parentRunId": "<parent-uuid>",        # one-hop parent
    "workflowId":  "<workflow-root-uuid>"  # shared across the tree
  }'

# Response headers:
#   x-run-id:      this run's id
#   x-workflow-id: the workflow this run belongs to
#   access-control-expose-headers: x-run-id, x-workflow-id`}
        />
      </section>
    </DocsPage>
  );
}
