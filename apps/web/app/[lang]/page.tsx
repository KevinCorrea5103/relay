import Link from "next/link";
import { notFound } from "next/navigation";
import { codeToHtml } from "shiki";
import { Code } from "@/components/Code";
import { LanguageTabs, type LanguageTab } from "@/components/LanguageTabs";
import { Reveal } from "@/components/Reveal";
import { StackMarquee } from "@/components/StackMarquee";
import { dicts, isLocale, type Locale } from "@/lib/dict";

const GITHUB_URL = "https://github.com/KevinCorrea5103/relay";

const HERO_CODE = `import { createAgent, builtin, tool } from "@relayhq/sdk";

const reviewPR = tool({
  name: "review_pr",
  description: "Read a GitHub PR and return a summary",
  inputSchema: { type: "object", properties: { url: { type: "string" } } },
  async handler({ url }) { return github.pulls.get(url); },
});

const agent = createAgent({
  model: "claude-sonnet-4-6",
  memory: { namespace: \`user:\${userId}\` },
  tools: [builtin.calculator, reviewPR],
});

for await (const e of agent.run("Review the last PR")) {
  if (e.type === "token") process.stdout.write(e.text);
}`;

const COMPARE_CODE = `const agent = createAgent({
  model: "claude-sonnet-4-6",
  tools: [github, slack],
  memory: { namespace: "user:42" },
})

await agent.run("Review the last PR")`;

const QUICKSTART_CODE = `git clone https://github.com/KevinCorrea5103/relay
cd relay && pnpm install
pnpm bootstrap   # mints keys, brings up Postgres, migrates
pnpm dev         # runtime + control-plane + dashboard + web`;

// ─── Language snippets for the multi-language section ──────────────────────
// Each one shows the same idea: create an agent, run it, stream tokens.

const SNIPPET_TS = `import { createAgent } from "@relayhq/sdk";

const agent = createAgent({
  apiKey: process.env.RELAY_API_KEY!,
  baseUrl: "https://api.relaygh.dev",
  model: "gpt-4o-mini",
});

for await (const event of agent.run("Say hi in three languages.")) {
  if (event.type === "token") process.stdout.write(event.text);
}`;

const SNIPPET_PYTHON = `import asyncio, os
from relayhq import create_agent

agent = create_agent(
    api_key=os.environ["RELAY_API_KEY"],
    base_url="https://api.relaygh.dev",
    model="gpt-4o-mini",
)

async def main():
    async for event in agent.run("Say hi in three languages."):
        if event["type"] == "token":
            print(event["text"], end="", flush=True)

asyncio.run(main())`;

const SNIPPET_NEXTJS = `// app/api/agent/route.ts
import { createAgent } from "@relayhq/sdk";

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const agent = createAgent({
    apiKey: process.env.RELAY_API_KEY!,
    baseUrl: "https://api.relaygh.dev",
    model: "gpt-4o-mini",
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of agent.run(prompt)) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson" },
  });
}`;

const SNIPPET_CURL = `curl -N -X POST https://api.relaygh.dev/v1/runs \\
  -H "authorization: Bearer $RELAY_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "input": "Say hi in three languages."
  }'

# Server-Sent Events stream back:
# data: {"type":"token","text":"Hello"}
# data: {"type":"token","text":" Bonjour"}
# ...
# data: {"type":"done","output":"...","usage":{...}}`;

const SNIPPET_GO = `package main

import (
\t"bufio"
\t"bytes"
\t"fmt"
\t"net/http"
\t"os"
\t"strings"
)

func main() {
\tbody := strings.NewReader(\`{"model":"gpt-4o-mini","input":"Say hi."}\`)
\treq, _ := http.NewRequest("POST",
\t\t"https://api.relaygh.dev/v1/runs", body)
\treq.Header.Set("authorization", "Bearer "+os.Getenv("RELAY_API_KEY"))
\treq.Header.Set("content-type", "application/json")

\tresp, err := http.DefaultClient.Do(req)
\tif err != nil { panic(err) }
\tdefer resp.Body.Close()

\tscanner := bufio.NewScanner(resp.Body)
\tfor scanner.Scan() {
\t\tline := scanner.Text()
\t\tif strings.HasPrefix(line, "data: ") {
\t\t\tfmt.Println(bytes.TrimPrefix([]byte(line), []byte("data: ")))
\t\t}
\t}
}`;

export default async function LandingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = dicts[lang as Locale];

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative">
        {/* Background only: avoid clipping hero text/code when the section had overflow-hidden. */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-x-clip overflow-y-hidden">
          <div className="grid-bg fade-mask absolute inset-0 opacity-50" />
          <div className="absolute left-1/2 top-32 h-[420px] w-[820px] max-w-[100vw] -translate-x-1/2 bg-emerald-500/10 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl px-4 pt-24 pb-20 sm:px-6 sm:pt-32 sm:pb-24">
          <div className="grid min-w-0 grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <Reveal>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 transition"
                >
                  <span className="relative inline-block h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  {d.hero.badge}
                </a>
              </Reveal>

              <Reveal delay={0.08}>
                <h1 className="mt-6 max-w-full break-words font-sans text-[clamp(1.85rem,5.5vw+0.6rem,3.6rem)] font-semibold leading-[1.08] tracking-tight text-ink-50 sm:text-5xl lg:text-[3.6rem]">
                  {d.hero.title}
                </h1>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mt-6 max-w-xl break-words text-base leading-relaxed text-ink-400 sm:text-lg">
                  {d.hero.sub}
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mt-8 flex w-full min-w-0 flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                  <Link
                    href={`/${lang}/signup`}
                    className="group relative inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-md bg-emerald-500 px-5 py-2.5 text-center text-sm font-medium text-ink-950 hover:bg-emerald-400 transition sm:w-auto"
                  >
                    {d.hero.primary}
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full min-w-0 items-center justify-center rounded-md border border-ink-700 bg-ink-900/40 px-5 py-2.5 text-center text-sm font-medium text-ink-200 hover:border-ink-500 hover:text-ink-50 transition sm:w-auto"
                  >
                    {d.hero.secondary}
                  </a>
                  <Link
                    href={`/${lang}/docs/quickstart`}
                    className="inline-flex justify-center px-2 py-2.5 text-center text-sm text-ink-400 hover:text-ink-100 transition sm:inline"
                  >
                    Self-host →
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={0.32}>
                <div className="mt-6 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <a
                    href="https://www.npmjs.com/package/@relayhq/sdk"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-ink-800/70 bg-ink-950/60 px-3 py-1.5 font-mono text-xs text-ink-400 hover:border-emerald-500/40 hover:text-ink-100 transition"
                    title="View on npm"
                  >
                    <span className="shrink-0 text-emerald-400">$</span>
                    <span className="min-w-0 break-all">{d.hero.installNpm}</span>
                    <span className="ml-1 shrink-0 text-ink-600">↗</span>
                  </a>
                  <a
                    href="https://pypi.org/project/relayhq/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-ink-800/70 bg-ink-950/60 px-3 py-1.5 font-mono text-xs text-ink-400 hover:border-emerald-500/40 hover:text-ink-100 transition"
                    title="View on PyPI"
                  >
                    <span className="shrink-0 text-emerald-400">$</span>
                    <span className="min-w-0 break-all">{d.hero.installPip}</span>
                    <span className="ml-1 shrink-0 text-ink-600">↗</span>
                  </a>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.2}>
              <div className="relative min-w-0 w-full">
                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent blur-2xl" />
                <div className="relative min-w-0">
                  <Code code={HERO_CODE} lang="typescript" fileName={d.hero.codeCaption} />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Built on ─────────────────────────────────────────────────────── */}
      <section className="border-y border-ink-800/40 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-center text-[11px] uppercase tracking-[0.22em] text-ink-500">
              {d.builtOn.title}
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6">
              <StackMarquee />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Why ──────────────────────────────────────────────────────────── */}
      <section className="py-28">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">{d.why.eyebrow}</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-sans text-3xl font-semibold leading-tight tracking-tight text-ink-50 sm:text-4xl">
              {d.why.title}
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 text-lg leading-relaxed text-ink-400">{d.why.body}</p>
          </Reveal>
        </div>
      </section>

      {/* ─── Without / With ───────────────────────────────────────────────── */}
      <section className="border-t border-ink-800/40 py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">{d.compare.eyebrow}</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
                {d.compare.title}
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-3 text-ink-400">{d.compare.sub}</p>
            </Reveal>
          </div>

          <div className="mt-14 grid min-w-0 gap-6 lg:grid-cols-2">
            <Reveal delay={0.1}>
              <div className="h-full min-w-0 rounded-xl border border-rose-500/15 bg-rose-500/[0.025] p-6">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-rose-300/80">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400/60" />
                  {d.compare.withoutLabel}
                </div>
                <ul className="mt-6 space-y-3">
                  {d.compare.withoutItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-sm text-ink-300"
                    >
                      <span className="font-mono text-ink-700">—</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="h-full min-w-0 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-emerald-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {d.compare.withLabel}
                </div>
                <div className="mt-6">
                  <Code code={COMPARE_CODE} lang="typescript" />
                </div>
                <p className="mt-5 text-sm leading-relaxed text-ink-300">
                  {d.compare.withCaption}
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section className="border-t border-ink-800/40 py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">{d.how.eyebrow}</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
                {d.how.title}
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-3 text-ink-400">{d.how.sub}</p>
            </Reveal>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-ink-800/70 bg-ink-800/40 md:grid-cols-3">
            {d.how.steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="h-full bg-ink-950 p-7">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-3xl font-semibold text-emerald-400/90">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-xs uppercase tracking-[0.18em] text-ink-500">step</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink-100">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-400">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            <div className="mt-10">
              <Code code={QUICKSTART_CODE} lang="bash" fileName="quickstart.sh" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section className="border-t border-ink-800/40 py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">{d.features.eyebrow}</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
                {d.features.title}
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-3 text-ink-400">{d.features.sub}</p>
            </Reveal>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-ink-800/70 bg-ink-800/40 sm:grid-cols-2 lg:grid-cols-4">
            {d.features.items.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.04}>
                <div className="group h-full bg-ink-950 p-6 transition hover:bg-ink-900/40">
                  <h3 className="font-mono text-sm font-semibold text-ink-100">
                    <span className="text-emerald-400">/</span> {f.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-400">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Use it from anywhere ────────────────────────────────────────── */}
      <LanguagesSection lang={lang as Locale} d={d} />

      {/* ─── Trace (screenshots) ──────────────────────────────────────────── */}
      <section className="border-t border-ink-800/40 py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">{d.trace.eyebrow}</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
                {d.trace.title}
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-3 text-ink-400">{d.trace.sub}</p>
            </Reveal>
          </div>

          <div className="mt-12 space-y-6">
            <Reveal>
              <figure className="overflow-hidden rounded-xl border border-ink-800/70 bg-ink-900/40 shadow-2xl shadow-emerald-950/20">
                <div className="border-b border-ink-800/70 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  dashboard · runs
                </div>
                <img
                  src="/screenshots/dashboard-list.png"
                  alt="Relay dashboard runs list"
                  className="w-full"
                  loading="lazy"
                />
              </figure>
            </Reveal>

            <Reveal delay={0.1}>
              <figure className="overflow-hidden rounded-xl border border-ink-800/70 bg-ink-900/40 shadow-2xl shadow-emerald-950/20">
                <div className="border-b border-ink-800/70 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  dashboard · execution trace
                </div>
                <img
                  src="/screenshots/dashboard-trace.png"
                  alt="Relay execution trace — tool calls and results in order"
                  className="w-full"
                  loading="lazy"
                />
              </figure>
            </Reveal>

            <Reveal>
              <p className="text-sm text-ink-500">{d.trace.caption}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-ink-800/40 py-28">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">{d.faq.eyebrow}</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
              {d.faq.title}
            </h2>
          </Reveal>

          <dl className="mt-10 space-y-2">
            {d.faq.items.map((item, i) => (
              <Reveal key={item.q} delay={i * 0.04}>
                <details className="group rounded-xl border border-ink-800/70 bg-ink-900/30 px-5 py-4 open:bg-ink-900/60 transition">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink-100">
                    {item.q}
                    <span className="text-ink-500 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-ink-400">{item.a}</p>
                </details>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* ─── CTA (self-host only) ─────────────────────────────────────────── */}
      <section className="relative border-t border-ink-800/40 py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 overflow-x-clip bg-gradient-to-b from-emerald-500/[0.07] to-transparent" />
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">{d.cta.eyebrow}</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
              {d.cta.title}
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-4 text-ink-400">{d.cta.sub}</p>
          </Reveal>

          <Reveal delay={0.32}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/${lang}/signup`}
                className="rounded-md bg-emerald-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition"
              >
                {d.cta.primary} →
              </Link>
              <Link
                href={`/${lang}/docs/quickstart`}
                className="rounded-md border border-ink-700 bg-ink-900/40 px-5 py-3 text-sm font-medium text-ink-200 hover:border-ink-500 hover:text-ink-50 transition"
              >
                {d.cta.secondary}
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-3 text-sm text-ink-400 hover:text-ink-100 transition"
              >
                ★ {d.nav.star}
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

// ─── Async section: pre-renders Shiki HTML for every language tab ──────────

async function highlight(code: string, lang: string): Promise<string> {
  return codeToHtml(code, { lang, theme: "vesper" });
}

async function LanguagesSection({
  lang,
  d,
}: {
  lang: Locale;
  d: (typeof dicts)[Locale];
}) {
  const [ts, py, next, bash, go] = await Promise.all([
    highlight(SNIPPET_TS, "typescript"),
    highlight(SNIPPET_PYTHON, "python"),
    highlight(SNIPPET_NEXTJS, "typescript"),
    highlight(SNIPPET_CURL, "bash"),
    highlight(SNIPPET_GO, "go"),
  ]);

  const tabs: LanguageTab[] = [
    {
      label: d.languages.tabs.typescript,
      html: ts,
      install: "npm i @relayhq/sdk",
      badge: {
        label: "npm",
        href: "https://www.npmjs.com/package/@relayhq/sdk",
      },
    },
    {
      label: d.languages.tabs.python,
      html: py,
      install: "pip install relayhq",
      badge: { label: "PyPI", href: "https://pypi.org/project/relayhq/" },
    },
    {
      label: d.languages.tabs.nextjs,
      html: next,
      install: "npm i @relayhq/sdk",
      badge: {
        label: "npm",
        href: "https://www.npmjs.com/package/@relayhq/sdk",
      },
    },
    { label: d.languages.tabs.curl, html: bash, install: "no install" },
    { label: d.languages.tabs.go, html: go, install: "stdlib only" },
  ];

  return (
    <section className="border-t border-ink-800/40 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">
              {d.languages.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
              {d.languages.title}
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-3 text-ink-400">{d.languages.sub}</p>
          </Reveal>
        </div>

        <Reveal delay={0.24}>
          <div className="mt-10">
            <LanguageTabs tabs={tabs} />
          </div>
        </Reveal>

        <Reveal delay={0.32}>
          <p className="mt-5 text-sm text-ink-500">
            {d.languages.footer.replace(
              "/docs/api",
              "",
            )}{" "}
            <a
              href={`/${lang}/docs/api`}
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
            >
              /docs/api
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
