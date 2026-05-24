"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  /** Mermaid source (e.g. `sequenceDiagram ...`). */
  chart: string;
  /** Tiny label above the diagram, like "callback flow". */
  caption?: string;
};

export function Mermaid({ chart, caption }: Props) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            // Tuned to the rest of our dark palette (ink + emerald)
            background: "#020617",
            primaryColor: "#0f172a",
            primaryTextColor: "#f1f5f9",
            primaryBorderColor: "#334155",
            lineColor: "#475569",
            secondaryColor: "#1e293b",
            tertiaryColor: "#0f172a",
            actorBkg: "#0f172a",
            actorBorder: "#34d399",
            actorTextColor: "#f1f5f9",
            actorLineColor: "#475569",
            signalColor: "#cbd5e1",
            signalTextColor: "#cbd5e1",
            noteBkgColor: "#0f172a",
            noteBorderColor: "#334155",
            noteTextColor: "#94a3b8",
            sequenceNumberColor: "#020617",
            labelBoxBkgColor: "#0f172a",
            labelBoxBorderColor: "#334155",
            labelTextColor: "#f1f5f9",
            loopTextColor: "#f1f5f9",
            activationBkgColor: "#1e293b",
            activationBorderColor: "#34d399",
          },
          sequence: {
            useMaxWidth: true,
            actorMargin: 60,
            messageFontSize: 13,
            actorFontSize: 13,
            noteFontSize: 12,
          },
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        });
        const { svg } = await mermaid.render(`mmd-${id}`, chart);
        if (!cancelled) setSvg(svg);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  return (
    <figure className="overflow-hidden rounded-xl border border-ink-800/70 bg-ink-950/60">
      {caption && (
        <div className="border-b border-ink-800/60 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-ink-500">
          {caption}
        </div>
      )}
      <div className="overflow-x-auto p-6 [&_svg]:max-w-full [&_svg]:h-auto">
        {svg ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        ) : error ? (
          <pre className="text-xs text-rose-300">{error}</pre>
        ) : (
          <div className="text-xs text-ink-500">rendering diagram…</div>
        )}
      </div>
    </figure>
  );
}
