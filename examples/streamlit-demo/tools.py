"""Tools the demo agents can call.

Everything runs locally in this process — Relay just orchestrates which
tool the LLM asks for and ships the result back. No external API keys
needed; we use a mock CRM/order DB so the demo works out of the box.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from relayhq import tool

# ─── Mock data ─────────────────────────────────────────────────────────────

USERS = {
    "u_001": {"name": "Ada Lovelace", "tier": "pro", "email": "ada@example.com"},
    "u_002": {"name": "Grace Hopper", "tier": "free", "email": "grace@example.com"},
    "u_003": {"name": "Alan Turing", "tier": "enterprise", "email": "alan@example.com"},
}

ORDERS = {
    "o_1001": {
        "user_id": "u_001",
        "items": ["Pro plan / annual"],
        "total_usd": 480.00,
        "status": "paid",
    },
    "o_1002": {
        "user_id": "u_002",
        "items": ["Sticker pack"],
        "total_usd": 12.00,
        "status": "refunded",
    },
    "o_1003": {
        "user_id": "u_003",
        "items": ["Enterprise plan / annual"],
        "total_usd": 9320.75,
        "status": "paid",
    },
}

REFUND_LOG: list[dict] = []


# ─── Tools ─────────────────────────────────────────────────────────────────

async def _get_time_handler(input: dict) -> dict:
    tz = input.get("timezone") or "UTC"
    try:
        now = datetime.now(ZoneInfo(tz))
    except Exception:
        return {"error": f"unknown timezone {tz!r}"}
    return {
        "timezone": tz,
        "iso": now.isoformat(timespec="seconds"),
        "human": now.strftime("%A, %B %d %Y · %H:%M:%S %Z"),
    }


get_time = tool(
    name="get_time",
    description="Return the current date/time in a given IANA timezone (e.g. 'America/Argentina/Buenos_Aires', 'Europe/Madrid', 'UTC').",
    input_schema={
        "type": "object",
        "properties": {
            "timezone": {
                "type": "string",
                "description": "IANA timezone name. Defaults to UTC.",
            }
        },
        "additionalProperties": False,
    },
    handler=_get_time_handler,
)


async def _read_url_handler(input: dict) -> dict:
    url = input["url"]
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(
                url,
                headers={"user-agent": "relay-demo/0.1 (+https://relaygh.dev)"},
            )
            if r.status_code >= 400:
                return {"error": f"HTTP {r.status_code}"}
            text = r.text
            # Strip script/style tags lightly to reduce noise
            if "<" in text:
                import re

                text = re.sub(
                    r"<(script|style)\b[^>]*>.*?</\1>",
                    " ",
                    text,
                    flags=re.IGNORECASE | re.DOTALL,
                )
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"\s+", " ", text).strip()
            return {
                "url": str(r.url),
                "content_type": r.headers.get("content-type", ""),
                "length": len(text),
                "text": text[:5000],
            }
    except Exception as err:
        return {"error": str(err)}


read_url = tool(
    name="read_url",
    description="Fetch a web URL and return up to ~5000 characters of plain text. Use when the user wants you to read a page they referenced.",
    input_schema={
        "type": "object",
        "properties": {
            "url": {"type": "string", "format": "uri"},
        },
        "required": ["url"],
        "additionalProperties": False,
    },
    handler=_read_url_handler,
)


def _lookup_user_handler(input: dict) -> dict:
    user_id = input["id"]
    user = USERS.get(user_id)
    if not user:
        return {"error": f"no user with id {user_id!r}"}
    return {"id": user_id, **user}


lookup_user = tool(
    name="lookup_user",
    description="Find a customer by id. Returns name, email, and account tier.",
    input_schema={
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "user id like u_001"},
        },
        "required": ["id"],
        "additionalProperties": False,
    },
    handler=_lookup_user_handler,
)


def _lookup_order_handler(input: dict) -> dict:
    order_id = input["id"]
    order = ORDERS.get(order_id)
    if not order:
        return {"error": f"no order with id {order_id!r}"}
    return {"id": order_id, **order}


lookup_order = tool(
    name="lookup_order",
    description="Find an order by id. Returns the user it belongs to, items, total, and status.",
    input_schema={
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "order id like o_1001"},
        },
        "required": ["id"],
        "additionalProperties": False,
    },
    handler=_lookup_order_handler,
)


def _issue_refund_handler(input: dict) -> dict:
    order_id = input["order_id"]
    reason = input.get("reason", "no reason provided")
    order = ORDERS.get(order_id)
    if not order:
        return {"error": f"no order with id {order_id!r}"}
    if order["status"] == "refunded":
        return {"error": "order is already refunded"}
    order["status"] = "refunded"
    REFUND_LOG.append({"order_id": order_id, "reason": reason})
    return {
        "ok": True,
        "order_id": order_id,
        "refunded_usd": order["total_usd"],
        "reason": reason,
    }


issue_refund = tool(
    name="issue_refund",
    description="Refund a customer order. Marks the order as refunded and logs the reason.",
    input_schema={
        "type": "object",
        "properties": {
            "order_id": {"type": "string"},
            "reason": {"type": "string"},
        },
        "required": ["order_id", "reason"],
        "additionalProperties": False,
    },
    handler=_issue_refund_handler,
)
