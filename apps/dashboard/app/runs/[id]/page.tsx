import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchRunWithEvents, type RunEvent, type RunStatus } from "@/lib/api";

export const dynamic = "force-dynamic";

type TraceItem =
  | { kind: "text"; text: string; startTs: string; endTs: string }
  | {
      kind: "tool";
      id: string;
      name: string;
      input: unknown;
      output: unknown;
      startTs: string;
      endTs: string;
    }
  | { kind: "error"; message: string; ts: string }
  | { kind: "done"; output: string; ts: string };

const statusStyle: Record<RunStatus, string> = {
  running: "bg-amber-500/20 text-amber-300 ring-amber-500/40",
  completed: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
  failed: "bg-rose-500/20 text-rose-300 ring-rose-500/40",
  canceled: "bg-ink-500/20 text-ink-300 ring-ink-500/40",
};

function buildTrace(events: RunEvent[]): TraceItem[] {
  const items: TraceItem[] = [];
  const pendingTools = new Map<
    string,
    { name: string; input: unknown; startTs: string }
  >();
  let textBuf = "";
  let textStart: string | null = null;
  let textEnd: string | null = null;

  const flushText = () => {
    if (textBuf && textStart && textEnd) {
      items.push({ kind: "text", text: textBuf, startTs: textStart, endTs: textEnd });
    }
    textBuf = "";
    textStart = null;
    textEnd = null;
  };

  for (const evt of events) {
    switch (evt.type) {
      case "token": {
        const text = (evt.payload.text as string | undefined) ?? "";
        if (!textStart) textStart = evt.ts;
        textEnd = evt.ts;
        textBuf += text;
        break;
      }
      case "tool_call": {
        flushText();
        const id = (evt.payload.id as string | undefined) ?? `seq-${evt.seq}`;
        pendingTools.set(id, {
          name: (evt.payload.name as string | undefined) ?? "unknown",
          input: evt.payload.input,
          startTs: evt.ts,
        });
        break;
      }
      case "tool_result": {
        flushText();
        const id = (evt.payload.id as string | undefined) ?? "";
        const pending = pendingTools.get(id);
        items.push({
          kind: "tool",
          id,
          name: pending?.name ?? "unknown",
          input: pending?.input ?? null,
          output: evt.payload.output,
          startTs: pending?.startTs ?? evt.ts,
          endTs: evt.ts,
        });
        pendingTools.delete(id);
        break;
      }
      case "done": {
        flushText();
        items.push({
          kind: "done",
          output: (evt.payload.output as string | undefined) ?? "",
          ts: evt.ts,
        });
        break;
      }
      case "error": {
        flushText();
        items.push({
          kind: "error",
          message: (evt.payload.message as string | undefined) ?? "unknown",
          ts: evt.ts,
        });
        break;
      }
    }
  }

  flushText();
  return items;
}

function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return "—";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function pretty(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchRunWithEvents(id);
  if (!data) notFound();
  const { run, events } = data;
  const trace = buildTrace(events);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-xs text-ink-400 hover:text-ink-200">
          ← runs
        </Link>
      </div>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${statusStyle[run.status]}`}
          >
            {run.status}
          </span>
          <span className="text-sm text-ink-300">{run.model}</span>
          <span className="text-xs text-ink-500">id: {run.id}</span>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">duration</dt>
            <dd className="mt-1 text-sm text-ink-200">
              {formatDuration(run.startedAt ?? run.createdAt, run.completedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">input tokens</dt>
            <dd className="mt-1 text-sm text-ink-200">{run.inputTokens ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">output tokens</dt>
            <dd className="mt-1 text-sm text-ink-200">{run.outputTokens ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">events</dt>
            <dd className="mt-1 text-sm text-ink-200">{events.length}</dd>
          </div>
        </dl>

        {run.system ? (
          <section className="rounded border border-ink-800 bg-ink-900/40 p-4">
            <h2 className="text-xs uppercase tracking-wider text-ink-500">system</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-200">{run.system}</p>
          </section>
        ) : null}

        <section className="rounded border border-ink-800 bg-ink-900/40 p-4">
          <h2 className="text-xs uppercase tracking-wider text-ink-500">input</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-100">{run.input}</p>
        </section>

        {run.output ? (
          <section className="rounded border border-emerald-700/40 bg-emerald-500/5 p-4">
            <h2 className="text-xs uppercase tracking-wider text-emerald-400">output</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-100">{run.output}</p>
          </section>
        ) : null}

        {run.error ? (
          <section className="rounded border border-rose-700/40 bg-rose-500/5 p-4">
            <h2 className="text-xs uppercase tracking-wider text-rose-400">error</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-rose-200">{run.error}</p>
          </section>
        ) : null}
      </header>

      <section>
        <h2 className="mb-4 text-xs uppercase tracking-wider text-ink-500">trace</h2>
        <ol className="space-y-3">
          {trace.map((item, i) => (
            <li
              key={i}
              className="rounded border border-ink-800 bg-ink-900/30 p-4 text-sm"
            >
              {item.kind === "text" ? (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs text-ink-500">
                    <span className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-300">
                      tokens
                    </span>
                    <span>{formatDuration(item.startTs, item.endTs)}</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-ink-100">{item.text}</pre>
                </div>
              ) : item.kind === "tool" ? (
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">
                      tool
                    </span>
                    <span className="text-ink-200">{item.name}</span>
                    <span>{formatDuration(item.startTs, item.endTs)}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs text-ink-500">input</div>
                      <pre className="overflow-x-auto rounded bg-ink-950/60 p-2 text-xs text-ink-200">
                        {pretty(item.input)}
                      </pre>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-ink-500">output</div>
                      <pre className="overflow-x-auto rounded bg-ink-950/60 p-2 text-xs text-ink-200">
                        {pretty(item.output)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : item.kind === "done" ? (
                <div>
                  <div className="mb-1 text-xs text-emerald-400">done</div>
                  <div className="text-ink-300">final output captured</div>
                </div>
              ) : (
                <div>
                  <div className="mb-1 text-xs text-rose-400">error</div>
                  <div className="text-rose-200">{item.message}</div>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
