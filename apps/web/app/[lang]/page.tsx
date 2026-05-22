import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/CodeBlock";
import { dicts, isLocale, type Locale } from "@/lib/dict";

const GITHUB_URL = "https://github.com/KevinCorrea5103/relay";

const HERO_CODE = `const agent = createAgent({
  model: "claude-sonnet-4-6",
  tools: [github, slack],
})

await agent.run("Review the last PR")`;

const COMPARE_CODE = `const agent = createAgent({
  model: "claude-sonnet-4-6",
  tools: [github, slack],
  memory: { namespace: "user:42" },
})

await agent.run("Review the last PR")`;

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
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg fade-mask absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="flex flex-col items-start">
            <a
              href={GITHUB_URL}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 transition"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {d.hero.badge}
            </a>

            <h1 className="mt-8 max-w-3xl font-mono text-4xl font-semibold leading-[1.1] tracking-tight text-ink-50 sm:text-5xl lg:text-6xl">
              {d.hero.title}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-300">
              {d.hero.sub}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={`/${lang}/login`}
                className="rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition"
              >
                {d.hero.primary}
              </Link>
              <a
                href={GITHUB_URL}
                className="rounded-md border border-ink-700 px-4 py-2.5 text-sm font-medium text-ink-200 hover:border-ink-500 hover:text-ink-50 transition"
              >
                {d.hero.secondary}
              </a>
              <Link
                href={`/${lang}/docs`}
                className="px-1 py-2.5 text-sm text-ink-400 hover:text-ink-100 transition"
              >
                {d.hero.tertiary} →
              </Link>
            </div>

            <div className="mt-14 w-full max-w-2xl">
              <CodeBlock language="typescript" caption={d.hero.codeCaption}>
                {HERO_CODE}
              </CodeBlock>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="border-t border-ink-800/70 py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-mono text-3xl font-semibold leading-tight tracking-tight text-ink-50 sm:text-4xl">
            {d.why.title}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-400">
            {d.why.body}
          </p>
        </div>
      </section>

      {/* Without / With */}
      <section className="border-t border-ink-800/70 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="max-w-2xl">
            <h2 className="font-mono text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
              {d.compare.title}
            </h2>
            <p className="mt-3 text-ink-400">{d.compare.sub}</p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {/* Without */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-rose-300/80">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400/70" />
                {d.compare.withoutLabel}
              </div>
              <ul className="mt-5 space-y-2.5">
                {d.compare.withoutItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm text-ink-300"
                  >
                    <span className="font-mono text-ink-600">—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* With */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-emerald-300">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {d.compare.withLabel}
              </div>
              <div className="mt-5">
                <CodeBlock language="typescript">{COMPARE_CODE}</CodeBlock>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-ink-300">
                {d.compare.withCaption}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-ink-800/70 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-mono text-3xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
            {d.cta.title}
          </h2>
          <p className="mt-4 text-ink-400">{d.cta.sub}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${lang}/login`}
              className="rounded-md bg-emerald-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-emerald-400 transition"
            >
              {d.cta.button}
            </Link>
            <a
              href={GITHUB_URL}
              className="rounded-md border border-ink-700 px-5 py-3 text-sm font-medium text-ink-200 hover:border-ink-500 hover:text-ink-50 transition"
            >
              {d.nav.github}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
