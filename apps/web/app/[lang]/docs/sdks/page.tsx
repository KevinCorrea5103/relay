import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P } from "@/components/DocsPage";

export default async function SdksDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="sdks"
      lang={lang}
      title="Languages & SDKs"
      description="Two official SDKs (TypeScript, Python) and a documented HTTP + SSE protocol — wire Relay into any stack."
    >
      <section>
        <H2 id="overview">What's supported</H2>
        <P>
          The SDK contract is the same in every language: <InlineCode>createAgent({"{...}"})</InlineCode>{" "}
          returns something you iterate, yielding events.
        </P>

        <div className="overflow-hidden rounded-xl border border-ink-800/70">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="bg-ink-900/60 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">Runtime</th>
                <th className="bg-ink-900/60 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">Install</th>
                <th className="bg-ink-900/60 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-200">Node.js (npm / pnpm / yarn)</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top font-mono text-[12.5px] text-emerald-200">npm install @relayhq/sdk</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-300">Official ✓</td>
              </tr>
              <tr>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-200">Python (pip / uv / poetry)</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top font-mono text-[12.5px] text-emerald-200">pip install relayhq</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-300">Official ✓</td>
              </tr>
              <tr>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-200">Next.js (server / route handlers)</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top font-mono text-[12.5px] text-emerald-200">npm install @relayhq/sdk</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-300">via Node SDK ✓</td>
              </tr>
              <tr>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-200">Bun</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top font-mono text-[12.5px] text-emerald-200">bun add @relayhq/sdk</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-300">via Node SDK ✓</td>
              </tr>
              <tr>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-200">Deno</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top font-mono text-[12.5px] text-emerald-200">import &quot;npm:@relayhq/sdk&quot;</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-300">via Node SDK ✓</td>
              </tr>
              <tr>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-200">Cloudflare Workers</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top font-mono text-[12.5px] text-emerald-200">npm install @relayhq/sdk</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-300">via Node SDK ✓</td>
              </tr>
              <tr>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-200">Browser</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top font-mono text-[12.5px] text-emerald-200">npm install @relayhq/sdk</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-300">via Node SDK ✓ (fetch + ReadableStream)</td>
              </tr>
              <tr>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-200">Go / Rust / Ruby / PHP / Elixir / …</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top font-mono text-[12.5px] text-ink-300">—</td>
                <td className="border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-300">Direct HTTP + SSE (~30 LOC, see below)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <H2 id="typescript">TypeScript / Node</H2>
        <P>
          Published as <InlineCode>@relayhq/sdk</InlineCode>. Zero runtime
          dependencies. ESM only. Node 18+.
        </P>
        <Code
          lang="bash"
          code={`npm install @relayhq/sdk\n# or\npnpm add @relayhq/sdk\n# or\nyarn add @relayhq/sdk`}
        />
        <Code
          lang="typescript"
          fileName="agent.ts"
          code={`import { createAgent } from "@relayhq/sdk";\n\nconst agent = createAgent({\n  apiKey: process.env.RELAY_API_KEY!,\n  baseUrl: "https://api.relaygh.dev",\n  model: "gpt-4o-mini",\n});\n\nfor await (const event of agent.run("Say hi in three languages.")) {\n  if (event.type === "token") process.stdout.write(event.text);\n}`}
        />
        <P>
          See the <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/sdk`}>SDK reference</a> for the full surface.
        </P>
      </section>

      <section>
        <H2 id="python">Python</H2>
        <P>
          Published as <InlineCode>relayhq</InlineCode> on PyPI. Pure async via
          <InlineCode>httpx</InlineCode>. Python 3.9+.
        </P>
        <Code
          lang="bash"
          code={`pip install relayhq\n# or\nuv add relayhq\n# or\npoetry add relayhq`}
        />
        <Code
          lang="python"
          fileName="agent.py"
          code={`import asyncio, os\nfrom relayhq import create_agent\n\nagent = create_agent(\n    api_key=os.environ["RELAY_API_KEY"],\n    base_url="https://api.relaygh.dev",\n    model="gpt-4o-mini",\n)\n\nasync def main():\n    async for event in agent.run("Say hi in three languages."):\n        if event["type"] == "token":\n            print(event["text"], end="", flush=True)\n\nasyncio.run(main())`}
        />

        <H3 id="python-tools">Custom function tools (Python)</H3>
        <Code
          lang="python"
          code={`from relayhq import create_agent, builtin, tool\n\nasync def get_user_handler(input):\n    return await db.users.find(input["id"])\n\nget_user = tool(\n    name="get_user",\n    description="Look up a user by id",\n    input_schema={\n        "type": "object",\n        "properties": {"id": {"type": "string"}},\n        "required": ["id"],\n    },\n    handler=get_user_handler,   # sync or async; both work\n)\n\nagent = create_agent(\n    model="claude-sonnet-4-6",\n    tools=[builtin.calculator, get_user],\n)`}
        />
        <Callout kind="tip">
          The Python SDK mirrors the JS one event-for-event, including the
          long-poll callback protocol for custom tools. Your handler runs in
          your Python process; Relay never sees its body.
        </Callout>
      </section>

      <section>
        <H2 id="nextjs">Next.js</H2>
        <P>
          The Node SDK works in every Next environment — server components,
          server actions, route handlers, middleware. Below is a route handler
          that proxies an agent run as an NDJSON stream.
        </P>
        <Code
          lang="typescript"
          fileName="app/api/agent/route.ts"
          code={`import { createAgent } from "@relayhq/sdk";\n\nexport async function POST(req: Request) {\n  const { prompt } = await req.json();\n\n  const agent = createAgent({\n    apiKey: process.env.RELAY_API_KEY!,\n    baseUrl: "https://api.relaygh.dev",\n    model: "gpt-4o-mini",\n  });\n\n  const encoder = new TextEncoder();\n  const stream = new ReadableStream({\n    async start(controller) {\n      for await (const event of agent.run(prompt)) {\n        controller.enqueue(encoder.encode(JSON.stringify(event) + "\\n"));\n      }\n      controller.close();\n    },\n  });\n\n  return new Response(stream, {\n    headers: { "content-type": "application/x-ndjson" },\n  });\n}`}
        />
        <P>
          The client component can read it with{" "}
          <InlineCode>fetch(...).body.getReader()</InlineCode> and parse each
          line.
        </P>
      </section>

      <section>
        <H2 id="curl">cURL / HTTP</H2>
        <P>
          The protocol is plain HTTP + SSE. You can use Relay from anything
          that can do an HTTP POST.
        </P>
        <Code
          lang="bash"
          code={`curl -N -X POST https://api.relaygh.dev/v1/runs \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{\n    "model": "gpt-4o-mini",\n    "input": "Say hi in three languages."\n  }'`}
        />
        <P>Each event arrives as one SSE frame:</P>
        <Code
          lang="text"
          code={`data: {"type":"token","text":"Hello"}\n\ndata: {"type":"token","text":" Bonjour"}\n\ndata: {"type":"done","output":"...","usage":{"input_tokens":34,"output_tokens":12}}`}
        />
        <P>
          Full API surface lives at{" "}
          <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/api`}>
            /docs/api
          </a>
          .
        </P>
      </section>

      <section>
        <H2 id="go">Go (no official SDK, ~30 LOC)</H2>
        <P>
          No third-party deps required — just{" "}
          <InlineCode>net/http</InlineCode> + <InlineCode>bufio</InlineCode>.
        </P>
        <Code
          lang="go"
          fileName="agent.go"
          code={`package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"net/http"\n\t"os"\n\t"strings"\n)\n\nfunc main() {\n\tbody := strings.NewReader(\`{"model":"gpt-4o-mini","input":"Say hi."}\`)\n\treq, _ := http.NewRequest("POST",\n\t\t"https://api.relaygh.dev/v1/runs", body)\n\treq.Header.Set("authorization", "Bearer "+os.Getenv("RELAY_API_KEY"))\n\treq.Header.Set("content-type", "application/json")\n\n\tresp, err := http.DefaultClient.Do(req)\n\tif err != nil { panic(err) }\n\tdefer resp.Body.Close()\n\n\tscanner := bufio.NewScanner(resp.Body)\n\tfor scanner.Scan() {\n\t\tline := scanner.Text()\n\t\tif strings.HasPrefix(line, "data: ") {\n\t\t\tfmt.Println(strings.TrimPrefix(line, "data: "))\n\t\t}\n\t}\n}`}
        />
        <Callout>
          The same shape works for Rust (<InlineCode>reqwest</InlineCode>),
          Ruby (<InlineCode>net/http</InlineCode>), PHP, Elixir
          (<InlineCode>Finch</InlineCode>), and anywhere else. If you write a
          community SDK, open a PR — happy to link it from here.
        </Callout>
      </section>

      <section>
        <H2 id="picking">Picking an SDK</H2>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>You&apos;re shipping a Node / Next / Bun app:</strong>{" "}
            <InlineCode>@relayhq/sdk</InlineCode>. Type-safe, batteries-included.
          </li>
          <li>
            <strong>You&apos;re shipping a Python service / FastAPI / Django:</strong>{" "}
            <InlineCode>relayhq</InlineCode>. Async-native, fits cleanly into
            existing async stacks.
          </li>
          <li>
            <strong>Anything else:</strong> the HTTP API is small enough to
            wrap in an afternoon. See <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/api`}>/docs/api</a>.
          </li>
        </ul>
      </section>
    </DocsPage>
  );
}
