# Relay · Streamlit agents demo

A Streamlit chat UI that demos the [`relayhq`](https://pypi.org/project/relayhq/)
Python SDK with three different agent presets and six tools.

Designed to be **the fastest way to feel what Relay does** — clone, paste an
API key, see streaming + tool calls in your browser in under a minute.

## What you get

- **3 agent presets** (system prompt + tool set)
  - **General assistant** — calculator, time, web search + reading
  - **Customer support** — looks up users, orders, can issue refunds
  - **Research helper** — searches the web, reads pages, crunches numbers
- **7 tools**, all running locally in your Python process (Relay just
  orchestrates) — no third-party API keys needed
- **Live trace** — tool calls and results render inline in the chat as they
  happen

## Run it

You need Python 3.10+ and a Relay API key.

```bash
# 1) Get a free Relay key at https://relaygh.dev/en/signup
# 2) Clone and set up:
git clone https://github.com/KevinCorrea5103/relay
cd relay/examples/streamlit-demo

python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# edit .env and paste your RELAY_API_KEY

streamlit run app.py
```

Open the URL Streamlit prints (usually `http://localhost:8501`).

## What to try

**General assistant:**

> What's the current time in Tokyo and Buenos Aires? What's the difference in hours?
>
> Read https://relaygh.dev and summarize what Relay is.

**Customer support:**

> Look up user u_001 and tell me their tier and email.
>
> Refund order o_1003 because the customer reported a duplicate charge.

**Research helper:**

> Fetch https://en.wikipedia.org/wiki/Postgres and tell me what year it was first released.

## How it works

```python
# tools.py — your Python function, your process
async def _read_url_handler(input):
    async with httpx.AsyncClient() as c:
        r = await c.get(input["url"])
        return {"text": r.text[:5000]}

read_url = tool(
    name="read_url",
    description="Fetch a web URL and return plain text.",
    input_schema={...},
    handler=_read_url_handler,
)

# agents.py — declarative agent spec
agent = create_agent(
    api_key=os.environ["RELAY_API_KEY"],
    base_url="https://api.relaygh.dev",
    model="gpt-4o-mini",
    system="You are a research assistant...",
    tools=[read_url, builtin.calculator],
)

# app.py — Streamlit consumes the async iterator
async for event in agent.run(prompt):
    if event["type"] == "token":
        ...
```

When the LLM decides to call `read_url`, Relay pauses the conversation,
calls back to your SDK, runs your handler **in your process** (so your
business logic and secrets stay with you), gets the result, and continues.

See the full doc at [relaygh.dev/en/docs](https://relaygh.dev/en/docs).

## Project layout

```
streamlit-demo/
├── requirements.txt   # deps: relayhq, streamlit, httpx
├── .env.example
├── app.py              # Streamlit chat UI
├── agents.py           # 3 preset configs
├── tools.py            # 6 tool definitions
└── bridge.py           # async iterator → sync generator (for Streamlit)
```

## License

Apache 2.0. Built on top of [Relay](https://github.com/KevinCorrea5103/relay).
