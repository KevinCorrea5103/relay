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

export default async function SdkDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="sdk"
      lang={lang}
      title="SDK reference (TypeScript)"
      description="The full public surface of @relayhq/sdk: createAgent, builtin tools, custom tools, memory, and the event stream you iterate. For Python, see Languages & SDKs."
    >
      <section>
        <H2 id="install">Install</H2>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://www.npmjs.com/package/@relayhq/sdk"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-ink-800/70 bg-ink-900/40 px-3 py-1.5 text-xs text-ink-300 hover:border-emerald-500/40 hover:text-emerald-200 transition"
          >
            <span className="font-mono">@relayhq/sdk</span>
            <span className="text-ink-600">·</span>
            <span>View on npm ↗</span>
          </a>
          <a
            href="https://github.com/KevinCorrea5103/relay/tree/main/packages/sdk"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-ink-800/70 bg-ink-900/40 px-3 py-1.5 text-xs text-ink-300 hover:border-emerald-500/40 hover:text-emerald-200 transition"
          >
            Source ↗
          </a>
        </div>
        <Code
          lang="bash"
          code={`npm install @relayhq/sdk\n# or\npnpm add @relayhq/sdk\n# or\nyarn add @relayhq/sdk`}
        />
        <P>
          Zero runtime dependencies. ESM only. Works in Node 18+, Bun, Deno
          (via npm:), Cloudflare Workers, and the browser.
        </P>
      </section>

      <section>
        <H2 id="createAgent">createAgent</H2>
        <P>
          Returns an <InlineCode>Agent</InlineCode>. All configuration is one
          object. There is no second method to call before{" "}
          <InlineCode>.run()</InlineCode>.
        </P>
        <Code
          lang="typescript"
          fileName="example.ts"
          code={`import { createAgent, builtin, tool } from "@relayhq/sdk";\n\nconst agent = createAgent({\n  apiKey: process.env.RELAY_API_KEY!,\n  baseUrl: "http://localhost:4000",  // your control plane\n  model: "claude-sonnet-4-6",\n  system: "You are a helpful assistant.",\n  tools: [builtin.calculator, myCustomTool],\n  memory: { namespace: \`user:\${userId}\` },\n});`}
        />

        <H3 id="options">Options</H3>
        <Table>
          <thead>
            <tr>
              <Th>Field</Th>
              <Th>Type</Th>
              <Th>Description</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td mono>model</Td>
              <Td mono>ModelId</Td>
              <Td>
                Required. e.g. <InlineCode>claude-sonnet-4-6</InlineCode>,{" "}
                <InlineCode>gpt-4o-mini</InlineCode>,{" "}
                <InlineCode>o3-mini</InlineCode>, or{" "}
                <InlineCode>openai:llama3.1</InlineCode> for an
                OpenAI-compatible endpoint.
              </Td>
            </tr>
            <tr>
              <Td mono>apiKey</Td>
              <Td mono>string</Td>
              <Td>
                Your <InlineCode>relay_live_…</InlineCode> tenant key. Falls back to{" "}
                <InlineCode>process.env.RELAY_API_KEY</InlineCode>.
              </Td>
            </tr>
            <tr>
              <Td mono>baseUrl</Td>
              <Td mono>string</Td>
              <Td>
                Control plane URL. Defaults to{" "}
                <InlineCode>process.env.RELAY_URL</InlineCode> then{" "}
                <InlineCode>http://localhost:4000</InlineCode>.
              </Td>
            </tr>
            <tr>
              <Td mono>system</Td>
              <Td mono>string</Td>
              <Td>System prompt prepended to every run.</Td>
            </tr>
            <tr>
              <Td mono>tools</Td>
              <Td mono>Tool[]</Td>
              <Td>
                Mix of <InlineCode>builtin.*</InlineCode> and{" "}
                <InlineCode>tool(...)</InlineCode> values.
              </Td>
            </tr>
            <tr>
              <Td mono>memory</Td>
              <Td mono>boolean | {`{ namespace }`}</Td>
              <Td>
                <InlineCode>true</InlineCode> uses namespace{" "}
                <InlineCode>&quot;default&quot;</InlineCode>;{" "}
                <InlineCode>{`{ namespace }`}</InlineCode> scopes per-user/per-thread.
              </Td>
            </tr>
          </tbody>
        </Table>
      </section>

      <section>
        <H2 id="run">agent.run(input)</H2>
        <P>
          Returns an <InlineCode>AsyncIterable&lt;AgentEvent&gt;</InlineCode>.
          The stream stays open until the model is done or errors.
        </P>
        <Code
          lang="typescript"
          code={`const stream = agent.run("What is 23 * 47?");\n\nfor await (const event of stream) {\n  switch (event.type) {\n    case "token":\n      process.stdout.write(event.text);\n      break;\n    case "tool_call":\n      console.log(\`→ \${event.name}(\${JSON.stringify(event.input)})\`);\n      break;\n    case "tool_result":\n      console.log(\`← \${JSON.stringify(event.output)}\`);\n      break;\n    case "done":\n      console.log("usage", event.usage);\n      break;\n    case "error":\n      console.error(event.message);\n      break;\n  }\n}`}
        />

        <H3 id="events">Event shapes</H3>
        <Code
          lang="typescript"
          code={`type AgentEvent =\n  | { type: "token";       text: string }\n  | { type: "tool_call";   id: string; name: string; input: unknown }\n  | { type: "tool_result"; id: string; output: unknown }\n  | { type: "done";        output: string; usage?: { input_tokens; output_tokens } }\n  | { type: "error";       message: string };`}
        />
        <Callout>
          Order is guaranteed: a <InlineCode>tool_call</InlineCode> is always
          followed by its <InlineCode>tool_result</InlineCode> before more
          tokens arrive. The final event is always either{" "}
          <InlineCode>done</InlineCode> or <InlineCode>error</InlineCode>.
        </Callout>
      </section>

      <section>
        <H2 id="builtin">Built-in tools</H2>
        <P>
          Built-in tools execute server-side in the Go runtime. Zero round-trip
          to your code.
        </P>
        <Code
          lang="typescript"
          code={`import { createAgent, builtin } from "@relayhq/sdk";\n\nconst agent = createAgent({\n  model: "claude-sonnet-4-6",\n  tools: [builtin.calculator],\n});`}
        />
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Input</Th>
              <Th>Returns</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td mono>calculator</Td>
              <Td mono>{`{ a: number, b: number, op: "+" | "-" | "*" | "/" }`}</Td>
              <Td mono>number</Td>
            </tr>
          </tbody>
        </Table>
        <Callout kind="tip">
          More built-ins land as the platform grows. To add your own to the
          runtime, see{" "}
          <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/tools#built-ins`}>
            extending built-ins
          </a>
          .
        </Callout>
      </section>

      <section>
        <H2 id="custom-tools">Custom function tools</H2>
        <P>
          Your <InlineCode>handler</InlineCode> runs in your process. Relay
          orchestrates the call, pauses the LLM, waits for your response, then
          continues.
        </P>
        <Code
          lang="typescript"
          fileName="tools.ts"
          code={`import { tool } from "@relayhq/sdk";\n\nexport const getUser = tool({\n  name: "get_user",\n  description: "Look up a user by id",\n  inputSchema: {\n    type: "object",\n    properties: { id: { type: "string" } },\n    required: ["id"],\n    additionalProperties: false,\n  },\n  async handler({ id }: { id: string }) {\n    return await db.users.findById(id);  // your code, your process\n  },\n});`}
        />
        <P>
          The handler can be async. Whatever it returns gets JSON-serialized
          and shipped to the model as the tool result. If it throws, the error
          message goes back as <InlineCode>{`"error: <message>"`}</InlineCode> —
          the model sees it and usually self-corrects.
        </P>
        <P>
          Full protocol (long-poll callback dance, retries, timeout) lives in{" "}
          <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/tools`}>
            Tools
          </a>
          .
        </P>
      </section>

      <section>
        <H2 id="memory">Memory</H2>
        <P>
          Flip the option and the agent recalls relevant past turns
          automatically. Embeddings happen server-side with{" "}
          <InlineCode>text-embedding-3-small</InlineCode>; retrieval is
          cosine-similarity top-5; storage is{" "}
          <InlineCode>pgvector</InlineCode>.
        </P>
        <Code
          lang="typescript"
          code={`const agent = createAgent({\n  model: "gpt-4o-mini",\n  memory: { namespace: \`user:\${userId}\` },\n});\n\nawait agent.run("I'm Kevin. I drink only espresso.");\n// Later, even in a different process:\nfor await (const e of agent.run("What's my coffee?")) {\n  // → "Espresso, Kevin."\n}`}
        />
        <Callout kind="warn">
          Memory requires an OpenAI credential on the tenant (for embeddings),
          even when the chat model is Claude. Anthropic doesn&apos;t ship an
          embeddings endpoint.
        </Callout>
      </section>

      <section>
        <H2 id="exports">Exports</H2>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Kind</Th>
              <Th>Purpose</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td mono>createAgent</Td>
              <Td>function</Td>
              <Td>Build an agent.</Td>
            </tr>
            <tr>
              <Td mono>tool</Td>
              <Td>function</Td>
              <Td>Define a custom function tool.</Td>
            </tr>
            <tr>
              <Td mono>builtin</Td>
              <Td>object</Td>
              <Td>
                Registry of built-in tools. Today:{" "}
                <InlineCode>builtin.calculator</InlineCode>.
              </Td>
            </tr>
            <tr>
              <Td mono>Agent, AgentConfig, AgentEvent, ModelId, AnthropicModel, OpenAIModel, Tool, BuiltinTool, FunctionTool, MemoryConfig</Td>
              <Td>type</Td>
              <Td>Strongly-typed everything.</Td>
            </tr>
          </tbody>
        </Table>
      </section>
    </DocsPage>
  );
}
