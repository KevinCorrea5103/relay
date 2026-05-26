"""Agent presets for the demo. Each preset = a system prompt + a set of tools."""

from __future__ import annotations

import os
from dataclasses import dataclass

from relayhq import Agent, builtin, create_agent

from tools import (
    get_time,
    issue_refund,
    lookup_order,
    lookup_user,
    read_url,
    web_search,
)


@dataclass
class Preset:
    name: str
    description: str
    system: str
    tools: list


PRESETS: dict[str, Preset] = {
    "General assistant": Preset(
        name="General assistant",
        description="Math, time, web search and reading. A quick utility.",
        system=(
            "You are a precise, concise assistant. "
            "Use the calculator for arithmetic. "
            "Use get_time when the user asks about time or dates. "
            "Use web_search to find URLs about a topic, then read_url to fetch "
            "the most relevant result. Never invent URLs — always search first."
        ),
        tools=[builtin.calculator, get_time, web_search, read_url],
    ),
    "Customer support": Preset(
        name="Customer support",
        description="Looks up customers, orders, and can issue refunds.",
        system=(
            "You are a customer-support agent for an Acme SaaS. "
            "Use lookup_user and lookup_order to find records before answering. "
            "Only call issue_refund when the user explicitly asks for a refund and you have confirmed the order id. "
            "When refunding, ask for and pass a reason."
        ),
        tools=[lookup_user, lookup_order, issue_refund],
    ),
    "Research helper": Preset(
        name="Research helper",
        description="Searches the web, reads pages, and crunches numbers.",
        system=(
            "You are a research assistant. "
            "Workflow: (1) call web_search with a focused query to find sources, "
            "(2) pick the most authoritative-looking URL and call read_url to fetch it, "
            "(3) read more URLs if you need to cross-check. "
            "Use the calculator for any numbers. "
            "Never invent URLs — always search first. "
            "Cite the URLs you used in your final answer."
        ),
        tools=[web_search, read_url, builtin.calculator],
    ),
}


def build_agent(preset: Preset) -> Agent:
    return create_agent(
        api_key=os.environ["RELAY_API_KEY"],
        base_url=os.environ.get("RELAY_URL", "https://api.relaygh.dev"),
        model=os.environ.get("RELAY_MODEL", "gpt-4o-mini"),
        system=preset.system,
        tools=preset.tools,
    )
