import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/CodeBlock";
import { dicts, isLocale, type Locale } from "@/lib/dict";

export default async function DocsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = dicts[lang as Locale];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-5xl px-6">
        <header className="border-b border-ink-800/60 pb-12">
          <h1 className="font-mono text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
            {d.docs.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-300">{d.docs.sub}</p>
        </header>

        <div className="mt-12 grid gap-12 lg:grid-cols-[200px_1fr]">
          <nav className="hidden lg:block">
            <ul className="sticky top-24 space-y-2 text-sm">
              {d.docs.sections.map((s, i) => (
                <li key={s.title}>
                  <a
                    href={`#section-${i}`}
                    className="text-ink-400 hover:text-ink-100 transition"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-16">
            {d.docs.sections.map((s, i) => (
              <article
                key={s.title}
                id={`section-${i}`}
                className="scroll-mt-24"
              >
                <h2 className="font-mono text-2xl font-semibold text-ink-50">
                  {s.title}
                </h2>
                <p className="mt-3 max-w-2xl text-ink-300">{s.body}</p>
                {s.code && (
                  <div className="mt-5">
                    <CodeBlock language="ts">{s.code}</CodeBlock>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
