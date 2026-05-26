import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P } from "@/components/DocsPage";
import { Mermaid } from "@/components/Mermaid";

const CALLBACK_DIAGRAM = `sequenceDiagram
    autonumber
    participant SDK
    participant CP as Control plane
    participant RT as Runtime
    participant LLM

    SDK->>CP: POST /v1/runs
    CP->>RT: POST /runs (with credentials)
    RT->>LLM: stream messages
    LLM-->>RT: tool_use
    RT-->>CP: SSE: tool_call event
    Note over CP: persist event
    CP-->>SDK: tool_call event
    RT->>CP: GET /internal/tool-result (long-poll)
    Note over SDK: validate input, run handler in your process
    SDK->>CP: POST /v1/runs/:id/tool-results/:toolUseId
    CP-->>RT: resolves long-poll with output
    RT->>LLM: continue with tool result
    RT-->>CP: SSE: tool_result event
    CP-->>SDK: tool_result event
    LLM-->>RT: done
    RT-->>CP: SSE: done event
    CP-->>SDK: done event`;

export default async function ToolsDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="tools"
      lang={lang}
      title="Tools"
      description="Built-in tools, custom function tools, the long-poll callback protocol, schema validation, and recipes for the patterns you'll actually build."
    >
      <section>
        <H2 id="overview">Two kinds of tools</H2>
        <P>
          Built-in tools execute server-side in the Go runtime. Custom function
          tools execute in <em>your</em> process — the runtime calls back to
          your SDK over an open stream. Same wire format, different execution
          location.
        </P>
        <Code
          lang="typescript"
          code={`import { createAgent, builtin, tool } from "@relayhq/sdk";

const agent = createAgent({
  model: "claude-sonnet-4-6",
  tools: [
    builtin.calculator,         // runs server-side, in the runtime
    myCustomTool,               // runs in your process via callback
  ],
});`}
        />
      </section>

      <section>
        <H2 id="built-ins">Built-in tools</H2>
        <P>
          Built-ins are useful when the operation is fast, common, and
          shouldn&apos;t cost a round-trip. The registry is intentionally
          small — most useful tools depend on YOUR business logic, so they
          belong in your SDK code.
        </P>
        <H3 id="builtin-calculator">builtin.calculator</H3>
        <P>
          Performs a single arithmetic operation on two numbers. Useful as a
          control for testing tool calls without writing your own.
        </P>
        <Code
          lang="json"
          code={`{
  "type": "object",
  "properties": {
    "a": { "type": "number" },
    "b": { "type": "number" },
    "op": { "type": "string", "enum": ["+", "-", "*", "/"] }
  },
  "required": ["a", "b", "op"]
}`}
        />
        <Callout kind="tip">
          To add your own built-ins (server-side execution, zero SDK
          round-trip), implement{" "}
          <InlineCode>runtime/internal/tools/tools.go</InlineCode> and register
          a handler in <InlineCode>DefaultRegistry()</InlineCode>. Useful only
          if you have a high-volume, stateless, latency-sensitive operation —
          otherwise prefer custom function tools.
        </Callout>
      </section>

      <section>
        <H2 id="custom">Custom function tools</H2>
        <P>
          A function tool = <strong>schema + handler</strong>. The schema goes
          to the LLM. The handler runs in your process. The output is shipped
          back as the tool result.
        </P>

        <H3 id="custom-ts">TypeScript</H3>
        <Code
          lang="typescript"
          fileName="get-user.ts"
          code={`import { tool } from "@relayhq/sdk";

export const getUser = tool({
  name: "get_user",
  description: "Look up a user by id. Returns name, tier, balance.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "user id like u_001" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  async handler({ id }: { id: string }) {
    const user = await db.users.findById(id);
    if (!user) return { error: \`no user with id \${id}\` };
    return user;
  },
});`}
        />

        <H3 id="custom-py">Python</H3>
        <P>Identical surface — same args, same wire format.</P>
        <Code
          lang="python"
          fileName="get_user.py"
          code={`from relayhq import tool

async def _get_user_handler(input):
    user = await db.users.find_by_id(input["id"])
    if not user:
        return {"error": f"no user with id {input['id']}"}
    return user

get_user = tool(
    name="get_user",
    description="Look up a user by id. Returns name, tier, balance.",
    input_schema={
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "user id like u_001"},
        },
        "required": ["id"],
        "additionalProperties": False,
    },
    handler=_get_user_handler,
)`}
        />

        <H3 id="naming">Naming &amp; descriptions</H3>
        <P>
          Tool names should be <InlineCode>snake_case</InlineCode>, 1–64
          characters. Descriptions are part of the prompt — write them like
          you&apos;re briefing a colleague. Be specific about inputs, outputs,
          and side effects (e.g. &quot;sends an email&quot;, &quot;writes to
          the database&quot;).
        </P>

        <H3 id="returns">Return values &amp; errors</H3>
        <P>
          Whatever your handler returns gets JSON-serialized as the tool
          result. Throwing turns into{" "}
          <InlineCode>{`"error: <message>"`}</InlineCode>; the model sees it
          and almost always self-corrects on the next iteration.
        </P>
        <Callout kind="tip">
          For predictable behavior, return{" "}
          <InlineCode>{`{ ok: true, ...data }`}</InlineCode> on success and{" "}
          <InlineCode>{`{ error: "..." }`}</InlineCode> on graceful failures,
          instead of throwing. Throwing is for truly unexpected conditions.
        </Callout>
      </section>

      <section>
        <H2 id="schema-validation">Input schema validation</H2>
        <P>
          The SDK validates the LLM&apos;s arguments against your{" "}
          <InlineCode>inputSchema</InlineCode> <em>before</em> invoking your
          handler. If validation fails, the handler isn&apos;t called — the
          model gets back{" "}
          <InlineCode>{`{ "error": "invalid tool input: ..." }`}</InlineCode>{" "}
          and usually self-corrects on the next iteration.
        </P>
        <P>
          This catches the most common LLM mistakes: missing required fields,
          wrong types, extra fields when{" "}
          <InlineCode>additionalProperties: false</InlineCode>, enum
          violations. No need to bring in <InlineCode>zod</InlineCode> or{" "}
          <InlineCode>pydantic</InlineCode> just for tool args.
        </P>
        <Code
          lang="typescript"
          code={`// validation runs automatically when the tool is invoked.
// If you also want to validate elsewhere (e.g. a manual replay), the
// validator is exported:
import { validateAgainstSchema } from "@relayhq/sdk";

const err = validateAgainstSchema({ id: 123 }, getUser.inputSchema);
//                                   ^^^^^^^^
// err === 'field "id": expected string, got number'`}
        />
        <Code
          lang="python"
          code={`from relayhq import validate_against_schema

err = validate_against_schema({"id": 123}, get_user["inputSchema"])
# err == 'field "id": expected string, got number'`}
        />
        <Callout kind="note">
          The validator implements the JSON Schema subset that LLMs
          actually get wrong: <InlineCode>type</InlineCode>,{" "}
          <InlineCode>required</InlineCode>,{" "}
          <InlineCode>additionalProperties</InlineCode>,{" "}
          <InlineCode>enum</InlineCode>, nested object/array. For full
          JSON Schema 2020-12, pair with Ajv / jsonschema in your own
          code path.
        </Callout>
      </section>

      <section>
        <H2 id="tool-context">Tool context (run + workflow IDs)</H2>
        <P>
          Handlers can accept an optional second argument with the IDs of the
          run that decided to call the tool. This is what{" "}
          <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/workflows`}>
            <InlineCode>subagent()</InlineCode>
          </a>{" "}
          uses internally — sub-runs inherit the parent&apos;s workflow ID so
          the dashboard can render the tree.
        </P>
        <Code
          lang="typescript"
          code={`import { tool, type ToolContext } from "@relayhq/sdk";

export const logEvent = tool({
  name: "log_event",
  description: "Persist an analytics event tied to the calling run.",
  inputSchema: {
    type: "object",
    properties: { kind: { type: "string" } },
    required: ["kind"],
  },
  async handler(input: { kind: string }, ctx?: ToolContext) {
    await analytics.track({
      runId: ctx?.runId,            // ← the run that called this tool
      workflowId: ctx?.workflowId,  // ← the root workflow it belongs to
      event: input.kind,
    });
    return { ok: true };
  },
});`}
        />
        <Code
          lang="python"
          code={`async def _log_event(input, ctx=None):
    await analytics.track(
        run_id=(ctx or {}).get("run_id"),
        workflow_id=(ctx or {}).get("workflow_id"),
        event=input["kind"],
    )
    return {"ok": True}

log_event = tool(
    name="log_event",
    description="Persist an analytics event tied to the calling run.",
    input_schema={
        "type": "object",
        "properties": {"kind": {"type": "string"}},
        "required": ["kind"],
    },
    handler=_log_event,
)`}
        />
        <Callout kind="tip">
          Handlers without a <InlineCode>ctx</InlineCode> argument keep
          working — the SDK only passes it when the signature accepts it.
          No breaking change for existing tools.
        </Callout>
      </section>

      <section>
        <H2 id="recipes">Recipes</H2>
        <P>
          Patterns from real codebases. Each one is a complete, copy-pasteable
          example.
        </P>

        <H3 id="recipe-db">Database lookup (Postgres)</H3>
        <Code
          lang="typescript"
          fileName="tools/lookup-order.ts"
          code={`import { tool } from "@relayhq/sdk";
import { pool } from "../db.js";

export const lookupOrder = tool({
  name: "lookup_order",
  description: "Fetch an order by id. Returns user, items, total, status.",
  inputSchema: {
    type: "object",
    properties: {
      order_id: { type: "string", description: "order id, e.g. o_1001" },
    },
    required: ["order_id"],
    additionalProperties: false,
  },
  async handler({ order_id }: { order_id: string }) {
    const { rows } = await pool.query(
      "SELECT user_id, items, total_usd, status FROM orders WHERE id = $1",
      [order_id],
    );
    return rows[0] ?? { error: \`no order \${order_id}\` };
  },
});`}
        />

        <H3 id="recipe-http">External HTTP API</H3>
        <Code
          lang="python"
          fileName="tools/weather.py"
          code={`import os
import httpx
from relayhq import tool

async def _weather(input):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"q": input["city"], "appid": os.environ["OWM_KEY"]},
        )
        if r.status_code != 200:
            return {"error": f"weather api {r.status_code}"}
        data = r.json()
        return {
            "city": data["name"],
            "temp_c": data["main"]["temp"] - 273.15,
            "conditions": data["weather"][0]["description"],
        }

weather = tool(
    name="weather",
    description="Current weather in a city. Returns temp in Celsius + conditions.",
    input_schema={
        "type": "object",
        "properties": {"city": {"type": "string"}},
        "required": ["city"],
        "additionalProperties": False,
    },
    handler=_weather,
)`}
        />

        <H3 id="recipe-stripe">Side-effecting action with confirmation</H3>
        <P>
          For tools that <em>mutate</em> external state (refund, send email,
          spend money), encode the confirmation requirement in the schema and
          log the action with full context.
        </P>
        <Code
          lang="typescript"
          fileName="tools/issue-refund.ts"
          code={`import Stripe from "stripe";
import { tool, type ToolContext } from "@relayhq/sdk";

const stripe = new Stripe(process.env.STRIPE_KEY!);

export const issueRefund = tool({
  name: "issue_refund",
  description:
    "Refund a Stripe charge. ALWAYS confirm the amount and reason " +
    "with the user before calling.",
  inputSchema: {
    type: "object",
    properties: {
      charge_id: { type: "string", description: "Stripe charge id (ch_...)" },
      amount_cents: { type: "integer", description: "amount to refund in cents" },
      reason: {
        type: "string",
        enum: ["duplicate", "fraudulent", "requested_by_customer"],
      },
    },
    required: ["charge_id", "amount_cents", "reason"],
    additionalProperties: false,
  },
  async handler(input, ctx?: ToolContext) {
    const refund = await stripe.refunds.create({
      charge: input.charge_id,
      amount: input.amount_cents,
      reason: input.reason,
      metadata: {
        relay_run: ctx?.runId ?? "unknown",
        relay_workflow: ctx?.workflowId ?? "unknown",
      },
    });
    return { ok: true, refund_id: refund.id, status: refund.status };
  },
});`}
        />

        <H3 id="recipe-file">File read / processing</H3>
        <Code
          lang="python"
          fileName="tools/read_pdf.py"
          code={`from pathlib import Path
from pypdf import PdfReader
from relayhq import tool

def _read_pdf(input):
    path = Path(input["path"])
    if not path.is_file():
        return {"error": f"no file at {path}"}
    if path.stat().st_size > 10 * 1024 * 1024:
        return {"error": "file >10MB, refusing"}
    text = "\\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
    return {"path": str(path), "chars": len(text), "text": text[:5000]}

read_pdf = tool(
    name="read_pdf",
    description="Extract plain text from a local PDF file. Returns up to 5000 chars.",
    input_schema={
        "type": "object",
        "properties": {"path": {"type": "string"}},
        "required": ["path"],
        "additionalProperties": False,
    },
    handler=_read_pdf,
)`}
        />

        <H3 id="recipe-search">Vector / semantic search over your data</H3>
        <P>
          Combine your own embeddings index with a tool the agent can query.
          (Relay also has a built-in <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/memory`}>memory</a>{" "}
          subsystem if you don&apos;t want to manage your own.)
        </P>
        <Code
          lang="typescript"
          code={`import { tool } from "@relayhq/sdk";
import { pgvector } from "../db.js";

export const searchDocs = tool({
  name: "search_docs",
  description: "Semantic search over the internal knowledge base.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "integer", description: "1-20, default 5" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async handler({ query, limit = 5 }) {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const { rows } = await pgvector.query(
      \`SELECT title, url, snippet
         FROM docs
        ORDER BY embedding <=> $1::vector
        LIMIT $2\`,
      [embedding.data[0].embedding, Math.min(20, limit)],
    );
    return { results: rows };
  },
});`}
        />
      </section>

      <section>
        <H2 id="testing">Testing tools locally</H2>
        <P>
          Tools are plain functions. Test them like any other code, no Relay
          server needed:
        </P>
        <Code
          lang="typescript"
          fileName="tools/get-user.test.ts"
          code={`import { getUser } from "./get-user.js";

test("returns the user when found", async () => {
  const result = await getUser.handler({ id: "u_001" });
  expect(result).toMatchObject({ id: "u_001", name: expect.any(String) });
});

test("returns an error for unknown ids", async () => {
  const result = await getUser.handler({ id: "u_does_not_exist" });
  expect(result).toEqual({ error: expect.stringContaining("no user") });
});

test("validates against the schema", async () => {
  const { validateAgainstSchema } = await import("@relayhq/sdk");
  // Missing required field
  expect(validateAgainstSchema({}, getUser.inputSchema)).toMatch(/missing required/);
  // Wrong type
  expect(validateAgainstSchema({ id: 1 }, getUser.inputSchema)).toMatch(/expected string/);
});`}
        />
      </section>

      <section>
        <H2 id="protocol">How the callback works</H2>
        <P>
          Custom tools work through a long-poll callback — the runtime
          orchestrates, but execution stays in your process. End-to-end:
        </P>
        <Mermaid chart={CALLBACK_DIAGRAM} caption="callback flow" />
        <P>
          The runtime stays stateless. The SDK never talks to the runtime
          directly. Every event is persisted in{" "}
          <InlineCode>run_events</InlineCode> on the way through. The broker
          in the control plane is backed by NATS JetStream KV when{" "}
          <InlineCode>NATS_URL</InlineCode> is set, so the dance works across
          multiple control-plane replicas.
        </P>
      </section>

      <section>
        <H2 id="limits">Limits &amp; timeouts</H2>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Tool result timeout:</strong> 30 seconds by default.
            Configure with{" "}
            <InlineCode>RELAY_TOOL_RESULT_TIMEOUT_MS</InlineCode> on the
            control plane.
          </li>
          <li>
            <strong>Max iterations per run:</strong> 8. The agent loop bails
            after 8 tool round-trips to prevent infinite cycles.
          </li>
          <li>
            <strong>Parallel tool calls:</strong> supported. The SDK
            dispatches all custom tool handlers concurrently when the model
            fires more than one in a turn. Make handlers idempotent if the
            same one might fire twice.
          </li>
          <li>
            <strong>Tool input size:</strong> bounded by provider — Anthropic
            and OpenAI both cap at ~100K characters per call.
          </li>
          <li>
            <strong>Subagent depth:</strong> capped at 5 by default to
            prevent runaway recursion. Configurable per{" "}
            <InlineCode>subagent()</InlineCode> call.
          </li>
        </ul>
      </section>

      <section>
        <H2 id="pitfalls">Common pitfalls</H2>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Returning massive payloads.</strong> The whole tool
            result is fed back into the next LLM call as a message. A 50KB
            JSON blob will eat your context window. Trim or summarize before
            returning.
          </li>
          <li>
            <strong>Side effects without idempotency.</strong> The runtime
            retries on transient failures and the LLM might re-call the same
            tool twice. Tools that send emails / charge cards / create
            records should accept an{" "}
            <InlineCode>idempotency_key</InlineCode> in the schema or dedupe
            internally.
          </li>
          <li>
            <strong>Long-running handlers.</strong> 30s default timeout —
            anything longer (file uploads, batch jobs) should kick off async
            work and return a job id immediately, then expose a{" "}
            <InlineCode>check_job_status</InlineCode> tool the agent can
            poll.
          </li>
          <li>
            <strong>Loose schemas that confuse the LLM.</strong>{" "}
            <InlineCode>additionalProperties: false</InlineCode> and{" "}
            <InlineCode>enum</InlineCode> constraints help the model
            self-correct faster. Hand-waving schemas get hand-waving args.
          </li>
          <li>
            <strong>Forgetting to handle the not-found case.</strong> If a
            lookup returns nothing, return{" "}
            <InlineCode>{`{ error: "..." }`}</InlineCode> not{" "}
            <InlineCode>null</InlineCode> — the model needs the explanation
            to course-correct.
          </li>
        </ul>
      </section>
    </DocsPage>
  );
}
