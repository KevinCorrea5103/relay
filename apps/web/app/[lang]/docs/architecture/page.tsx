import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P } from "@/components/DocsPage";
import { Mermaid } from "@/components/Mermaid";

const STACK_DIAGRAM = `flowchart TD
    Caller["caller<br/>SDK / curl"]
    CP["control-plane<br/>(TS / Hono · :4000)<br/>auth · BYOK · persistence"]
    DB[("Postgres + pgvector")]
    RT["runtime<br/>(Go · :4100)<br/>stateless agent loop"]
    A["Anthropic"]
    O["OpenAI"]
    Co["OpenAI-compatible<br/>(Ollama · vLLM · ...)"]
    Dash["dashboard<br/>(Next.js · :3000)"]
    Web["web<br/>(Next.js · :3001)"]

    Caller -- "Bearer relay_live_…" --> CP
    CP <--> DB
    CP -- "POST /runs (with creds)" --> RT
    RT -. "long-poll callbacks" .-> CP
    RT --> A
    RT --> O
    RT --> Co
    Dash --> CP
    Web --> CP`;

const RUN_FLOW_DIAGRAM = `sequenceDiagram
    autonumber
    participant SDK
    participant CP as Control plane
    participant DB as Postgres
    participant RT as Runtime
    participant LLM

    SDK->>CP: POST /v1/runs (auth + tools + memory + input)
    CP->>CP: resolve tenant from API key
    CP->>DB: fetch + decrypt provider credential
    Note over CP: if memory: embed input, top-K query,<br/>inject into system prompt
    CP->>DB: create runs row
    CP->>RT: POST /runs (tools + creds + runId)
    RT->>LLM: stream messages
    LLM-->>RT: tokens / tool_use
    Note over RT: for each tool_use:<br/>builtin → execute locally<br/>custom → long-poll CP
    RT-->>CP: SSE: events
    CP->>DB: persist each event
    CP-->>SDK: stream events through
    Note over SDK: if custom tool:<br/>run handler, POST result
    LLM-->>RT: done
    RT-->>CP: done event
    CP->>DB: complete run + store memory turn
    CP-->>SDK: done event`;

export default async function ArchitectureDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="architecture"
      lang={lang}
      title="Architecture"
      description="Three services and one Postgres. Each piece has one job. The seams are deliberate."
    >
      <section>
        <H2 id="overview">The whole stack</H2>
        <Mermaid chart={STACK_DIAGRAM} caption="three services + one Postgres" />
      </section>

      <section>
        <H2 id="control-plane">Control plane (TS / Hono)</H2>
        <P>
          The only stateful piece. Owns Postgres, owns the master key, owns
          all auth. Every public-facing concern lives here.
        </P>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Auth:</strong> reads <InlineCode>relay_live_…</InlineCode>{" "}
            bearer, looks up the tenant via SHA-256 of the full key.
          </li>
          <li>
            <strong>BYOK:</strong> fetches the tenant&apos;s encrypted provider
            credential, decrypts with AES-256-GCM, passes plaintext to the
            runtime per request.
          </li>
          <li>
            <strong>Persistence:</strong> creates the <InlineCode>runs</InlineCode>{" "}
            row, tees every SSE event from the runtime into{" "}
            <InlineCode>run_events</InlineCode>, marks complete/failed on{" "}
            <InlineCode>done</InlineCode>/<InlineCode>error</InlineCode>.
          </li>
          <li>
            <strong>Memory pipeline:</strong> embeds the input, fetches top-K
            from <InlineCode>memories</InlineCode>, injects into the system
            prompt before forwarding to the runtime. Stores the result
            post-<InlineCode>done</InlineCode>.
          </li>
          <li>
            <strong>Custom tools broker:</strong> in-memory map of pending tool
            results. The runtime long-polls; the SDK posts; the broker matches
            and unblocks.
          </li>
        </ul>
      </section>

      <section>
        <H2 id="runtime">Runtime (Go)</H2>
        <P>
          Stateless. No database. No persistent provider keys. Receives one
          request per run, executes the agent loop, streams events back.
        </P>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Provider abstraction:</strong> one normalized{" "}
            <InlineCode>Message</InlineCode> /{" "}
            <InlineCode>ContentPart</InlineCode> /{" "}
            <InlineCode>StreamEvent</InlineCode> shape; each provider
            translates to/from its wire format.
          </li>
          <li>
            <strong>Router:</strong> picks Anthropic vs OpenAI by model
            prefix.
          </li>
          <li>
            <strong>Built-in tools:</strong> small registry executed in-process
            (e.g. calculator).
          </li>
          <li>
            <strong>Custom tools callback:</strong> when the LLM fires a
            function tool, the runtime long-polls the control plane and
            blocks until the SDK posts a result.
          </li>
          <li>
            <strong>Max iterations:</strong> 8 per run, to prevent infinite
            tool loops.
          </li>
        </ul>
        <Callout kind="tip">
          The runtime uses Go stdlib only — zero third-party dependencies. The
          binary is a few MB and starts instantly.
        </Callout>
      </section>

      <section>
        <H2 id="postgres">Postgres + pgvector</H2>
        <P>
          The single source of truth. <InlineCode>pgvector</InlineCode> is the
          only extension (used for memory). Schema:
        </P>
        <Code
          lang="text"
          code={`tenants                  who owns what\n  └─ api_keys            relay_live_… (sha-256 hashed)\n  └─ provider_credentials  per-provider LLM keys (AES-256-GCM at rest)\n  └─ runs                each execution, scoped to a tenant\n        └─ run_events    ordered event log per run\n  └─ memories            pgvector(1536), namespaced`}
        />
      </section>

      <section>
        <H2 id="why">Why this shape</H2>
        <H3 id="why-stateless-runtime">Why is the runtime stateless?</H3>
        <P>
          So that the heavy work (LLM streaming, tool dispatch) can scale
          horizontally without database contention. The runtime is a pure
          worker — kill any instance, spin up another, no migration needed.
          A future managed cloud puts a fleet behind a load balancer; nothing
          in the agent loop has to change.
        </P>
        <H3 id="why-cp-broker">Why is the broker in the control plane?</H3>
        <P>
          Custom tools need a rendezvous point. The SDK and the runtime can&apos;t
          talk directly (the SDK is on the public internet, the runtime is
          internal). The control plane is already on the public path and
          already authenticates the SDK — adding a tiny broker is the
          smallest possible change.
        </P>
        <H3 id="why-byok">Why BYOK?</H3>
        <P>
          Zero billing risk for users (their tokens go straight to providers),
          zero cash-flow risk for us, no margin negotiation with LLM vendors,
          immediate trust signal. See{" "}
          <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/providers`}>
            Providers
          </a>{" "}
          for the credential lifecycle.
        </P>
      </section>

      <section>
        <H2 id="data-flow">A run, end to end</H2>
        <Mermaid chart={RUN_FLOW_DIAGRAM} caption="one full run, every actor" />
      </section>
    </DocsPage>
  );
}
