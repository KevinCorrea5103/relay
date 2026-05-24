import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P } from "@/components/DocsPage";

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
      description="Built-in tools and the full long-poll callback protocol for custom function tools. Your handler, your process — Relay just orchestrates."
    >
      <section>
        <H2 id="overview">Two kinds of tools</H2>
        <P>
          Built-in tools execute server-side in the Go runtime. Custom function
          tools execute in <em>your</em> process — the runtime calls back to
          your SDK over an open stream.
        </P>
        <Code
          lang="typescript"
          code={`import { createAgent, builtin, tool } from "@relayhq/sdk";\n\nconst agent = createAgent({\n  model: "claude-sonnet-4-6",\n  tools: [\n    builtin.calculator,         // runs in the runtime\n    myCustomTool,               // runs in your process\n  ],\n});`}
        />
      </section>

      <section>
        <H2 id="built-ins">Built-in tools</H2>
        <P>
          Today the registry has one tool. More land as the platform grows.
          Built-ins are useful when the operation is fast, common, and
          shouldn&apos;t cost a round-trip.
        </P>
        <H3 id="builtin-calculator">builtin.calculator</H3>
        <P>
          Performs a single arithmetic operation on two numbers. Useful as a
          control for testing tool calls without writing your own.
        </P>
        <Code
          lang="json"
          code={`{\n  "type": "object",\n  "properties": {\n    "a": { "type": "number" },\n    "b": { "type": "number" },\n    "op": { "type": "string", "enum": ["+", "-", "*", "/"] }\n  },\n  "required": ["a", "b", "op"]\n}`}
        />
        <Callout kind="tip">
          To add your own built-ins (server-side execution, no SDK
          round-trip), implement{" "}
          <InlineCode>runtime/internal/tools/tools.go</InlineCode> and register
          a handler in <InlineCode>DefaultRegistry()</InlineCode>.
        </Callout>
      </section>

      <section>
        <H2 id="custom">Custom function tools</H2>
        <P>
          The pattern is: schema + handler. The schema goes to the LLM. The
          handler runs locally.
        </P>
        <Code
          lang="typescript"
          fileName="get-user.ts"
          code={`import { tool } from "@relayhq/sdk";\n\nexport const getUser = tool({\n  name: "get_user",\n  description: "Look up a user by id. Returns name, tier, balance.",\n  inputSchema: {\n    type: "object",\n    properties: {\n      id: { type: "string", description: "user id like u_001" },\n    },\n    required: ["id"],\n    additionalProperties: false,\n  },\n  async handler({ id }: { id: string }) {\n    const user = await db.users.findById(id);\n    if (!user) return { error: \`no user with id \${id}\` };\n    return user;\n  },\n});`}
        />

        <H3 id="naming">Naming &amp; descriptions</H3>
        <P>
          Tool names should be <InlineCode>snake_case</InlineCode>,
          1–64 chars. Descriptions are part of the prompt — write them like
          you&apos;re briefing a colleague: be specific about inputs, outputs,
          and side effects.
        </P>

        <H3 id="schemas">Input schemas</H3>
        <P>
          Plain JSON Schema. Use <InlineCode>additionalProperties: false</InlineCode>{" "}
          to keep the model honest. The runtime forwards the schema verbatim
          to both Anthropic and OpenAI; provider quirks are normalized for
          you.
        </P>

        <H3 id="returns">Return values &amp; errors</H3>
        <P>
          Whatever your handler returns gets JSON-serialized as the tool
          result. Throwing turns into{" "}
          <InlineCode>{`"error: <message>"`}</InlineCode>; the model sees it
          and almost always self-corrects on the next iteration.
        </P>
        <Callout kind="tip">
          For predictable behavior, return <InlineCode>{`{ ok: true, ...data }`}</InlineCode> on success
          and <InlineCode>{`{ error: "..." }`}</InlineCode> on graceful
          failures, instead of throwing.
        </Callout>
      </section>

      <section>
        <H2 id="protocol">How the callback works</H2>
        <P>
          Custom tools work through a long-poll callback — the runtime
          orchestrates, but execution stays in your process. End-to-end:
        </P>
        <Code
          lang="text"
          code={`SDK                       control-plane                runtime                LLM\n │── POST /v1/runs ─────────►│                            │                    │\n │                            │── POST /runs ─────────────►│                    │\n │                            │                            │── stream ─────────►│\n │                            │                            │◄── tool_use ──────│\n │                            │◄── SSE: tool_call ────────│                    │\n │◄── tool_call event ───────│   (persisted)             │── GET /internal/   │\n │                            │                            │     tool-result   │\n │   (SDK runs handler        │                            │   (long-poll)     │\n │    locally)                │                            │                    │\n │── POST tool-results ──────►│                            │                    │\n │                            │── resolves long-poll ─────►│                    │\n │                            │                            │── stream ─────────►│\n │                            │◄── SSE: tool_result ──────│                    │\n │◄── tool_result event ─────│                            │                    │\n │                            │                            │◄── done ──────────│\n │◄── done ──────────────────│                            │                    │`}
        />
        <P>
          The runtime stays stateless. The SDK never talks to the runtime
          directly. Every event is persisted in <InlineCode>run_events</InlineCode>{" "}
          on the way through.
        </P>
      </section>

      <section>
        <H2 id="limits">Limits &amp; timeouts</H2>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Tool result timeout:</strong> 30 seconds by default. Configure
            with <InlineCode>RELAY_TOOL_RESULT_TIMEOUT_MS</InlineCode> on the
            control plane.
          </li>
          <li>
            <strong>Max iterations per run:</strong> 8. The agent loop bails
            after 8 tool round-trips to prevent infinite cycles.
          </li>
          <li>
            <strong>Parallel tool calls:</strong> supported. The SDK dispatches
            all custom tool handlers concurrently when the model fires more
            than one in a turn.
          </li>
          <li>
            <strong>Tool input size:</strong> bounded by provider — Anthropic
            and OpenAI both cap at ~100K characters per call.
          </li>
        </ul>
      </section>
    </DocsPage>
  );
}
