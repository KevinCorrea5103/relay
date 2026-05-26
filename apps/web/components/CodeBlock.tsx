export function CodeBlock({
  children,
  language,
  caption,
}: {
  children: string;
  language?: string;
  caption?: string;
}) {
  return (
    <figure className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-ink-800 bg-ink-900/50 backdrop-blur">
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-2 text-[10px] uppercase tracking-widest text-ink-500">
        <span>{language ?? "ts"}</span>
        {caption && <span className="text-ink-600">{caption}</span>}
      </div>
      <pre className="min-w-0 max-w-full overflow-x-auto px-4 py-4 text-[13px] leading-relaxed text-ink-100 font-mono">
        <code>{children}</code>
      </pre>
    </figure>
  );
}
