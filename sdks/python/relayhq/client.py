"""HTTP + SSE client for the Relay control plane.

Pure async via httpx. One request per agent.run() — SSE stream stays open
until the model is done or errors.
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator, Dict, Optional, Tuple

import httpx

from .types import AgentEvent, RunRequest


class RelayError(Exception):
    """Raised when Relay's API returns a non-2xx response."""

    def __init__(self, status: int, message: str):
        super().__init__(f"relay {status}: {message}")
        self.status = status


async def start_run(
    *,
    base_url: str,
    api_key: str,
    body: RunRequest,
    timeout: float = 600.0,
) -> Tuple[str, httpx.Response]:
    """Open an SSE stream for an agent run.

    Returns (run_id, response). Caller must close the response (use
    `async with response:` or call `await response.aclose()`).
    """
    client = httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=10.0))
    response = await client.send(
        client.build_request(
            "POST",
            f"{base_url}/v1/runs",
            headers={
                "content-type": "application/json",
                "accept": "text/event-stream",
                "authorization": f"Bearer {api_key}",
            },
            json=body,
        ),
        stream=True,
    )
    if response.status_code >= 400:
        text = await response.aread()
        await response.aclose()
        await client.aclose()
        raise RelayError(response.status_code, text.decode("utf-8", errors="replace"))

    run_id = response.headers.get("x-run-id")
    if not run_id:
        await response.aclose()
        await client.aclose()
        raise RelayError(500, "response missing x-run-id header")

    # Attach the client to the response so we can close both later.
    setattr(response, "_relay_client", client)
    return run_id, response


async def iter_events(response: httpx.Response) -> AsyncIterator[AgentEvent]:
    """Parse SSE frames from a streaming response and yield each event.

    Stops when the upstream closes the stream.
    """
    try:
        buffer = ""
        async for chunk in response.aiter_text():
            buffer += chunk
            while "\n\n" in buffer:
                frame, _, buffer = buffer.partition("\n\n")
                data_line = next(
                    (l for l in frame.split("\n") if l.startswith("data:")), None
                )
                if not data_line:
                    continue
                payload = data_line[5:].strip()
                if not payload:
                    continue
                try:
                    yield json.loads(payload)
                except json.JSONDecodeError as err:
                    yield {"type": "error", "message": f"bad frame: {err}"}
    finally:
        await response.aclose()
        client = getattr(response, "_relay_client", None)
        if client is not None:
            await client.aclose()


async def post_tool_result(
    *,
    base_url: str,
    api_key: str,
    run_id: str,
    tool_use_id: str,
    output: Any,
    timeout: float = 30.0,
) -> None:
    """POST a custom tool's output back to the control plane, unblocking the run."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(
            f"{base_url}/v1/runs/{run_id}/tool-results/{tool_use_id}",
            headers={
                "content-type": "application/json",
                "authorization": f"Bearer {api_key}",
            },
            json={"output": output},
        )
        if r.status_code >= 400:
            raise RelayError(r.status_code, r.text)
