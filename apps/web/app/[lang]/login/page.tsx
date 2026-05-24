"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";

export default function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = use(params);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = window.localStorage.getItem("relay_api_key");
    if (existing) setKey(existing);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed.startsWith("relay_live_")) return;
    window.localStorage.setItem("relay_api_key", trimmed);
    setSaved(true);
    setTimeout(() => {
      window.location.href = DASHBOARD_URL;
    }, 700);
  }

  return (
    <section className="mx-auto max-w-md px-6 py-20">
      <header className="text-center">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-ink-50">
          Sign in
        </h1>
        <p className="mt-3 text-sm text-ink-400">
          Paste the <code className="font-mono text-ink-200">relay_live_…</code>{" "}
          key from your{" "}
          <Link
            href={`/${lang}/welcome?key=`}
            className="text-ink-300 hover:text-emerald-200 underline underline-offset-2"
          >
            welcome email
          </Link>
          {" "}or from <code className="font-mono text-ink-200">pnpm bootstrap</code> if you self-host.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="mt-10 space-y-4 rounded-2xl border border-ink-800/70 bg-ink-900/40 p-6"
      >
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-ink-400">
            API key
          </span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="relay_live_…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mt-2 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5 font-mono text-sm text-ink-100 placeholder:text-ink-600 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>
        <button
          type="submit"
          disabled={saved || !key.trim().startsWith("relay_live_")}
          className="w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saved ? "Saved. Redirecting…" : "Continue to dashboard"}
        </button>
        <p className="text-xs leading-relaxed text-ink-600">
          Stored only in this browser&apos;s localStorage. Nothing sent to Relay
          until you make a request.
        </p>
      </form>

      <p className="mt-8 text-center text-sm text-ink-500">
        No key yet?{" "}
        <Link
          href={`/${lang}/signup`}
          className="text-emerald-300 hover:text-emerald-200 transition"
        >
          Sign up free
        </Link>
        .
      </p>
    </section>
  );
}
