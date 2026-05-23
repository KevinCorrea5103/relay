# @relayhq/sdk

The TypeScript SDK for [Relay](https://github.com/KevinCorrea5103/relay) — the
backend cloud for reliable AI agents.

```bash
npm install @relayhq/sdk
# or
pnpm add @relayhq/sdk
```

## What you get

Memory, retries, tools, traces, and durable execution — without building
orchestration infrastructure yourself.

```ts
import { createAgent, builtin, tool } from "@relayhq/sdk";

const getUser = tool({
  name: "get_user",
  description: "Look up a user by id",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
  },
  async handler({ id }: { id: string }) {
    return db.users.findById(id); // runs locally in your process
  },
});

const agent = createAgent({
  apiKey: process.env.RELAY_API_KEY,
  model: "claude-sonnet-4-6",
  memory: { namespace: `user:${userId}` },
  tools: [builtin.calculator, getUser],
});

for await (const event of agent.run("Look up u_001 and tell me their tier")) {
  // event.type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error'
}
```

## How it works

The SDK talks to a Relay control plane over plain HTTP + SSE.

- **Multi-provider routing.** `claude-*` → Anthropic. `gpt-*`, `o3-*`, `o4-*`
  → OpenAI. Or explicit `openai:llama3.1` for OpenAI-compatible endpoints
  (Ollama, vLLM, OpenRouter, Together, Groq…).
- **Custom function tools.** Your `handler` runs in your process. The runtime
  pauses when the LLM calls the tool, you fulfill it locally over the same
  SSE stream.
- **Semantic memory.** Pass `memory: { namespace }` and the agent recalls
  relevant past interactions automatically (pgvector + OpenAI embeddings).
- **Persistent traces.** Every token, tool call, tool result, memory
  retrieval, and error is captured server-side as an ordered event log.

## API key

Get a `RELAY_API_KEY` by [self-hosting](https://github.com/KevinCorrea5103/relay#quick-start)
the open-source stack, or join the cloud beta (waitlist on GitHub).

## Docs

Full documentation lives in the repo:
https://github.com/KevinCorrea5103/relay

## License

Apache 2.0.
