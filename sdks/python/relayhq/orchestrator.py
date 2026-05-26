"""create_orchestrator() — supervisor pattern over a team of agents.

One LLM coordinates a team of specialist agents. The supervisor sees each
agent as a tool it can call, picks who to delegate to based on the request,
and stitches the results back together.

Under the hood, this is just create_agent() with each teammate wrapped in
subagent(). The win is the auto-generated system prompt so the LLM knows
what each teammate is good at without you writing the role descriptions
by hand.

For strict pipelines (sequential / parallel / cycles), use the `Graph`
primitive directly — Orchestrator is specifically for "supervisor decides
who to call" cases.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from .agent import Agent, create_agent
from .subagent import subagent
from .types import MemoryConfig, Tool


def create_orchestrator(
    *,
    model: str,
    agents: Dict[str, Dict[str, Any]],
    system: Optional[str] = None,
    extra_tools: Optional[List[Tool]] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    memory: Optional[Union[bool, MemoryConfig]] = None,
) -> Agent:
    """Build a supervisor agent that coordinates a team.

    `agents` is a mapping of name → spec dict. Each spec must include:
      - "agent": the Agent instance to delegate to
      - "description": one-sentence specialty (goes into the system prompt)
      - "input_schema" (optional): override the JSON Schema for the call

    Example:

        researcher = create_agent(model="gpt-4o")
        writer     = create_agent(model="claude-sonnet-4-6")
        reviewer   = create_agent(model="claude-haiku-4-5")

        team = create_orchestrator(
            model="claude-sonnet-4-6",  # the supervisor's brain
            agents={
                "research": {
                    "agent": researcher,
                    "description": "Researches topics and returns key facts.",
                },
                "write": {
                    "agent": writer,
                    "description": "Writes drafts from research notes.",
                },
                "review": {
                    "agent": reviewer,
                    "description": "Reviews drafts; returns approval or feedback.",
                },
            },
        )

        async for event in team.run("Write a 200-word post about pgvector"):
            ...
    """
    names = list(agents.keys())
    if not names:
        raise ValueError("create_orchestrator: at least one agent in `agents` required")

    team_description = "\n".join(
        f"  - {name}: {agents[name]['description']}" for name in names
    )

    auto_system = (
        "You coordinate a team of specialist agents. Decide which teammate is "
        "best suited for each part of the user's request, call them as tools, "
        "and synthesize their outputs into a final response.\n\n"
        "Available teammates:\n"
        f"{team_description}\n\n"
        "Guidelines:\n"
        "  - Call only the teammates you need; don't fan out to everyone by default.\n"
        "  - Pass each teammate a focused, specific prompt — not the whole user query verbatim.\n"
        "  - When a teammate's output is sufficient, return it (with any required reformatting). "
        "Don't call another teammate just to paraphrase.\n"
        "  - If teammates disagree, surface the disagreement to the user; don't pick a side silently."
    )

    final_system = f"{auto_system}\n\n{system}" if system else auto_system

    team_tools: List[Tool] = [
        subagent(
            name=name,
            description=agents[name]["description"],
            agent=agents[name]["agent"],
            input_schema=agents[name].get("input_schema"),
        )
        for name in names
    ]

    return create_agent(
        model=model,
        system=final_system,
        tools=team_tools + list(extra_tools or []),
        api_key=api_key,
        base_url=base_url,
        memory=memory,
    )


def describe_team(agents: Dict[str, Dict[str, Any]]) -> str:
    """Return the team description string used by the auto-generated
    supervisor system prompt. Useful for inspecting / customizing."""
    return "\n".join(
        f"{name}: {spec['description']}" for name, spec in agents.items()
    )
