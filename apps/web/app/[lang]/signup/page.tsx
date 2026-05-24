"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RELAY_URL } from "@/lib/relay-url";

type Stage = "form" | "submitting";

export default function SignupPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = use(params);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!openaiKey.trim() && !anthropicKey.trim()) {
      setError("Add at least one provider key (OpenAI or Anthropic).");
      return;
    }

    setStage("submitting");
    try {
      const res = await fetch(`${RELAY_URL}/v1/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          openaiApiKey: openaiKey.trim() || undefined,
          anthropicApiKey: anthropicKey.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        apiKey?: string;
        error?: string;
        hint?: string;
        email?: { sent: boolean; reason?: string };
      };

      if (!res.ok || !data.apiKey) {
        setError(data.error || `signup failed (${res.status})`);
        setStage("form");
        return;
      }

      const params = new URLSearchParams({
        key: data.apiKey,
        emailed: data.email?.sent ? "1" : "0",
      });
      router.push(`/${lang}/welcome?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
      setStage("form");
    }
  }

  return (
    <section className="mx-auto max-w-lg px-6 py-20">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">
          Cloud beta
        </p>
        <h1 className="mt-3 font-sans text-4xl font-semibold tracking-tight text-ink-50">
          Get a Relay API key
        </h1>
        <p className="mt-3 text-ink-400">
          Free. No credit card. Your provider tokens flow direct — Relay never
          touches your billing.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="mt-10 space-y-5 rounded-2xl border border-ink-800/70 bg-ink-900/40 p-6"
      >
        <Field
          label="Email"
          hint="We'll send you the API key. Used only for that — and a one-time welcome."
        >
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@startup.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="OpenAI API key"
          hint="Recommended. Needed for memory (embeddings) and for any OpenAI / OpenAI-compatible model."
        >
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-..."
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="Anthropic API key"
          hint="Optional. Needed for Claude models."
        >
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-..."
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className={inputClass}
          />
        </Field>

        {error && (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/[0.05] px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={stage === "submitting"}
          className="w-full rounded-md bg-emerald-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stage === "submitting" ? "Creating your tenant…" : "Get my API key →"}
        </button>

        <p className="text-center text-xs leading-relaxed text-ink-600">
          Your provider keys are encrypted with AES-256-GCM the moment they
          arrive. Read{" "}
          <Link
            href={`/${lang}/docs/architecture`}
            className="text-ink-400 hover:text-ink-200 underline underline-offset-2"
          >
            how
          </Link>
          .
        </p>
      </form>

      <p className="mt-8 text-center text-sm text-ink-500">
        Already have a key?{" "}
        <Link
          href={`/${lang}/login`}
          className="text-emerald-300 hover:text-emerald-200 transition"
        >
          Sign in
        </Link>
        .
      </p>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-ink-400">
        {label}
      </span>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{hint}</p>}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5 font-mono text-sm text-ink-100 placeholder:text-ink-600 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
