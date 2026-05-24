import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P } from "@/components/DocsPage";

export default async function Quickstart({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="quickstart"
      lang={lang}
      title="Quickstart"
      description="Clone the repo, run two commands, watch a streaming agent with tool calls light up the dashboard."
    >
      <section>
        <H2 id="prereqs">Prerequisites</H2>
        <P>
          You need <InlineCode>Node 20+</InlineCode>,{" "}
          <InlineCode>pnpm 9+</InlineCode>, <InlineCode>Go 1.22+</InlineCode>,
          and <InlineCode>Docker</InlineCode>. Plus at least one provider API
          key — Anthropic or OpenAI.
        </P>
        <Code
          lang="bash"
          code={`# macOS, via Homebrew\nbrew install node pnpm go\n# Docker Desktop: https://www.docker.com/products/docker-desktop`}
        />
      </section>

      <section>
        <H2 id="setup">1. Clone &amp; install</H2>
        <P>
          The whole stack lives in one repo. <InlineCode>pnpm install</InlineCode>
          installs every workspace package in one shot.
        </P>
        <Code
          lang="bash"
          code={`git clone https://github.com/KevinCorrea5103/relay\ncd relay\npnpm install`}
        />
      </section>

      <section>
        <H2 id="env">2. Add a provider key</H2>
        <P>
          Drop your Anthropic or OpenAI key into{" "}
          <InlineCode>.env</InlineCode>. You don&apos;t need both; one is
          enough.
        </P>
        <Code
          lang="bash"
          code={`echo "OPENAI_API_KEY=sk-..."        >> .env\n# and/or\necho "ANTHROPIC_API_KEY=sk-ant-..."  >> .env`}
        />
        <Callout kind="tip">
          The keys get encrypted with AES-256-GCM and stored in Postgres on
          bootstrap. They never live in plain text after that — service env
          variables don&apos;t need them either.
        </Callout>
      </section>

      <section>
        <H2 id="bootstrap">3. Bootstrap</H2>
        <P>
          One idempotent command generates the master key, brings up Postgres,
          applies migrations, creates a tenant, and mints your first
          <InlineCode>RELAY_API_KEY</InlineCode>. Re-running it is safe.
        </P>
        <Code lang="bash" code={`pnpm bootstrap`} />
        <P>You&apos;ll see something like:</P>
        <Code
          lang="bash"
          code={`▸ .env file ✓ created from .env.example\n▸ RELAY_MASTER_KEY ✓ generated and written to .env\n▸ RELAY_INTERNAL_SECRET ✓ generated\n▸ Build @relayhq/sdk ✓\n▸ Build @relayhq/db ✓\n▸ docker compose up postgres ✓\n▸ apply migrations ✓\n▸ bootstrap tenant + RELAY_API_KEY ✓ minted relay_live_AbCd…\n\n✓ Setup complete. Run \`pnpm dev\` to start the whole stack.`}
        />
      </section>

      <section>
        <H2 id="run">4. Start everything</H2>
        <P>
          <InlineCode>pnpm dev</InlineCode> runs the runtime (Go), control
          plane (Node), dashboard, and marketing site in parallel. One{" "}
          <InlineCode>Ctrl-C</InlineCode> kills all four.
        </P>
        <Code lang="bash" code={`pnpm dev`} />
        <P>You&apos;ll see four colored log streams:</P>
        <Code
          lang="bash"
          code={`[runtime]  listening on http://localhost:4100\n[api]      [control-plane] listening on http://localhost:4000\n[dash]     ▲ Next.js 15  ✓ Ready in 1071ms · localhost:3000\n[web]      ▲ Next.js 15  ✓ Ready in 1065ms · localhost:3001`}
        />
        <P>Open the dashboard:</P>
        <ul className="list-disc pl-5 text-ink-300 space-y-1">
          <li>
            <InlineCode>http://localhost:3000</InlineCode> — internal observability (runs, traces)
          </li>
          <li>
            <InlineCode>http://localhost:3001</InlineCode> — marketing site / docs
          </li>
        </ul>
      </section>

      <section>
        <H2 id="first-agent">5. Fire your first agent</H2>
        <P>
          In a new terminal, run the bundled example. It uses a built-in
          calculator and a custom <InlineCode>get_user</InlineCode> tool that
          runs in your local Node process.
        </P>
        <Code
          lang="bash"
          code={`pnpm example                               # uses claude-sonnet-4-6 by default\n\nRELAY_MODEL=gpt-4o-mini       pnpm example  # switch model via env\nRELAY_MODEL=claude-haiku-4-5  pnpm example "Compute (17+8)*3"`}
        />
        <P>
          You&apos;ll see tokens stream in, tool calls intercalated with their
          results, and a final answer:
        </P>
        <Code
          lang="bash"
          code={`[model=gpt-4o-mini] > Look up u_001 and u_003. What's the combined balance, and how much would 7% tax on it be?\n\n→ get_user({"id":"u_001"}) = {"name":"Ada Lovelace","tier":"pro","balanceUsd":1480.5}\n→ get_user({"id":"u_003"}) = {"name":"Alan Turing","tier":"enterprise","balanceUsd":9320.75}\n→ calculator({"a":1480.5,"b":9320.75,"op":"+"}) = 10801.25\n→ calculator({"a":10801.25,"b":0.07,"op":"*"}) = 756.0875\nThe combined balance of u_001 and u_003 is $10,801.25. The 7% tax on this amount would be approximately $756.09.\n\n[done] usage={"input_tokens":1960,"output_tokens":198}`}
        />
        <P>
          Refresh <InlineCode>localhost:3000</InlineCode> — the run is there
          with a complete event-by-event trace.
        </P>
      </section>

      <section>
        <H2 id="next">Where to go next</H2>
        <H3 id="next-sdk">Use the SDK in your own code</H3>
        <P>
          The SDK is on npm. Point it at your local control plane and pass the
          API key the bootstrap printed.
        </P>
        <Code
          lang="typescript"
          fileName="my-agent.ts"
          code={`import { createAgent, builtin } from "@relayhq/sdk";\n\nconst agent = createAgent({\n  baseUrl: "http://localhost:4000",     // your local control plane\n  apiKey: process.env.RELAY_API_KEY!,   // the relay_live_… you got\n  model: "claude-sonnet-4-6",\n  tools: [builtin.calculator],\n});\n\nfor await (const event of agent.run("What is 23 * 47?")) {\n  if (event.type === "token") process.stdout.write(event.text);\n}`}
        />

        <H3 id="next-memory">Add semantic memory</H3>
        <P>
          One option flips on per-tenant memory backed by{" "}
          <InlineCode>pgvector</InlineCode>. See{" "}
          <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/memory`}>
            Memory
          </a>{" "}
          for the full pipeline.
        </P>
        <Code
          lang="typescript"
          code={`const agent = createAgent({\n  model: "gpt-4o-mini",\n  memory: { namespace: \`user:\${userId}\` },\n});`}
        />

        <H3 id="next-tools">Add custom tools</H3>
        <P>
          Your handler runs in your process. The runtime pauses, the SDK
          fulfills, you continue. See{" "}
          <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/tools`}>
            Tools
          </a>
          .
        </P>
      </section>

      <section>
        <H2 id="troubleshooting">Troubleshooting</H2>
        <Callout kind="warn">
          <strong>Port 5432 already taken?</strong> Another Postgres is
          running. Edit <InlineCode>docker-compose.yml</InlineCode> to map a
          different host port (e.g. <InlineCode>&quot;5434:5432&quot;</InlineCode>),
          then update the <InlineCode>DATABASE_URL</InlineCode> default in{" "}
          <InlineCode>packages/db/src/client.ts</InlineCode> (or pass{" "}
          <InlineCode>DATABASE_URL</InlineCode> via env).
        </Callout>
        <Callout kind="warn">
          <strong>
            <InlineCode>pnpm setup</InlineCode> opened a pnpm config prompt instead of running setup?
          </strong>{" "}
          <InlineCode>pnpm setup</InlineCode> is a reserved built-in command.
          Use <InlineCode>pnpm bootstrap</InlineCode> instead.
        </Callout>
        <Callout kind="warn">
          <strong>The Go runtime fails to start with a missing-deps error?</strong>{" "}
          Run <InlineCode>cd runtime &amp;&amp; go mod tidy</InlineCode> once. The
          runtime uses stdlib only, so there&apos;s nothing to download — but
          the tidy step is still needed the first time.
        </Callout>
      </section>
    </DocsPage>
  );
}
