import type { AgentEvent, RunRequest } from "./types.js";

export type StartedRun = {
  runId: string;
  workflowId: string | null;
  events: AsyncIterable<AgentEvent>;
};

export async function startRun(
  baseUrl: string,
  apiKey: string,
  body: RunRequest,
  signal?: AbortSignal,
): Promise<StartedRun> {
  const res = await fetch(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`relay run failed (${res.status}): ${text}`);
  }

  const runId = res.headers.get("x-run-id");
  if (!runId) {
    throw new Error("relay: response missing x-run-id");
  }
  const workflowId = res.headers.get("x-workflow-id");

  return { runId, workflowId, events: parseEvents(res.body) };
}

async function* parseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;

      const payload = dataLine.slice(5).trim();
      if (!payload) continue;

      try {
        yield JSON.parse(payload) as AgentEvent;
      } catch (err) {
        yield {
          type: "error",
          message: `failed to parse event: ${(err as Error).message}`,
        };
      }
    }
  }
}

export async function postToolResult(
  baseUrl: string,
  apiKey: string,
  runId: string,
  toolUseId: string,
  output: unknown,
): Promise<void> {
  const res = await fetch(
    `${baseUrl}/v1/runs/${runId}/tool-results/${toolUseId}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ output }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`relay: tool result post failed (${res.status}): ${text}`);
  }
}
