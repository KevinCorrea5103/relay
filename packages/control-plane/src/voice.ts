// ─── Voice (STT + TTS) ─────────────────────────────────────────────────────
//
// Pattern A — pre/post processing, not streaming yet.
//
//   POST /v1/transcribe   multipart upload → text          (OpenAI Whisper)
//   POST /v1/synthesize   text → audio/mpeg stream         (OpenAI tts-1)
//
// Both use the tenant's existing OpenAI provider credential (BYOK). The
// audio bytes themselves never touch our DB — the request just relays to
// OpenAI and streams the response back. That keeps the control plane
// stateless on the voice path.
//
// Future patterns (B = streaming STT, C = realtime bidirectional) would
// require a different request shape (websocket / chunked upload) and live
// outside these endpoints.

import type { Context } from "hono";
import type { AuthVars } from "./auth.js";
import { resolveCredential } from "@relayhq/db";
import { recordAudit } from "@relayhq/db";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const TTS_URL = "https://api.openai.com/v1/audio/speech";

// Models we allow. We restrict to a small allowlist rather than passing
// through arbitrary user strings — keeps the bill predictable and avoids
// being used as a generic OpenAI proxy.
const STT_MODELS = new Set(["whisper-1"]);
const TTS_MODELS = new Set(["tts-1", "tts-1-hd", "gpt-4o-mini-tts"]);
const TTS_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse",
]);

export async function handleTranscribe(
  c: Context<{ Variables: AuthVars }>,
): Promise<Response> {
  const tenantId = c.get("tenantId");
  const cred = await resolveCredential(tenantId, "openai");
  if (!cred) {
    return c.json(
      {
        error: "no OpenAI credentials for this tenant",
        hint: "PUT /v1/credentials/openai to add one",
      },
      400,
    );
  }

  // Pass through the multipart body to OpenAI. We need to add the file
  // field (which the user sends) plus the model field (which we control).
  const form = await c.req.formData().catch(() => null);
  if (!form) {
    return c.json(
      {
        error:
          "multipart/form-data required. Send the audio file in the `file` field.",
      },
      400,
    );
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return c.json({ error: "field `file` (binary) is required" }, 400);
  }
  const model = (form.get("model") as string | null) ?? "whisper-1";
  if (!STT_MODELS.has(model)) {
    return c.json(
      { error: `unsupported model "${model}". Allowed: ${[...STT_MODELS].join(", ")}` },
      400,
    );
  }
  const language = form.get("language");
  const responseFormat = form.get("response_format") ?? "json";

  const outgoing = new FormData();
  outgoing.append("file", file);
  outgoing.append("model", model);
  if (typeof language === "string" && language) outgoing.append("language", language);
  if (typeof responseFormat === "string") outgoing.append("response_format", responseFormat);

  const upstream = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${cred.apiKey}` },
    body: outgoing,
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => upstream.statusText);
    return c.json(
      {
        error: "whisper failed",
        upstreamStatus: upstream.status,
        detail: text.slice(0, 1000),
      },
      upstream.status >= 500 ? 502 : 400,
    );
  }

  // Audit BEFORE we stream out: writing the audit after `return` is a
  // race in serverless.
  await recordAudit({
    tenantId,
    actor: { kind: "api_key", keyId: c.get("keyId") },
    action: "voice.transcribed",
    targetType: "audio",
    metadata: {
      model,
      bytes: (file as File).size ?? null,
      format: responseFormat,
    },
  });

  // Pass through the upstream content-type (json vs text vs srt vs vtt).
  const ct = upstream.headers.get("content-type") ?? "application/json";
  const body = await upstream.text();
  return new Response(body, { status: 200, headers: { "content-type": ct } });
}

export async function handleSynthesize(
  c: Context<{ Variables: AuthVars }>,
): Promise<Response> {
  const tenantId = c.get("tenantId");
  const cred = await resolveCredential(tenantId, "openai");
  if (!cred) {
    return c.json(
      {
        error: "no OpenAI credentials for this tenant",
        hint: "PUT /v1/credentials/openai to add one",
      },
      400,
    );
  }

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "json body required" }, 400);
  }
  const text = typeof body.input === "string" ? body.input : null;
  if (!text || text.length === 0) {
    return c.json({ error: "field `input` (string) is required" }, 400);
  }
  if (text.length > 4096) {
    return c.json(
      { error: "input too long (max 4096 chars per request)" },
      400,
    );
  }
  const model = typeof body.model === "string" ? body.model : "tts-1";
  if (!TTS_MODELS.has(model)) {
    return c.json(
      { error: `unsupported model "${model}". Allowed: ${[...TTS_MODELS].join(", ")}` },
      400,
    );
  }
  const voice = typeof body.voice === "string" ? body.voice : "alloy";
  if (!TTS_VOICES.has(voice)) {
    return c.json(
      { error: `unsupported voice "${voice}". Allowed: ${[...TTS_VOICES].join(", ")}` },
      400,
    );
  }
  const format = typeof body.format === "string" ? body.format : "mp3";

  const upstream = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cred.apiKey}`,
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: format,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => upstream.statusText);
    return c.json(
      {
        error: "tts failed",
        upstreamStatus: upstream.status,
        detail: errText.slice(0, 1000),
      },
      upstream.status >= 500 ? 502 : 400,
    );
  }

  await recordAudit({
    tenantId,
    actor: { kind: "api_key", keyId: c.get("keyId") },
    action: "voice.synthesized",
    targetType: "audio",
    metadata: { model, voice, format, chars: text.length },
  });

  // Stream the audio bytes straight through.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? mimeFor(format),
      "cache-control": "no-store",
    },
  });
}

function mimeFor(format: string): string {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "opus":
      return "audio/opus";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    case "wav":
      return "audio/wav";
    case "pcm":
      return "audio/L16";
    default:
      return "application/octet-stream";
  }
}
