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
            <tr><Td mono>POST</Td><Td mono>/v1/runs</Td><Td>start a run; returns an SSE event stream</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/runs</Td><Td>list this tenant&apos;s runs</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/runs/:id</Td><Td>run metadata</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/runs/:id/events</Td><Td>full event log (ordered)</Td></tr>
            <tr><Td mono>POST</Td><Td mono>/v1/runs/:id/tool-results/:toolUseId</Td><Td>SDK posts a custom tool output</Td></tr>
            <tr><Td mono>PUT</Td><Td mono>/v1/credentials/:provider</Td><Td>upload or rotate</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/credentials</Td><Td>list (no secrets returned)</Td></tr>
            <tr><Td mono>DELETE</Td><Td mono>/v1/credentials/:provider</Td><Td>revoke</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/v1/memories?namespace=&amp;limit=</Td><Td>list memories</Td></tr>
            <tr><Td mono>DELETE</Td><Td mono>/v1/memories/:id</Td><Td>delete one</Td></tr>
            <tr><Td mono>DELETE</Td><Td mono>/v1/memories?namespace=</Td><Td>clear a namespace</Td></tr>
            <tr><Td mono>GET</Td><Td mono>/internal/runs/:id/tool-result/:toolUseId</Td><Td>runtime long-poll (internal-auth)</Td></tr>
          </tbody>
        </Table>
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
          code={`# list runs (paginated by ?limit, filtered by ?status)\ncurl -H "authorization: Bearer $RELAY_API_KEY" \\\n  "$RELAY_URL/v1/runs?status=completed&limit=20"\n\n# run metadata\ncurl -H "authorization: Bearer $RELAY_API_KEY" \\\n  "$RELAY_URL/v1/runs/<run-id>"\n\n# full event log\ncurl -H "authorization: Bearer $RELAY_API_KEY" \\\n  "$RELAY_URL/v1/runs/<run-id>/events"`}
        />
      </section>
    </DocsPage>
  );
}
