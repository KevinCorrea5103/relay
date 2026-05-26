"""Graph — declarative multi-step workflows.

Lightweight orchestrator built on Agent + subagent + the run-linking
infrastructure. Pure SDK, no server changes — the server still sees the
resulting runs as a tree linked by workflow_id.
"""

from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional, Union

from .agent import Agent
from .types import AgentEvent


START = "__start__"
END = "__end__"

# Step function signature: (state, ctx) -> partial state (sync or async).
StepFn = Callable[
    [Dict[str, Any], "StepContext"], Union[Dict[str, Any], Awaitable[Dict[str, Any]]]
]

# Conditional: receives state, returns next step name or END.
ConditionalFn = Callable[[Dict[str, Any]], Union[str, Awaitable[str]]]


@dataclass
class StepContext:
    """Per-step context. workflow_id is empty before the first agent
    step has discovered it from the server's x-workflow-id header."""

    workflow_id: str
    step_name: str


@dataclass
class _Node:
    name: str
    fn: StepFn


@dataclass
class _StaticEdge:
    source: str
    target: str  # may be END


@dataclass
class _ConditionalEdge:
    source: str
    fn: ConditionalFn


@dataclass
class GraphRunResult:
    state: Dict[str, Any]
    path: List[str] = field(default_factory=list)
    workflow_id: Optional[str] = None


class Graph:
    """Declarative graph of steps. Wire steps with .step()/.agent(),
    connect them with .edge()/.conditional(), then .run() with an initial
    state.

    Example:

        researcher = create_agent(model="gpt-4o", tools=[web_search])
        writer = create_agent(model="claude-sonnet-4-6")

        graph = (
            Graph()
              .agent("research", researcher,
                     input_from="topic", output_to="research")
              .agent("write", writer,
                     input_from="research", output_to="draft")
              .edge("research", "write")
              .edge("write", END)
              .start("research")
        )
        result = await graph.run({"topic": "AI agents"})
    """

    def __init__(self) -> None:
        self._nodes: Dict[str, _Node] = {}
        self._edges: List[Union[_StaticEdge, _ConditionalEdge]] = []
        self._entry: Optional[str] = None

    def step(self, name: str, fn: StepFn) -> "Graph":
        if name in self._nodes:
            raise ValueError(f'graph: step "{name}" already defined')
        if name in (START, END):
            raise ValueError(f'graph: "{name}" is a reserved name')
        self._nodes[name] = _Node(name=name, fn=fn)
        return self

    def agent(
        self,
        name: str,
        agent: Agent,
        *,
        input_from: str = "input",
        output_to: Optional[str] = None,
    ) -> "Graph":
        """Wire an Agent as a step. Reads input from state[input_from]
        and writes the final text to state[output_to] (defaults to name)."""
        out_key = output_to or name

        async def _runner(state: Dict[str, Any], ctx: StepContext) -> Dict[str, Any]:
            prompt = state.get(input_from)
            if not isinstance(prompt, str) or not prompt:
                raise RuntimeError(
                    f'graph step "{name}": expected state["{input_from}"] to be a non-empty string'
                )
            events = agent.run(
                prompt,
                workflow_id=ctx.workflow_id or None,
            )
            output = await collect_final_output(events)
            return {out_key: output}

        return self.step(name, _runner)

    def edge(self, source: str, target: str) -> "Graph":
        self._assert_node(source)
        if target != END:
            self._assert_node(target)
        self._edges.append(_StaticEdge(source=source, target=target))
        return self

    def conditional(self, source: str, fn: ConditionalFn) -> "Graph":
        self._assert_node(source)
        if any(e.source == source for e in self._edges):
            raise ValueError(
                f'graph: step "{source}" already has an outgoing edge; remove it before adding a conditional'
            )
        self._edges.append(_ConditionalEdge(source=source, fn=fn))
        return self

    def start(self, name: str) -> "Graph":
        self._assert_node(name)
        self._entry = name
        return self

    async def run(
        self,
        initial: Dict[str, Any],
        *,
        max_steps: int = 30,
    ) -> GraphRunResult:
        if not self._nodes:
            raise RuntimeError("graph: no steps defined")
        entry = self._entry or next(iter(self._nodes.keys()))

        state = dict(initial)
        path: List[str] = []
        workflow_id: Optional[str] = None
        current: str = entry

        for _ in range(max(1, max_steps)):
            if current == END:
                return GraphRunResult(state=state, path=path, workflow_id=workflow_id)
            node = self._nodes[current]
            path.append(node.name)
            ctx = StepContext(
                workflow_id=workflow_id or "",
                step_name=node.name,
            )
            result = node.fn(state, ctx)
            if inspect.isawaitable(result):
                result = await result
            if isinstance(result, dict):
                state.update(result)
            nxt = await self._next_from(current, state)
            if nxt is None:
                raise RuntimeError(
                    f'graph: step "{current}" finished but has no outgoing edge'
                )
            current = nxt

        raise RuntimeError(
            f"graph: exceeded max_steps ({max_steps}); possible cycle"
        )

    async def _next_from(self, source: str, state: Dict[str, Any]) -> Optional[str]:
        for edge in self._edges:
            if edge.source != source:
                continue
            if isinstance(edge, _StaticEdge):
                return edge.target
            result = edge.fn(state)
            if inspect.isawaitable(result):
                result = await result
            return result
        return None

    def _assert_node(self, name: str) -> None:
        if name not in self._nodes:
            raise ValueError(f'graph: unknown step "{name}"')

    def describe(self) -> Dict[str, Any]:
        return {
            "entry": self._entry,
            "steps": list(self._nodes.keys()),
            "edges": [
                {"from": e.source, "kind": "static", "to": e.target}
                if isinstance(e, _StaticEdge)
                else {"from": e.source, "kind": "conditional"}
                for e in self._edges
            ],
        }


async def collect_final_output(events: Any) -> str:
    """Drain an Agent event stream into the final text output."""
    parts: List[str] = []
    final: Optional[str] = None
    async for ev in events:
        if ev.get("type") == "token":
            parts.append(ev.get("text", ""))
        elif ev.get("type") == "done":
            final = ev.get("output")
        elif ev.get("type") == "error":
            raise RuntimeError(f"agent step failed: {ev.get('message')}")
    return final if final is not None else "".join(parts)
