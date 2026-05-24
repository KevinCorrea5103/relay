"""Type definitions for Relay events and config.

Events are returned as plain dicts that match these TypedDicts on the wire.
We don't enforce them at runtime to keep the SDK dependency-light.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, List, Optional, TypedDict, Union


# ─── Tools ─────────────────────────────────────────────────────────────────

class BuiltinTool(TypedDict):
    kind: str  # "builtin"
    name: str


class FunctionTool(TypedDict):
    kind: str  # "function"
    name: str
    description: str
    inputSchema: Dict[str, Any]
    # handler is attached separately on the Python side (not on the wire)
    handler: Callable[[Dict[str, Any]], Union[Any, Awaitable[Any]]]


Tool = Union[BuiltinTool, FunctionTool]


# ─── Memory ────────────────────────────────────────────────────────────────

class MemoryConfig(TypedDict, total=False):
    namespace: str


# ─── Events ────────────────────────────────────────────────────────────────

class TokenEvent(TypedDict):
    type: str  # "token"
    text: str


class ToolCallEvent(TypedDict):
    type: str  # "tool_call"
    id: str
    name: str
    input: Any


class ToolResultEvent(TypedDict):
    type: str  # "tool_result"
    id: str
    output: Any


class Usage(TypedDict):
    input_tokens: int
    output_tokens: int


class DoneEvent(TypedDict, total=False):
    type: str  # "done"
    output: str
    usage: Usage


class ErrorEvent(TypedDict):
    type: str  # "error"
    message: str


AgentEvent = Union[TokenEvent, ToolCallEvent, ToolResultEvent, DoneEvent, ErrorEvent]


# ─── Run request (internal wire shape) ─────────────────────────────────────

class WireBuiltinTool(TypedDict):
    name: str
    kind: str  # "builtin"


class WireFunctionTool(TypedDict):
    name: str
    kind: str  # "function"
    description: str
    inputSchema: Dict[str, Any]


WireTool = Union[WireBuiltinTool, WireFunctionTool]


class RunRequest(TypedDict, total=False):
    model: str
    system: Optional[str]
    input: str
    tools: List[WireTool]
    memory: Union[bool, MemoryConfig]
