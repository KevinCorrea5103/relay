"""Helper for declaring custom function tools."""

from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Union

from .types import FunctionTool


def tool(
    *,
    name: str,
    description: str,
    input_schema: Dict[str, Any],
    handler: Callable[[Dict[str, Any]], Union[Any, Awaitable[Any]]],
) -> FunctionTool:
    """Declare a custom function tool the agent can call.

    The handler runs in your process when the model invokes the tool.
    It may be sync or async. Return value is JSON-serialized and sent back
    to the model as the tool result.

    Example:

        async def get_user_handler(input):
            return await db.users.find(input["id"])

        get_user = tool(
            name="get_user",
            description="Look up a user by id",
            input_schema={
                "type": "object",
                "properties": {"id": {"type": "string"}},
                "required": ["id"],
            },
            handler=get_user_handler,
        )
    """
    return {  # type: ignore[return-value]
        "kind": "function",
        "name": name,
        "description": description,
        "inputSchema": input_schema,
        "handler": handler,
    }
