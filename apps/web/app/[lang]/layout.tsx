import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Wordmark } from "@/components/Logo";
import { dicts, isLocale, locales, type Locale } from "@/lib/dict";

const GITHUB_URL = "https://github.com/KevinCorrea5103/relay";

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
  const ogLocale = lang === "es" ? "es_ES" : "en_US";
  const altLocale = lang === "es" ? "en_US" : "es_ES";
  return {
    title: d.meta.title,
    description: d.meta.description,
    alternates: {
      canonical: `/${lang}`,
      languages: { en: "/en", es: "/es", "x-default": "/en" },
    },
    openGraph: {
      title: d.meta.title,
      description: d.meta.description,
      url: `/${lang}`,
      locale: ogLocale,
      alternateLocale: altLocale,
    },
    twitter: { title: d.meta.title, description: d.meta.description },
  };
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
      {/* The root <html lang> is static "en"; correct it for the active
          locale so assistive tech and crawlers read the right language. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(lang)}`,
        }}
      />
      <header className="sticky top-0 z-50 border-b border-ink-800/40 bg-ink-975/70 backdrop-blur-xl">
        <div className="mx-auto flex min-w-0 max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href={`/${lang}`} aria-label="Relay home" className="shrink-0">
            <Wordmark size={18} />
          </Link>
          <nav className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-2 text-xs text-ink-400 sm:gap-x-5 sm:gap-y-0 sm:text-sm md:gap-x-7">
            <Link
              href={`/${lang}/docs`}
              className="hover:text-ink-100 transition"
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
              className="hidden sm:inline hover:text-ink-100 transition"
            >
              {d.nav.signin}
            </Link>
            <Link
              href={`/${lang}/signup`}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-ink-950 font-medium hover:bg-emerald-400 transition"
            >
              {d.nav.signup}
            </Link>
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
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink-200 transition"
            >
              {d.footer.productLinks.github}
            </a>
            <a
              href="https://www.npmjs.com/package/@relayhq/sdk"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink-200 transition"
            >
              npm
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
