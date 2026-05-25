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
        description="Math, time, web reading. Useful as a quick utility.",
        system=(
            "You are a precise, concise assistant. "
            "Use the calculator for any arithmetic. "
            "Use get_time when the user asks about time or dates. "
            "Use read_url to fetch any URL the user shares."
        ),
        tools=[builtin.calculator, get_time, read_url],
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
        description="Reads URLs, summarizes, and crunches numbers.",
        system=(
            "You are a research assistant. "
            "When the user gives you a URL, fetch it with read_url and summarize. "
            "Use the calculator for any numbers. "
            "Be concise and cite the URL when relevant."
        ),
        tools=[read_url, builtin.calculator],
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
