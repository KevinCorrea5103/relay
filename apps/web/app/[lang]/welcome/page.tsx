"use client";

import { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Code } from "@/components/Code";
import { RELAY_URL } from "@/lib/relay-url";

export default function WelcomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = use(params);
  return (
    <Suspense fallback={<section className="px-6 py-20 text-center text-ink-400">Loading…</section>}>
      <WelcomeInner lang={lang} />
    </Suspense>
  );
}

function WelcomeInner({ lang }: { lang: string }) {
  const search = useSearchParams();
  const key = search.get("key") ?? "";
  const emailed = search.get("emailed") === "1";

  const [copied, setCopied] = useState(false);
  const [stored, setStored] = useState(false);

  useEffect(() => {
    if (key && typeof window !== "undefined") {
      window.localStorage.setItem("relay_api_key", key);
      setStored(true);
    }
  }, [key]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  if (!key) {
    return (
      <section className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-ink-300">No API key in the URL.</p>
        <Link
          href={`/${lang}/signup`}
          className="mt-4 inline-block text-emerald-300 hover:text-emerald-200"
        >
          Sign up →
        </Link>
      </section>
    );
  }

  const exampleCode = `import { createAgent } from "@relayhq/sdk";

const agent = createAgent({
  apiKey: "${key}",
  baseUrl: "${RELAY_URL}",
  model: "gpt-4o-mini",
});

for await (const e of agent.run("Say hi in three languages.")) {
  if (e.type === "token") process.stdout.write(e.text);
}`;

  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <header className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-300">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          You&apos;re in
        </div>
        <h1 className="mt-5 font-sans text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
          Your API key
        </h1>
        <p className="mt-3 text-ink-400">
          {emailed
            ? "Also sent to your inbox. Save it — Relay can't show it again."
            : "Save it now — Relay can't show it again."}
        </p>
      </header>

      <div className="mt-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-1.5">
        <div className="flex items-stretch gap-2">
          <code className="flex-1 overflow-x-auto rounded-xl bg-ink-950/80 px-4 py-3 font-mono text-sm text-emerald-200">
            {key}
          </code>
          <button
            onClick={copy}
            className="rounded-xl bg-emerald-500 px-4 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      {stored && (
        <p className="mt-3 text-center text-xs text-ink-500">
          Stored in your browser&apos;s localStorage. Bring it to{" "}
          <Link
            href={`/${lang}/login`}
            className="text-ink-300 hover:text-ink-100 underline underline-offset-2"
          >
            Sign in
          </Link>{" "}
          on this device.
        </p>
      )}

      <div className="mt-12">
        <h2 className="font-sans text-xl font-semibold text-ink-100">
          Use it
        </h2>
        <p className="mt-2 text-sm text-ink-400">
          The SDK is on npm. Paste this in your project:
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-ink-800/70 bg-ink-950/60 px-3 py-1.5 font-mono text-xs text-ink-300">
          <span className="text-emerald-400">$</span>
          <span>npm install @relayhq/sdk</span>
        </div>
        <div className="mt-5">
          <Code code={exampleCode} lang="typescript" fileName="agent.ts" />
        </div>
      </div>

      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/${lang}/docs/quickstart`}
          className="group rounded-xl border border-ink-800/70 bg-ink-900/30 p-5 transition hover:border-ink-700 hover:bg-ink-900/60"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
            Read
          </p>
          <p className="mt-2 text-ink-100 group-hover:text-emerald-200 transition">
            Quickstart →
          </p>
          <p className="mt-1 text-sm text-ink-500">
            All the SDK options in one page.
          </p>
        </Link>
        <Link
          href={`/${lang}/docs/sdk`}
          className="group rounded-xl border border-ink-800/70 bg-ink-900/30 p-5 transition hover:border-ink-700 hover:bg-ink-900/60"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
            Reference
          </p>
          <p className="mt-2 text-ink-100 group-hover:text-emerald-200 transition">
            SDK docs →
          </p>
          <p className="mt-1 text-sm text-ink-500">
            createAgent, tools, memory, events.
          </p>
        </Link>
      </div>

      <p className="mt-12 text-center text-xs text-ink-600">
        Questions? Open an{" "}
        <a
          href="https://github.com/KevinCorrea5103/relay/issues"
          className="text-ink-400 hover:text-ink-200 underline underline-offset-2"
        >
          issue on GitHub
        </a>
        .
      </p>
    </section>
  );
}
