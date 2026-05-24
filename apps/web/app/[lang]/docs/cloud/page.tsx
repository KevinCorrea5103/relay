import Link from "next/link";
import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P } from "@/components/DocsPage";
import { RELAY_URL } from "@/lib/relay-url";

export default async function CloudDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="cloud"
      lang={lang}
      title="Cloud (managed)"
      description="Sign up, paste your provider key, get a Relay API key. Skip the Docker, Postgres, and 3-service deploy. Your tokens still go direct to Anthropic / OpenAI — Relay never proxies billing."
    >
      <section>
        <H2 id="how">How it works</H2>
        <P>
          The cloud version runs the exact same control plane + runtime + Postgres
          stack you would self-host, hosted by us. You bring your own provider
          keys; we orchestrate the agent loop, store traces, and run the memory
          pipeline.
        </P>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>BYOK.</strong> Your OpenAI / Anthropic keys are encrypted
            with AES-256-GCM the moment they arrive and decrypted per request.
          </li>
          <li>
            <strong>No proxied billing.</strong> Your tokens flow straight to
            Anthropic and OpenAI. They invoice you, not us.
          </li>
          <li>
            <strong>Free during beta.</strong> No credit card. Reasonable per-key
            rate limits.
          </li>
          <li>
            <strong>Self-host always available.</strong> If you outgrow the
            cloud limits or want to keep everything in your VPC, the same code
            is on GitHub under Apache 2.0.
          </li>
        </ul>
      </section>

      <section>
        <H2 id="signup">Sign up in 30 seconds</H2>
        <ol className="list-decimal space-y-2 pl-5 text-ink-300">
          <li>
            Go to{" "}
            <Link
              href={`/${lang}/signup`}
              className="text-emerald-300 hover:text-emerald-200"
            >
              relay-cloud / signup
            </Link>
            .
          </li>
          <li>Paste your email + at least one provider key.</li>
          <li>
            You get a <InlineCode>relay_live_…</InlineCode> key on screen (and
            in your inbox if we have email configured).
          </li>
          <li>Install the SDK and point it at the cloud control plane:</li>
        </ol>
        <Code
          lang="bash"
          code={`npm install @relayhq/sdk`}
        />
        <Code
          lang="typescript"
          fileName="agent.ts"
          code={`import { createAgent } from "@relayhq/sdk";\n\nconst agent = createAgent({\n  apiKey: process.env.RELAY_API_KEY,\n  baseUrl: "${RELAY_URL}",\n  model: "gpt-4o-mini",\n});\n\nfor await (const e of agent.run("Say hi in three languages.")) {\n  if (e.type === "token") process.stdout.write(e.text);\n}`}
        />
      </section>

      <section>
        <H2 id="dashboard">Your dashboard</H2>
        <P>
          The internal observability dashboard (runs list + execution trace) is
          the same one you&apos;d run self-hosted. Sign in with your API key on
          the{" "}
          <Link
            href={`/${lang}/login`}
            className="text-emerald-300 hover:text-emerald-200"
          >
            login
          </Link>{" "}
          page and the dashboard reads from the cloud control plane on your
          behalf.
        </P>
      </section>

      <section>
        <H2 id="limits">Limits during beta</H2>
        <ul className="list-disc space-y-1 pl-5 text-ink-300">
          <li>10 agent runs / minute / API key</li>
          <li>One tenant per email</li>
          <li>Trace retention: 30 days</li>
          <li>Memory rows: unlimited (but they live in shared Postgres)</li>
        </ul>
        <Callout kind="tip">
          Need more? <a href="https://github.com/KevinCorrea5103/relay/issues" className="text-emerald-300 hover:text-emerald-200">Open an issue</a>{" "}
          — these limits exist to prevent abuse, not to gate real usage.
        </Callout>
      </section>

      <section>
        <H2 id="rotate">Rotating keys</H2>
        <H3 id="rotate-provider">Provider key (your OpenAI / Anthropic key)</H3>
        <Code
          lang="bash"
          code={`curl -X PUT ${RELAY_URL}/v1/credentials/openai \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{"apiKey":"sk-..."}'`}
        />
        <H3 id="rotate-relay">Relay API key</H3>
        <P>
          API keys are SHA-256 hashed — we can&apos;t show them again. For now,
          to rotate your Relay key, open an issue and we&apos;ll reset your
          tenant. (Self-serve rotation is on the roadmap.)
        </P>
      </section>

      <section>
        <H2 id="vs-self-host">Cloud vs self-host: how to choose</H2>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Choose cloud</strong> if you want to ship an agent today
            and don&apos;t want to think about Postgres, Docker, or where to
            deploy a Go binary.
          </li>
          <li>
            <strong>Choose self-host</strong> if you need data in your VPC, are
            past the beta&apos;s rate limits, or want absolute control over the
            stack.
          </li>
          <li>
            <strong>You can switch at any time.</strong> Your code stays the
            same — only <InlineCode>baseUrl</InlineCode> and{" "}
            <InlineCode>apiKey</InlineCode> change.
          </li>
        </ul>
      </section>
    </DocsPage>
  );
}
