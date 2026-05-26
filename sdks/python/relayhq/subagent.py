"""subagent() — turn an Agent into a tool another Agent can call.

When the parent's LLM invokes the subagent, this handler runs
`child.run(input)` linked to the parent run via parent_run_id and
workflow_id. The whole tree shares one workflow_id so the dashboard can
render the call graph and aggregate cost.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .agent import Agent
from .tool import tool
from .types import FunctionTool


MAX_SUBAGENT_DEPTH = 5

_depth_by_workflow: Dict[str, int] = {}


def subagent(
    *,
    name: str,
    description: str,
    agent: Agent,
    input_schema: Optional[Dict[str, Any]] = None,
    max_depth: int = MAX_SUBAGENT_DEPTH,
) -> FunctionTool:
    """Wrap an Agent as a callable tool.

    Default input shape is `{"input": str}`; override `input_schema` if
    your sub-agent needs a structured prompt.

    Example:

        researcher = create_agent(model="gpt-4o", tools=[web_search])
        writer = create_agent(
            model="claude-sonnet-4-6",
            tools=[
                subagent(
                    name="research",
                    description="Research a topic",
                    agent=researcher,
                ),
            ],
        )
    """
    schema = input_schema or {
        "type": "object",
        "properties": {
            "input": {"type": "string", "description": "Prompt for the sub-agent"}
        },
        "required": ["input"],
        "additionalProperties": False,
    }

    async def handler(input: Any, ctx: Optional[Dict[str, Any]] = None) -> Any:
        prompt = _extract_prompt(input)
        if prompt is None:
            return {"error": "subagent expected { input: string }"}

        workflow_key = (ctx or {}).get("workflow_id") or (ctx or {}).get("run_id") or "anon"
        current = _depth_by_workflow.get(workflow_key, 0)
        if current >= max_depth:
            return {
                "error": f"subagent depth limit reached ({max_depth}); refusing to recurse"
            }
        _depth_by_workflow[workflow_key] = current + 1

        try:
            parts: list[str] = []
            usage = None
            last_error = None
            async for ev in agent.run(
                prompt,
                parent_run_id=(ctx or {}).get("run_id"),
                workflow_id=(ctx or {}).get("workflow_id") or (ctx or {}).get("run_id"),
            ):
                if ev.get("type") == "token":
                    parts.append(ev.get("text", ""))
                elif ev.get("type") == "done":
                    parts = [ev.get("output", "")]
                    usage = ev.get("usage")
                elif ev.get("type") == "error":
                    last_error = ev.get("message")
            if last_error and not parts:
                return {"error": last_error}
            return {"output": "".join(parts), "usage": usage}
        finally:
            after = _depth_by_workflow.get(workflow_key, 1) - 1
            if after <= 0:
                _depth_by_workflow.pop(workflow_key, None)
            else:
                _depth_by_workflow[workflow_key] = after

    return tool(
        name=name,
        description=description,
        input_schema=schema,
        handler=handler,
    )


def _extract_prompt(input: Any) -> Optional[str]:
    if isinstance(input, str):
        return input
    if isinstance(input, dict) and isinstance(input.get("input"), str):
        return input["input"]
    return None
