"use client";

import { useState } from "react";

type Props = {
  placeholder: string;
  button: string;
  footnote: string;
  /**
   * Tally form ID. Get one at https://tally.so → "Embed form" → copy the ID
   * from the URL (the part after /r/). Falls back to NEXT_PUBLIC_TALLY_FORM_ID.
   */
  tallyFormId?: string;
};

export function Waitlist({ placeholder, button, footnote, tallyFormId }: Props) {
  const formId = tallyFormId ?? process.env.NEXT_PUBLIC_TALLY_FORM_ID ?? "";
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) return;

    if (!formId) {
      // Not wired yet — degrade to a mailto so the form still works.
      window.location.href = `mailto:hello@relay.dev?subject=Waitlist&body=${encodeURIComponent(trimmed)}`;
      setSubmitted(true);
      return;
    }

    try {
      // Tally's lightweight HTTP submission endpoint.
      const res = await fetch(`https://tally.so/api/forms/${formId}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fields: [{ key: "email", value: trimmed }] }),
      });
      if (!res.ok) throw new Error(`tally ${res.status}`);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "submission failed");
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] px-5 py-4 text-sm text-emerald-200">
        ✓ You're on the list. We'll email you when the cloud is open.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      <div className="relative flex-1">
        <input
          type="email"
          required
          autoComplete="email"
          spellCheck={false}
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-ink-700 bg-ink-950 px-4 py-3 font-mono text-sm text-ink-100 placeholder:text-ink-600 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-emerald-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition disabled:opacity-50"
      >
        {button}
      </button>
      {error && (
        <p className="text-xs text-rose-300 sm:absolute sm:mt-14">{error}</p>
      )}
      <p className="sr-only">{footnote}</p>
    </form>
  );
}
