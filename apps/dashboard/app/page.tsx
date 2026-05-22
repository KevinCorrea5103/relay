import Link from "next/link";
import { fetchRuns, type RunStatus } from "@/lib/api";

export const dynamic = "force-dynamic";

const statusStyle: Record<RunStatus, string> = {
  running: "bg-amber-500/20 text-amber-300 ring-amber-500/40",
  completed: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
  failed: "bg-rose-500/20 text-rose-300 ring-rose-500/40",
  canceled: "bg-ink-500/20 text-ink-300 ring-ink-500/40",
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString();
}

export default async function RunsPage() {
  let runs: Awaited<ReturnType<typeof fetchRuns>> = [];
  let error: string | null = null;
  try {
    runs = await fetchRuns();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
        <span className="text-xs text-ink-500">{runs.length} total</span>
      </div>

      {error ? (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
          control plane unreachable: {error}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded border border-ink-800 bg-ink-900/50 p-10 text-center text-sm text-ink-400">
          no runs yet — kick one off with{" "}
          <code className="rounded bg-ink-800 px-1.5 py-0.5">pnpm example</code>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-ink-800">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/60 text-left text-xs uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2">status</th>
                <th className="px-4 py-2">model</th>
                <th className="px-4 py-2">input</th>
                <th className="px-4 py-2 text-right">tokens</th>
                <th className="px-4 py-2 text-right">duration</th>
                <th className="px-4 py-2 text-right">age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {runs.map((run) => (
                <tr key={run.id} className="transition hover:bg-ink-900/40">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${statusStyle[run.status]}`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-300">{run.model}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/runs/${run.id}`}
                      className="text-ink-100 hover:text-emerald-300 hover:underline"
                    >
                      {run.inputPreview}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-400">
                    {run.inputTokens != null || run.outputTokens != null
                      ? `${run.inputTokens ?? 0} / ${run.outputTokens ?? 0}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-400">
                    {formatDuration(run.durationMs)}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-500">
                    {formatRelative(run.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
