"""Public Agent API. Mirrors the @relayhq/sdk surface in Python."""

from __future__ import annotations

import asyncio
import inspect
import os
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Optional, Union

from .client import iter_events, post_tool_result, start_run
from .types import AgentEvent, MemoryConfig, RunRequest, Tool, WireTool


_DEFAULT_BASE_URL = "http://localhost:4000"


class Agent:
    """An agent you can run. Returned by `create_agent(...)`.

    The handlers for custom tools are kept in this object and dispatched
    in the background whenever the runtime emits a matching tool_call event.
    """

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        system: Optional[str],
        wire_tools: List[WireTool],
        handlers: Dict[str, Callable[[Dict[str, Any]], Union[Any, Awaitable[Any]]]],
        memory: Optional[Union[bool, MemoryConfig]],
    ):
        self._base_url = base_url
        self._api_key = api_key
        self._model = model
        self._system = system
        self._wire_tools = wire_tools
        self._handlers = handlers
        self._memory = memory

    async def run(self, input: str) -> AsyncIterator[AgentEvent]:
        """Start an agent run and yield events as they arrive.

        Custom function tools fire in the background — your handler runs,
        the result is POSTed to the control plane, and the agent loop
        continues without blocking the iterator.

        Example:

            async for event in agent.run("Hello"):
                if event["type"] == "token":
                    print(event["text"], end="", flush=True)
        """
        body: RunRequest = {
            "model": self._model,
            "input": input,
            "tools": self._wire_tools,
        }
        if self._system is not None:
            body["system"] = self._system
        if self._memory is not None:
            body["memory"] = self._memory

        run_id, response = await start_run(
            base_url=self._base_url, api_key=self._api_key, body=body
        )

        in_flight: List[asyncio.Task[None]] = []
        try:
            async for event in iter_events(response):
                if event.get("type") == "tool_call":
                    name = event.get("name", "")
                    handler = self._handlers.get(name)
                    if handler is not None:
                        task = asyncio.create_task(
                            self._execute_and_report(
                                run_id=run_id,
                                tool_use_id=event["id"],  # type: ignore[index]
                                input=event.get("input"),
                                handler=handler,
                            )
                        )
                        in_flight.append(task)
                yield event
        finally:
            if in_flight:
                await asyncio.gather(*in_flight, return_exceptions=True)

    async def _execute_and_report(
        self,
        *,
        run_id: str,
        tool_use_id: str,
        input: Any,
        handler: Callable[[Dict[str, Any]], Union[Any, Awaitable[Any]]],
    ) -> None:
        try:
            result = handler(input)
            if inspect.isawaitable(result):
                result = await result
        except Exception as err:  # noqa: BLE001 — surface as tool error to the model
            result = f"error: {err}"
        try:
            await post_tool_result(
                base_url=self._base_url,
                api_key=self._api_key,
                run_id=run_id,
                tool_use_id=tool_use_id,
                output=result,
            )
        except Exception as err:  # noqa: BLE001
            # Best-effort: log and let the runtime time out the long-poll
            # if we can't deliver the result.
            print(f"[relayhq] tool result post failed (tool={tool_use_id}): {err}")


def create_agent(
    *,
    model: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    system: Optional[str] = None,
    tools: Optional[List[Tool]] = None,
    memory: Optional[Union[bool, MemoryConfig]] = None,
) -> Agent:
    """Construct an Agent.

    `api_key` falls back to the RELAY_API_KEY env var.
    `base_url` falls back to RELAY_URL, then `http://localhost:4000`.

    Example:

        from relayhq import create_agent, builtin

        agent = create_agent(
            model="claude-sonnet-4-6",
            api_key=os.environ["RELAY_API_KEY"],
            base_url="https://api.relaygh.dev",
            tools=[builtin.calculator],
        )
    """
    resolved_api_key = api_key or os.environ.get("RELAY_API_KEY")
    if not resolved_api_key:
        raise ValueError(
            "api_key is required. Pass `api_key=` or set RELAY_API_KEY in env. "
            "Get one at https://relaygh.dev/en/signup"
        )
    resolved_base_url = (
        base_url or os.environ.get("RELAY_URL") or _DEFAULT_BASE_URL
    )

    handlers: Dict[str, Callable[[Dict[str, Any]], Union[Any, Awaitable[Any]]]] = {}
    wire_tools: List[WireTool] = []
    for t in tools or []:
        if t["kind"] == "builtin":
            wire_tools.append({"name": t["name"], "kind": "builtin"})  # type: ignore[typeddict-item]
        else:
            wire_tools.append(
                {
                    "name": t["name"],
                    "kind": "function",
                    "description": t["description"],  # type: ignore[typeddict-item]
                    "inputSchema": t["inputSchema"],  # type: ignore[typeddict-item]
                }
            )
            handlers[t["name"]] = t["handler"]  # type: ignore[typeddict-item]

    return Agent(
        base_url=resolved_base_url,
        api_key=resolved_api_key,
        model=model,
        system=system,
        wire_tools=wire_tools,
        handlers=handlers,
        memory=memory,
    )
