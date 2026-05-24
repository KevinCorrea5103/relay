import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P, Table, Td, Th } from "@/components/DocsPage";

export default async function ProvidersDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="providers"
      lang={lang}
      title="Providers"
      description="Anthropic, OpenAI, and any OpenAI-compatible endpoint. Routing is automatic by model prefix; per-tenant credentials are encrypted at rest."
    >
      <section>
        <H2 id="routing">Routing by model</H2>
        <P>
          The model string in <InlineCode>createAgent({`{ model }`})</InlineCode>{" "}
          determines the provider. No separate option to set.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Pattern</Th>
              <Th>Provider</Th>
              <Th>Examples</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td mono>claude-*</Td>
              <Td mono>anthropic</Td>
              <Td mono>claude-sonnet-4-6, claude-opus-4-7, claude-haiku-4-5</Td>
            </tr>
            <tr>
              <Td mono>gpt-*, chatgpt-*</Td>
              <Td mono>openai</Td>
              <Td mono>gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini</Td>
            </tr>
            <tr>
              <Td mono>o1-*, o3-*, o4-*</Td>
              <Td mono>openai</Td>
              <Td mono>o3, o3-mini, o4-mini</Td>
            </tr>
            <tr>
              <Td mono>anthropic:&lt;model&gt;</Td>
              <Td mono>anthropic</Td>
              <Td mono>anthropic:claude-sonnet-4-6</Td>
            </tr>
            <tr>
              <Td mono>openai:&lt;model&gt;</Td>
              <Td mono>openai</Td>
              <Td mono>openai:llama3.1, openai:mistral-7b</Td>
            </tr>
          </tbody>
        </Table>
        <Callout kind="tip">
          The explicit <InlineCode>provider:</InlineCode> prefix lets you
          force a route when a model name is ambiguous, or when you&apos;re
          pointing at an OpenAI-compatible endpoint with a non-standard model
          name.
        </Callout>
      </section>

      <section>
        <H2 id="byok">Upload credentials (BYOK)</H2>
        <P>
          Per-tenant credentials. AES-256-GCM at rest. The runtime never sees
          a Relay key and the credentials never leave the control plane in
          plain text.
        </P>
        <H3 id="anthropic">Anthropic</H3>
        <Code
          lang="bash"
          code={`curl -X PUT $RELAY_URL/v1/credentials/anthropic \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{"apiKey":"sk-ant-..."}'`}
        />
        <H3 id="openai">OpenAI</H3>
        <Code
          lang="bash"
          code={`curl -X PUT $RELAY_URL/v1/credentials/openai \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{"apiKey":"sk-..."}'`}
        />
        <H3 id="compatible">OpenAI-compatible (Ollama, vLLM, Groq, Together, OpenRouter…)</H3>
        <P>
          Any service that speaks the OpenAI Chat Completions API works.
          Configure <InlineCode>baseUrl</InlineCode> in the credential.
        </P>
        <Code
          lang="bash"
          code={`# Ollama on localhost\ncurl -X PUT $RELAY_URL/v1/credentials/openai \\\n  -H "authorization: Bearer $RELAY_API_KEY" \\\n  -H "content-type: application/json" \\\n  -d '{"apiKey":"ollama","baseUrl":"http://localhost:11434/v1"}'\n\n# Then use any model the endpoint serves:\nRELAY_MODEL=openai:llama3.1 pnpm example`}
        />
      </section>

      <section>
        <H2 id="rotation">Rotation &amp; deletion</H2>
        <P>
          <InlineCode>PUT</InlineCode> overwrites the existing credential for
          that <InlineCode>(tenant, provider)</InlineCode> pair. There&apos;s
          no separate &ldquo;update&rdquo; — same endpoint, new payload.
        </P>
        <Code
          lang="bash"
          code={`# List (never returns secrets)\ncurl -H "authorization: Bearer $RELAY_API_KEY" $RELAY_URL/v1/credentials\n\n# Revoke\ncurl -X DELETE -H "authorization: Bearer $RELAY_API_KEY" \\\n  $RELAY_URL/v1/credentials/openai`}
        />
        <Callout>
          Each run fetches a fresh decrypted credential. No restart needed
          after rotation — the next request picks up the new key.
        </Callout>
      </section>

      <section>
        <H2 id="model-list">Models with good autocomplete</H2>
        <P>
          The SDK union types know about common Anthropic + OpenAI models, but
          accepts any string (escape-hatched with{" "}
          <InlineCode>{`(string & {})`}</InlineCode>) so new releases
          don&apos;t require an SDK bump.
        </P>
        <Code
          lang="typescript"
          code={`import type { AnthropicModel, OpenAIModel, ModelId } from "@relayhq/sdk";\n\nconst m1: AnthropicModel = "claude-sonnet-4-6";\nconst m2: OpenAIModel    = "gpt-4o-mini";\nconst m3: ModelId        = "openai:llama3.1"; // any string also valid`}
        />
      </section>

      <section>
        <H2 id="adding">Add a new provider</H2>
        <P>
          Adding Gemini, Cohere, or Bedrock-native is one Go file plus a
          router entry. See{" "}
          <a className="text-emerald-300 hover:text-emerald-200" href="https://github.com/KevinCorrea5103/relay/blob/main/CONTRIBUTING.md#adding-a-provider">
            CONTRIBUTING.md
          </a>{" "}
          for the step-by-step.
        </P>
      </section>
    </DocsPage>
  );
}
