const RELAY_URL = process.env.RELAY_URL ?? "http://localhost:4000";
const RELAY_API_KEY = process.env.RELAY_API_KEY;

function authHeaders(): Record<string, string> {
  if (!RELAY_API_KEY) {
    throw new Error(
      "RELAY_API_KEY is not set. Run `pnpm db:bootstrap` and export the key into the dashboard's env.",
    );
  }
  return { authorization: `Bearer ${RELAY_API_KEY}` };
}

export type RunStatus = "running" | "completed" | "failed" | "canceled";

export type RunSummary = {
  id: string;
  status: RunStatus;
  model: string;
  inputPreview: string;
  outputPreview: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  completedAt: string | null;
  durationMs: number | null;
};

export type Run = {
  id: string;
  status: RunStatus;
  model: string;
  system: string | null;
  input: string;
  tools: { name: string }[];
  output: string | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type RunEvent = {
  runId: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  ts: string;
};

export async function fetchRuns(): Promise<RunSummary[]> {
  const res = await fetch(`${RELAY_URL}/v1/runs`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchRuns: ${res.status}`);
  const data = (await res.json()) as { runs: RunSummary[] };
  return data.runs;
}

export async function fetchRunWithEvents(
  id: string,
): Promise<{ run: Run; events: RunEvent[] } | null> {
  const res = await fetch(`${RELAY_URL}/v1/runs/${id}/events`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchRunWithEvents: ${res.status}`);
  return (await res.json()) as { run: Run; events: RunEvent[] };
}
