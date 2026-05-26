"""Minimal JSON Schema validator for tool inputs.

We do a small subset in pure Python rather than pulling jsonschema into
every install. Covers the cases LLMs actually get wrong: missing required
fields, wrong types, extra properties when additionalProperties=False,
basic enum checks.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def validate_against_schema(value: Any, schema: Dict[str, Any]) -> Optional[str]:
    """Return None if `value` matches `schema`, else a short error string."""
    t = schema.get("type")

    if t == "object":
        if not isinstance(value, dict):
            return f"expected object, got {_type_of(value)}"
        props: Dict[str, Dict[str, Any]] = schema.get("properties", {})
        required: List[str] = schema.get("required", [])
        for key in required:
            if key not in value:
                return f'missing required field "{key}"'
        if schema.get("additionalProperties") is False:
            for key in value.keys():
                if key not in props:
                    return f'unexpected field "{key}"'
        for key, sub in props.items():
            if key in value:
                err = validate_against_schema(value[key], sub)
                if err is not None:
                    return f'field "{key}": {err}'
        return None

    if t == "array":
        if not isinstance(value, list):
            return f"expected array, got {_type_of(value)}"
        items = schema.get("items")
        if isinstance(items, dict):
            for i, item in enumerate(value):
                err = validate_against_schema(item, items)
                if err is not None:
                    return f"item {i}: {err}"
        return None

    if t == "string":
        if not isinstance(value, str):
            return f"expected string, got {_type_of(value)}"
        enum = schema.get("enum")
        if isinstance(enum, list) and value not in enum:
            return f"expected one of {enum!r}, got {value!r}"
        return None

    if t in ("number", "integer"):
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return f"expected number, got {_type_of(value)}"
        if t == "integer" and not isinstance(value, int):
            return f"expected integer, got {value!r}"
        return None

    if t == "boolean":
        if not isinstance(value, bool):
            return f"expected boolean, got {_type_of(value)}"
        return None

    return None


def _type_of(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return type(v).__name__
