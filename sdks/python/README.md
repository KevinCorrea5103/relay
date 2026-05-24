# relayhq

Python SDK for [Relay](https://relaygh.dev) — the backend cloud for reliable AI agents.

```bash
pip install relayhq
```

```python
import asyncio
from relayhq import create_agent, builtin, tool

async def get_user_handler(input):
    return await db.users.find(input["id"])  # runs in your process

get_user = tool(
    name="get_user",
    description="Look up a user by id",
    input_schema={
        "type": "object",
        "properties": {"id": {"type": "string"}},
        "required": ["id"],
    },
    handler=get_user_handler,
)

agent = create_agent(
    api_key="relay_live_...",                   # from relaygh.dev/en/signup
    base_url="https://api.relaygh.dev",
    model="gpt-4o-mini",
    memory={"namespace": f"user:{user_id}"},
    tools=[builtin.calculator, get_user],
)

async def main():
    async for event in agent.run("Look up u_001 and tell me their tier"):
        if event["type"] == "token":
            print(event["text"], end="", flush=True)

asyncio.run(main())
```

## What you get

- **Multi-provider routing** — Anthropic, OpenAI, any OpenAI-compatible endpoint (Ollama, vLLM, Groq, Together, OpenRouter). Pick with the `model` string.
- **Custom function tools** — your handler runs in your process. The SDK ships the schema; the runtime pauses; you fulfill locally over the same stream.
- **Semantic memory** — `memory={"namespace": ...}` and the agent recalls relevant past turns automatically (pgvector under the hood).
- **Persistent execution traces** — every token, tool call, tool result, and error captured server-side. Replay from the dashboard.

## Event stream

`agent.run(input)` returns an `AsyncIterator[dict]`. Events:

```python
{"type": "token",       "text": "..."}
{"type": "tool_call",   "id": "...", "name": "...", "input": ...}
{"type": "tool_result", "id": "...", "output": ...}
{"type": "done",        "output": "...", "usage": {"input_tokens": ..., "output_tokens": ...}}
{"type": "error",       "message": "..."}
```

A `tool_call` for a custom tool is followed by its `tool_result` after your handler runs and the POST completes. Order is guaranteed.

## Get a key

Free during beta, no credit card. Sign up at https://relaygh.dev/en/signup with your email and an OpenAI/Anthropic key — you get back a `relay_live_…` key.

Or self-host the whole stack: https://github.com/KevinCorrea5103/relay

## License

Apache 2.0.
