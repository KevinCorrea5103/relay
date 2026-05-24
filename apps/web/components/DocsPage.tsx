import Link from "next/link";
import type { ReactNode } from "react";
import { findDoc, neighborDocs } from "@/lib/docs-nav";

export function DocsPage({
  slug,
  title,
  description,
  children,
  lang,
}: {
  slug: string;
  title: string;
  description: string;
  children: ReactNode;
  lang: string;
}) {
  const { prev, next } = neighborDocs(slug);
  const meta = findDoc(slug);

  return (
    <article className="min-w-0">
      <header className="border-b border-ink-800/40 pb-8">
        {meta && (
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">
            {meta.title === title ? "Documentation" : meta.title}
          </p>
        )}
        <h1 className="mt-3 font-sans text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-400">
          {description}
        </p>
      </header>

      <div className="prose-doc mt-10 space-y-10">{children}</div>

      <nav className="mt-16 grid gap-3 border-t border-ink-800/40 pt-8 sm:grid-cols-2">
        {prev ? (
          <Link
            href={`/${lang}/docs${prev.slug ? `/${prev.slug}` : ""}`}
            className="group rounded-xl border border-ink-800/70 bg-ink-900/30 p-4 transition hover:border-ink-700 hover:bg-ink-900/60"
          >
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-500">← previous</span>
            <span className="mt-1 block text-ink-100 group-hover:text-emerald-200">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/${lang}/docs${next.slug ? `/${next.slug}` : ""}`}
            className="group rounded-xl border border-ink-800/70 bg-ink-900/30 p-4 text-right transition hover:border-ink-700 hover:bg-ink-900/60 sm:text-right"
          >
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-500">next →</span>
            <span className="mt-1 block text-ink-100 group-hover:text-emerald-200">{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 font-sans text-2xl font-semibold tracking-tight text-ink-50"
    >
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="scroll-mt-24 font-sans text-lg font-semibold text-ink-100"
    >
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-ink-300 leading-relaxed">{children}</p>;
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-ink-900/80 border border-ink-800/60 px-1.5 py-0.5 font-mono text-[12.5px] text-emerald-200">
      {children}
    </code>
  );
}

export function Callout({
  kind = "note",
  children,
}: {
  kind?: "note" | "warn" | "tip";
  children: ReactNode;
}) {
  const styles =
    kind === "warn"
      ? "border-amber-500/30 bg-amber-500/[0.04] text-amber-200"
      : kind === "tip"
        ? "border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-200"
        : "border-ink-700/70 bg-ink-900/40 text-ink-200";
  const label = kind === "warn" ? "Warning" : kind === "tip" ? "Tip" : "Note";
  return (
    <aside className={`rounded-xl border ${styles} px-5 py-4 text-sm leading-relaxed`}>
      <p className="mb-1 text-[10px] uppercase tracking-[0.22em] opacity-80">{label}</p>
      <div>{children}</div>
    </aside>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-800/70">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="bg-ink-900/60 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
      {children}
    </th>
  );
}

export function Td({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <td
      className={
        "border-t border-ink-800/40 px-4 py-2.5 align-top text-ink-300 " +
        (mono ? "font-mono text-[12.5px]" : "")
      }
    >
      {children}
    </td>
  );
}
