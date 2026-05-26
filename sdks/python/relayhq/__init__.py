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
from .graph import END, START, Graph, GraphRunResult, StepContext, collect_final_output
from .orchestrator import create_orchestrator, describe_team
from .schema import validate_against_schema
from .subagent import subagent
from .tool import tool
from .voice import synthesize, transcribe

__all__ = [
    "Agent",
    "create_agent",
    "tool",
    "subagent",
    "create_orchestrator",
    "describe_team",
    "builtin",
    "RelayError",
    "validate_against_schema",
    "transcribe",
    "synthesize",
    "Graph",
    "GraphRunResult",
    "StepContext",
    "collect_final_output",
    "START",
    "END",
]

__version__ = "0.2.0"
