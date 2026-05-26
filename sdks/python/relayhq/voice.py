"""Voice helpers — wrappers around POST /v1/transcribe and /v1/synthesize."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Union

import httpx


_DEFAULT_BASE_URL = "http://localhost:4000"

AudioInput = Union[bytes, Path, "os.PathLike[str]"]


def _resolve_creds(
    api_key: Optional[str],
    base_url: Optional[str],
) -> Tuple[str, str]:
    resolved_key = api_key or os.environ.get("RELAY_API_KEY")
    if not resolved_key:
        raise ValueError(
            "api_key is required. Pass `api_key=` or set RELAY_API_KEY in env."
        )
    resolved_base = base_url or os.environ.get("RELAY_URL") or _DEFAULT_BASE_URL
    return resolved_key, resolved_base


async def transcribe(
    *,
    file: AudioInput,
    model: str = "whisper-1",
    language: Optional[str] = None,
    response_format: str = "json",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Transcribe audio via Whisper. Returns {"text": str, "raw": Any}.

    `file` can be raw bytes or a path. Use bytes when streaming from
    memory; pass a Path to upload from disk.
    """
    key, url = _resolve_creds(api_key, base_url)

    if isinstance(file, (str, Path)):
        path = Path(file)
        with path.open("rb") as f:
            audio_bytes = f.read()
        filename = path.name
    else:
        audio_bytes = file
        filename = "audio"

    files = {"file": (filename, audio_bytes, "application/octet-stream")}
    data: Dict[str, str] = {"model": model, "response_format": response_format}
    if language:
        data["language"] = language

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        r = await client.post(
            f"{url}/v1/transcribe",
            headers={"authorization": f"Bearer {key}"},
            files=files,
            data=data,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"relay transcribe failed ({r.status_code}): {r.text}")
        if r.headers.get("content-type", "").startswith("application/json"):
            j = r.json()
            return {"text": j.get("text", ""), "raw": j}
        return {"text": r.text, "raw": r.text}


async def synthesize(
    *,
    input: str,
    model: str = "tts-1",
    voice: str = "alloy",
    format: str = "mp3",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Tuple[bytes, str]:
    """Synthesize speech via OpenAI TTS. Returns (audio_bytes, mime_type).

    To save to disk:
        audio, mime = await synthesize(input="hello world")
        Path("hello.mp3").write_bytes(audio)
    """
    key, url = _resolve_creds(api_key, base_url)

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        r = await client.post(
            f"{url}/v1/synthesize",
            headers={
                "authorization": f"Bearer {key}",
                "content-type": "application/json",
            },
            json={
                "input": input,
                "model": model,
                "voice": voice,
                "format": format,
            },
        )
        if r.status_code >= 400:
            raise RuntimeError(f"relay synthesize failed ({r.status_code}): {r.text}")
        return r.content, r.headers.get("content-type", "audio/mpeg")
