"""Minimal hello-world. Streams tokens from gpt-4o-mini via the Relay cloud.

Run:
    export RELAY_API_KEY=relay_live_...
    python examples/hello_agent.py
"""

import asyncio
import os
import sys

from relayhq import create_agent


async def main(prompt: str) -> None:
    agent = create_agent(
        model=os.environ.get("RELAY_MODEL", "gpt-4o-mini"),
        base_url=os.environ.get("RELAY_URL", "https://api.relaygh.dev"),
        system="You are a concise assistant. Reply in one sentence.",
    )

    print(f"[model={agent._model}] > {prompt}\n")  # noqa: SLF001 — demo

    async for event in agent.run(prompt):
        t = event["type"]
        if t == "token":
            sys.stdout.write(event["text"])  # type: ignore[arg-type]
            sys.stdout.flush()
        elif t == "done":
            print(f"\n\n[done] usage={event.get('usage')}")
        elif t == "error":
            print(f"\n[error] {event.get('message')}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(
        main(" ".join(sys.argv[1:]) or "Say hi in three different languages.")
    )
