import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Wordmark } from "@/components/Logo";
import { dicts, isLocale, locales, type Locale } from "@/lib/dict";

const GITHUB_URL = "https://github.com/KevinCorrea5103/relay";
const DASHBOARD_URL = "http://localhost:3000";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const d = dicts[lang];
  return { title: d.meta.title, description: d.meta.description };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = dicts[lang as Locale];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-ink-800/40 bg-ink-975/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href={`/${lang}`} aria-label="Relay home">
            <Wordmark size={18} />
          </Link>
          <nav className="flex items-center gap-7 text-sm text-ink-400">
            <Link
              href={`/${lang}/docs`}
              className="hidden sm:inline hover:text-ink-100 transition"
            >
              {d.nav.docs}
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline hover:text-ink-100 transition"
            >
              {d.nav.github}
            </a>
            <Link
              href={`/${lang}/login`}
              className="hover:text-ink-100 transition"
            >
              {d.nav.login}
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-ink-200 hover:border-emerald-500/40 hover:text-emerald-200 transition"
            >
              ★ {d.nav.star}
            </a>
            <LocaleSwitcher current={lang as Locale} />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink-800/40 mt-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-ink-500">
            <Wordmark size={16} />
            <span className="hidden sm:inline text-ink-700">·</span>
            <span className="hidden sm:inline">{d.footer.tagline}</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-ink-500">
            <Link href={`/${lang}/docs`} className="hover:text-ink-200 transition">
              {d.footer.productLinks.docs}
            </Link>
            <a href={GITHUB_URL} className="hover:text-ink-200 transition">
              {d.footer.productLinks.github}
            </a>
            <a href={DASHBOARD_URL} className="hover:text-ink-200 transition">
              {d.nav.dashboard}
            </a>
            <span className="text-ink-700">·</span>
            <LocaleSwitcher current={lang as Locale} />
          </div>
        </div>
        <div className="border-t border-ink-800/30">
          <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-ink-600">
            {d.footer.copyright}
          </div>
        </div>
      </footer>
    </>
  );
}
