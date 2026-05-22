import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
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
      <header className="sticky top-0 z-50 border-b border-ink-800/70 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href={`/${lang}`} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono font-semibold tracking-tight text-ink-100">
              relay
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-ink-400">
            <Link href={`/${lang}/docs`} className="hover:text-ink-100 transition">
              {d.nav.docs}
            </Link>
            <a href={GITHUB_URL} className="hover:text-ink-100 transition">
              {d.nav.github}
            </a>
            <Link
              href={`/${lang}/login`}
              className="hover:text-ink-100 transition"
            >
              {d.nav.login}
            </Link>
            <LocaleSwitcher current={lang as Locale} />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink-800/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-ink-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-ink-300">relay</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{d.footer.tagline}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-ink-500">
            <Link href={`/${lang}/docs`} className="hover:text-ink-300 transition">
              {d.footer.productLinks.docs}
            </Link>
            <a href={GITHUB_URL} className="hover:text-ink-300 transition">
              {d.footer.productLinks.github}
            </a>
            <a
              href={DASHBOARD_URL}
              className="hover:text-ink-300 transition"
            >
              {d.nav.dashboard}
            </a>
            <span className="text-ink-700">·</span>
            <LocaleSwitcher current={lang as Locale} />
          </div>
        </div>
        <div className="border-t border-ink-800/40">
          <div className="mx-auto max-w-5xl px-6 py-4 text-xs text-ink-600">
            {d.footer.copyright}
          </div>
        </div>
      </footer>
    </>
  );
}
