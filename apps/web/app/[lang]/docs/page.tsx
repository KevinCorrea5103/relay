import Link from "next/link";
import { Code } from "@/components/Code";
import { DocsPage, H2, P } from "@/components/DocsPage";
import { docsNav } from "@/lib/docs-nav";

export default async function DocsOverview({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug=""
      lang={lang}
      title="Documentation"
      description="Everything you need to ship a streaming, traced, memory-aware agent. Self-host the whole stack in three commands."
    >
      <section>
        <H2 id="install">Install the SDK</H2>
        <P>
          Two official SDKs (TypeScript and Python). Pick your stack — both
          speak the same HTTP + SSE protocol to the Relay control plane.
        </P>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://www.npmjs.com/package/@relayhq/sdk"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-ink-800/70 bg-ink-900/40 px-3 py-1.5 text-xs text-ink-300 hover:border-emerald-500/40 hover:text-emerald-200 transition"
          >
            <span className="font-mono">@relayhq/sdk</span>
            <span className="text-ink-600">·</span>
            <span>View on npm ↗</span>
          </a>
          <a
            href="https://pypi.org/project/relayhq/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-ink-800/70 bg-ink-900/40 px-3 py-1.5 text-xs text-ink-300 hover:border-emerald-500/40 hover:text-emerald-200 transition"
          >
            <span className="font-mono">relayhq</span>
            <span className="text-ink-600">·</span>
            <span>View on PyPI ↗</span>
          </a>
        </div>
        <Code
          code={`# TypeScript / Node\nnpm install @relayhq/sdk\n\n# Python\npip install relayhq`}
          lang="bash"
        />
        <P>
          Using Go, Rust, or anything else? The protocol is plain HTTP + SSE.
          See <a className="text-emerald-300 hover:text-emerald-200" href={`/${lang}/docs/sdks`}>Languages &amp; SDKs</a>.
        </P>
      </section>

      <section>
        <H2 id="start-here">Start here</H2>
        <P>
          Two minutes from <code>git clone</code> to a streaming agent with a
          dashboard.
        </P>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/${lang}/docs/quickstart`}
            className="group block rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 transition hover:border-emerald-500/50 hover:bg-emerald-500/[0.07]"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Step 1</p>
            <h3 className="mt-2 font-semibold text-ink-50">Quickstart</h3>
            <p className="mt-1 text-sm text-ink-400">
              Clone, bootstrap, run. End-to-end self-host in two minutes.
            </p>
            <span className="mt-3 inline-block text-sm text-emerald-300 group-hover:translate-x-0.5 transition-transform">
              Get started →
            </span>
          </Link>
          <Link
            href={`/${lang}/docs/sdk`}
            className="group block rounded-xl border border-ink-800/70 bg-ink-900/30 p-5 transition hover:border-ink-700 hover:bg-ink-900/60"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-ink-500">Step 2</p>
            <h3 className="mt-2 font-semibold text-ink-50">SDK reference</h3>
            <p className="mt-1 text-sm text-ink-400">
              createAgent, tools, memory, events. The whole public surface.
            </p>
            <span className="mt-3 inline-block text-sm text-ink-300 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition">
              Read the SDK docs →
            </span>
          </Link>
        </div>
      </section>

      <section>
        <H2 id="browse">Browse</H2>
        <P>Every page in these docs, by topic.</P>
        <div className="space-y-6">
          {docsNav.map((group) => (
            <div key={group.label}>
              <h3 className="text-[10px] uppercase tracking-[0.22em] text-ink-500">
                {group.label}
              </h3>
              <ul className="mt-3 divide-y divide-ink-800/40 rounded-xl border border-ink-800/70">
                {group.links.map((link) => (
                  <li key={link.slug || "overview"}>
                    <Link
                      href={`/${lang}/docs${link.slug ? `/${link.slug}` : ""}`}
                      className="group flex items-baseline justify-between gap-6 px-5 py-4 transition hover:bg-ink-900/40"
                    >
                      <div>
                        <p className="text-ink-100 group-hover:text-emerald-200 transition">
                          {link.title}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-500">{link.description}</p>
                      </div>
                      <span className="text-ink-600 group-hover:text-emerald-300 transition">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <H2 id="help">Help</H2>
        <P>
          File a bug or feature request on{" "}
          <a
            href="https://github.com/KevinCorrea5103/relay/issues/new/choose"
            className="text-emerald-300 hover:text-emerald-200 transition"
          >
            GitHub Issues
          </a>
          . For open-ended questions, use{" "}
          <a
            href="https://github.com/KevinCorrea5103/relay/discussions"
            className="text-emerald-300 hover:text-emerald-200 transition"
          >
            Discussions
          </a>
          .
        </P>
      </section>
    </DocsPage>
  );
}
