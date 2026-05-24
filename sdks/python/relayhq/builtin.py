"""Built-in tools the runtime executes server-side.

No SDK round-trip — these run in the Go runtime directly.
"""

from __future__ import annotations

from typing import Final

from .types import BuiltinTool


class _Builtin:
    """Registry of server-side built-in tools.

    Access via the `builtin` singleton, e.g.:

        from relayhq import builtin
        tools = [builtin.calculator]
    """

    calculator: Final[BuiltinTool] = {"kind": "builtin", "name": "calculator"}


builtin = _Builtin()
