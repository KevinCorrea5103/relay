// Voice helpers — thin wrappers around POST /v1/transcribe and
// POST /v1/synthesize. The audio bytes flow directly through; we just
// add the bearer auth and parse the response shape.

declare const process: { env?: Record<string, string | undefined> } | undefined;

const DEFAULT_BASE_URL = "http://localhost:4000";

export type TranscribeOptions = {
  file: Blob | File;
  model?: "whisper-1";
  language?: string;
  responseFormat?: "json" | "text" | "srt" | "vtt" | "verbose_json";
  apiKey?: string;
  baseUrl?: string;
};

export type TranscribeResult = {
  text: string;
  raw: unknown;
};

export async function transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
  const baseUrl = resolveBaseUrl(opts.baseUrl);
  const apiKey = resolveApiKey(opts.apiKey);

  const form = new FormData();
  form.append("file", opts.file);
  if (opts.model) form.append("model", opts.model);
  if (opts.language) form.append("language", opts.language);
  if (opts.responseFormat) form.append("response_format", opts.responseFormat);

  const res = await fetch(`${baseUrl}/v1/transcribe`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`relay transcribe failed (${res.status}): ${text}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = (await res.json()) as { text?: string };
    return { text: json.text ?? "", raw: json };
  }
  const text = await res.text();
  return { text, raw: text };
}

export type SynthesizeOptions = {
  input: string;
  model?: "tts-1" | "tts-1-hd" | "gpt-4o-mini-tts";
  voice?:
    | "alloy"
    | "ash"
    | "ballad"
    | "coral"
    | "echo"
    | "fable"
    | "onyx"
    | "nova"
    | "sage"
    | "shimmer"
    | "verse";
  format?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
  apiKey?: string;
  baseUrl?: string;
};

// Returns the raw audio bytes plus the content-type for convenient
// playback (e.g., new Blob([audio], { type: mime }) in the browser).
export async function synthesize(
  opts: SynthesizeOptions,
): Promise<{ audio: ArrayBuffer; mime: string }> {
  const baseUrl = resolveBaseUrl(opts.baseUrl);
  const apiKey = resolveApiKey(opts.apiKey);

  const res = await fetch(`${baseUrl}/v1/synthesize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: opts.input,
      model: opts.model ?? "tts-1",
      voice: opts.voice ?? "alloy",
      format: opts.format ?? "mp3",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`relay synthesize failed (${res.status}): ${text}`);
  }
  const audio = await res.arrayBuffer();
  const mime = res.headers.get("content-type") ?? "audio/mpeg";
  return { audio, mime };
}

function resolveBaseUrl(explicit?: string): string {
  return (
    explicit ??
    (typeof process !== "undefined" ? process.env?.RELAY_URL : undefined) ??
    DEFAULT_BASE_URL
  );
}

function resolveApiKey(explicit?: string): string {
  const key =
    explicit ??
    (typeof process !== "undefined" ? process.env?.RELAY_API_KEY : undefined);
  if (!key) {
    throw new Error(
      "relay: apiKey is required. Pass `apiKey` or set RELAY_API_KEY in env.",
    );
  }
  return key;
}
