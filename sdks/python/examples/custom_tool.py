"""Custom function tool example. The `get_user` handler runs in this process.

Run:
    export RELAY_API_KEY=relay_live_...
    python examples/custom_tool.py
"""

import asyncio
import os
import sys

from relayhq import builtin, create_agent, tool


USERS = {
    "u_001": {"name": "Ada Lovelace", "tier": "pro", "balance_usd": 1480.50},
    "u_002": {"name": "Grace Hopper", "tier": "free", "balance_usd": 12.00},
    "u_003": {"name": "Alan Turing", "tier": "enterprise", "balance_usd": 9320.75},
}


async def get_user_handler(input):
    user = USERS.get(input["id"])
    if not user:
        return {"error": f"no user with id {input['id']}"}
    return {"id": input["id"], **user}


get_user = tool(
    name="get_user",
    description="Look up a user by id. Returns name, tier, and current balance in USD.",
    input_schema={
        "type": "object",
        "properties": {"id": {"type": "string", "description": "user id, e.g. u_001"}},
        "required": ["id"],
        "additionalProperties": False,
    },
    handler=get_user_handler,
)


async def main(prompt: str) -> None:
    agent = create_agent(
        model=os.environ.get("RELAY_MODEL", "gpt-4o-mini"),
        base_url=os.environ.get("RELAY_URL", "https://api.relaygh.dev"),
        system=(
            "You are a precise assistant. Use the calculator for arithmetic and "
            "get_user to look up user info. Be concise."
        ),
        tools=[builtin.calculator, get_user],
    )

    print(f"> {prompt}\n")

    async for event in agent.run(prompt):
        t = event["type"]
        if t == "token":
            sys.stdout.write(event["text"])  # type: ignore[arg-type]
            sys.stdout.flush()
        elif t == "tool_call":
            print(f"\n→ {event['name']}({event.get('input')})", flush=True)
        elif t == "tool_result":
            print(f"  ← {event.get('output')}", flush=True)
        elif t == "done":
            print(f"\n\n[done] usage={event.get('usage')}")
        elif t == "error":
            print(f"\n[error] {event.get('message')}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(
        main(
            " ".join(sys.argv[1:])
            or "Look up u_001 and u_003. What's the combined balance, "
               "and how much would 7% tax on it be?"
        )
    )
