"""Bridge an async iterator into a sync generator.

Streamlit runs synchronously; the Relay SDK is async-native. This helper
spins up a dedicated event loop in a background thread, drives the async
iterator there, and forwards each item through a queue.
"""

from __future__ import annotations

import asyncio
import threading
from queue import Queue
from typing import AsyncIterator, Callable, Iterator, TypeVar

T = TypeVar("T")
_SENTINEL = object()


def async_to_sync_iter(
    factory: Callable[[], AsyncIterator[T]],
) -> Iterator[T]:
    """Run an async iterator in a thread, yield items as they arrive."""
    queue: Queue = Queue()

    def runner() -> None:
        async def main() -> None:
            try:
                async for item in factory():
                    queue.put(item)
            except Exception as err:  # noqa: BLE001
                queue.put(err)
            finally:
                queue.put(_SENTINEL)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(main())
        finally:
            loop.close()

    threading.Thread(target=runner, daemon=True).start()

    while True:
        item = queue.get()
        if item is _SENTINEL:
            break
        if isinstance(item, Exception):
            raise item
        yield item
