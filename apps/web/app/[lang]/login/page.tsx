"use client";

import { useState, use } from "react";
import { dicts, isLocale, type Locale } from "@/lib/dict";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";

export default function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = use(params);
  if (!isLocale(lang)) return null;
  const d = dicts[lang as Locale];

  const [value, setValue] = useState("");
  const [stored, setStored] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const key = value.trim();
    if (!key) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("relay_api_key", key);
    }
    setStored(true);
    setTimeout(() => {
      window.location.href = DASHBOARD_URL;
    }, 800);
  }

  return (
    <section className="grid min-h-[70vh] place-items-center px-6 py-20">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-8">
          <h1 className="font-mono text-2xl font-semibold text-ink-50">
            {d.login.title}
          </h1>
          <p className="mt-2 text-sm text-ink-400">{d.login.sub}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-ink-500">
                {d.login.label}
              </span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={d.login.placeholder}
                className="mt-2 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2.5 font-mono text-sm text-ink-100 placeholder:text-ink-600 focus:border-emerald-500/60 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={stored || !value.trim()}
              className="w-full rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition disabled:opacity-50"
            >
              {stored ? d.login.saved : d.login.button}
            </button>
          </form>

          <p className="mt-6 text-xs leading-relaxed text-ink-500">
            {d.login.hint}
          </p>
        </div>
      </div>
    </section>
  );
}
