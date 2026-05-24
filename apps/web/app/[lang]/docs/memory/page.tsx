import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P } from "@/components/DocsPage";

export default async function MemoryDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="memory"
      lang={lang}
      title="Memory"
      description="Semantic memory powered by pgvector. Pass `memory: { namespace }` and the agent recalls past turns automatically — no embedding work in your code."
    >
      <section>
        <H2 id="quickstart">Quickstart</H2>
        <Code
          lang="typescript"
          code={`const agent = createAgent({\n  model: "gpt-4o-mini",\n  memory: { namespace: \`user:\${userId}\` },\n});\n\nawait agent.run("I'm Kevin. I drink only espresso. Remember this.");\n\n// Hours, days, processes later — same namespace:\nfor await (const e of agent.run("What's my coffee?")) {\n  // → "Espresso, Kevin."\n}`}
        />
      </section>

      <section>
        <H2 id="pipeline">What happens under the hood</H2>
        <P>
          On every run with <InlineCode>memory</InlineCode> set, the control
          plane:
        </P>
        <ol className="list-decimal space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Embeds the user input</strong> via OpenAI{" "}
            <InlineCode>text-embedding-3-small</InlineCode> (1536-dim).
          </li>
          <li>
            <strong>Searches top-5 similar memories</strong> by cosine
            similarity within{" "}
            <InlineCode>(tenant_id, namespace)</InlineCode>, with a similarity
            floor of 0.3.
          </li>
          <li>
            <strong>Injects them</strong> into the system prompt as a bullet
            list (&ldquo;Relevant context from past interactions&rdquo;).
          </li>
          <li>
            <strong>Persists a <InlineCode>memory_retrieved</InlineCode> event</strong> at{" "}
            <InlineCode>seq=0</InlineCode> so the dashboard trace shows what was
            recalled.
          </li>
          <li>
            <strong>Runs the agent normally.</strong>
          </li>
          <li>
            <strong>After <InlineCode>done</InlineCode></strong>, embeds the{" "}
            <InlineCode>(input, output)</InlineCode> pair and stores it as a
            new memory linked to the source <InlineCode>run_id</InlineCode>.
          </li>
        </ol>
      </section>

      <section>
        <H2 id="namespaces">Namespaces</H2>
        <P>
          A namespace scopes a chunk of memory. Use them like database
          tables — by user, by session, by agent persona, by team.
        </P>
        <Code
          lang="typescript"
          code={`memory: true                              // → namespace "default"\nmemory: { namespace: "default" }          // explicit same thing\nmemory: { namespace: \`user:\${userId}\` }   // per-user\nmemory: { namespace: \`thread:\${threadId}\` } // per-conversation\nmemory: { namespace: \`agent:support\` }    // per-persona`}
        />
        <Callout kind="tip">
          Namespaces are free-form strings. Pick a convention early —{" "}
          <InlineCode>{`type:value`}</InlineCode> is what most teams converge on.
        </Callout>
      </section>

      <section>
        <H2 id="provider">Why OpenAI is required</H2>
        <P>
          Memory always uses OpenAI <InlineCode>text-embedding-3-small</InlineCode>{" "}
          for embeddings — even when the chat model is Claude. Anthropic
          doesn&apos;t ship an embeddings API. Make sure your tenant has an
          OpenAI credential uploaded, even if you only chat with Claude.
        </P>
        <Code
          lang="bash"
          code={`curl -X PUT $RELAY_URL/v1/credentials/openai \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{"apiKey":"sk-..."}'`}
        />
        <Callout kind="warn">
          Without an OpenAI credential, runs with <InlineCode>memory</InlineCode>{" "}
          enabled fail with{" "}
          <InlineCode>memory: no openai credentials for this tenant</InlineCode>.
        </Callout>
      </section>

      <section>
        <H2 id="inspect">Inspect &amp; manage</H2>
        <P>
          Three HTTP endpoints let you peek into memory state.
        </P>
        <H3 id="list">List memories</H3>
        <Code
          lang="bash"
          code={`curl -s -H "authorization: Bearer $RELAY_API_KEY" \\\n  "localhost:4000/v1/memories?namespace=user:42&limit=20" | jq`}
        />
        <H3 id="delete-one">Delete one memory</H3>
        <Code
          lang="bash"
          code={`curl -X DELETE -H "authorization: Bearer $RELAY_API_KEY" \\\n  "localhost:4000/v1/memories/<memory-id>"`}
        />
        <H3 id="clear">Clear a whole namespace</H3>
        <Code
          lang="bash"
          code={`curl -X DELETE -H "authorization: Bearer $RELAY_API_KEY" \\\n  "localhost:4000/v1/memories?namespace=user:42"`}
        />
      </section>

      <section>
        <H2 id="schema">Schema (advanced)</H2>
        <Code
          lang="sql"
          code={`create table memories (\n  id            uuid primary key default gen_random_uuid(),\n  tenant_id     uuid not null references tenants(id) on delete cascade,\n  namespace     text not null,\n  content       text not null,\n  embedding     vector(1536) not null,\n  metadata      jsonb not null default '{}'::jsonb,\n  source_run_id uuid references runs(id) on delete set null,\n  created_at    timestamptz not null default now(),\n  ttl_at        timestamptz                            -- expired rows filtered at read time\n);\n\ncreate index memories_embedding_idx\n  on memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);`}
        />
        <Callout>
          <InlineCode>ttl_at</InlineCode> is enforced at read time today (the
          search query filters expired rows). A background janitor is on the
          roadmap.
        </Callout>
      </section>

      <section>
        <H2 id="costs">Costs</H2>
        <P>
          Memory adds two embedding calls per run (one to query, one to
          store). With{" "}
          <InlineCode>text-embedding-3-small</InlineCode> at $0.02 per 1M
          tokens, this is effectively rounding error vs the chat completion
          itself.
        </P>
      </section>
    </DocsPage>
  );
}
