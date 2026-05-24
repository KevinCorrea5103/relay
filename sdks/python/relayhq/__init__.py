"""Relay Python SDK.

The backend cloud for reliable AI agents.

Quickstart:

    from relayhq import create_agent, builtin

    agent = create_agent(
        model="gpt-4o-mini",
        base_url="https://api.relaygh.dev",
        tools=[builtin.calculator],
    )

    async def main():
        async for event in agent.run("What is 23 * 47?"):
            if event["type"] == "token":
                print(event["text"], end="", flush=True)

    import asyncio; asyncio.run(main())
"""

from .agent import Agent, create_agent
from .builtin import builtin
from .client import RelayError
from .tool import tool

__all__ = [
    "Agent",
    "create_agent",
    "tool",
    "builtin",
    "RelayError",
]

__version__ = "0.1.0"
