import Link from "next/link";
import { notFound } from "next/navigation";
import { Code } from "@/components/Code";
import { Reveal } from "@/components/Reveal";
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

const BUILT_ON = [
  "Postgres",
  "pgvector",
  "Anthropic",
  "OpenAI",
  "Ollama",
  "Hono",
  "Next.js",
  "Go",
  "Docker",
];

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
      <section className="relative overflow-hidden">
        <div className="grid-bg fade-mask absolute inset-0 opacity-50" />
        <div className="absolute left-1/2 top-32 -z-10 h-[420px] w-[820px] -translate-x-1/2 bg-emerald-500/10 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div>
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
                <h1 className="mt-6 font-sans text-[2.4rem] font-semibold leading-[1.05] tracking-tight text-ink-50 sm:text-5xl lg:text-[3.6rem]">
                  {d.hero.title}
                </h1>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-400">
                  {d.hero.sub}
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/${lang}/docs/quickstart`}
                    className="group relative inline-flex items-center gap-2 rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition"
                  >
                    {d.hero.primary}
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-ink-700 bg-ink-900/40 px-5 py-2.5 text-sm font-medium text-ink-200 hover:border-ink-500 hover:text-ink-50 transition"
                  >
                    {d.hero.secondary}
                  </a>
                </div>
              </Reveal>

              <Reveal delay={0.32}>
                <a
                  href="https://www.npmjs.com/package/@relayhq/sdk"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-md border border-ink-800/70 bg-ink-950/60 px-3 py-1.5 font-mono text-xs text-ink-400 hover:border-emerald-500/40 hover:text-ink-100 transition"
                  title="View on npm"
                >
                  <span className="text-emerald-400">$</span>
                  <span>{d.hero.install}</span>
                  <span className="ml-1 text-ink-600">↗</span>
                </a>
              </Reveal>
            </div>

            <Reveal delay={0.2}>
              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent blur-2xl" />
                <div className="relative">
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
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-ink-400">
              {BUILT_ON.map((name) => (
                <span key={name} className="font-mono hover:text-ink-200 transition">
                  {name}
                </span>
              ))}
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

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <Reveal delay={0.1}>
              <div className="h-full rounded-xl border border-rose-500/15 bg-rose-500/[0.025] p-6">
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
              <div className="h-full rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6">
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
      <section className="relative border-t border-ink-800/40 py-28 overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-emerald-500/[0.07] to-transparent" />
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

          <Reveal delay={0.24}>
            <div className="mt-10 inline-flex items-center gap-2 rounded-md border border-ink-800/70 bg-ink-950/80 px-4 py-3 font-mono text-sm text-ink-200">
              <span className="text-emerald-400">$</span>
              <span>git clone https://github.com/KevinCorrea5103/relay</span>
            </div>
          </Reveal>

          <Reveal delay={0.32}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/${lang}/docs/quickstart`}
                className="rounded-md bg-emerald-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition"
              >
                {d.cta.primary} →
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-ink-700 bg-ink-900/40 px-5 py-3 text-sm font-medium text-ink-200 hover:border-ink-500 hover:text-ink-50 transition"
              >
                ★ {d.cta.secondary}
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
