import type { MetadataRoute } from "next";
import { docsNav } from "@/lib/docs-nav";
import { locales } from "@/lib/dict";

const ORIGIN = "https://relaygh.dev";

// Every public path, locale-agnostic (no leading locale). The locale is
// prefixed per-entry below, and each entry advertises its hreflang siblings.
const docSlugs = docsNav.flatMap((g) => g.links.map((l) => l.slug));
const PATHS = [
  "", // landing
  "login",
  "signup",
  "docs",
  ...docSlugs.filter(Boolean).map((slug) => `docs/${slug}`),
];

function urlFor(lang: string, path: string): string {
  return path ? `${ORIGIN}/${lang}/${path}` : `${ORIGIN}/${lang}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.flatMap((path) =>
    locales.map((lang) => ({
      url: urlFor(lang, path),
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path.startsWith("docs") ? 0.6 : 0.4,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, urlFor(l, path)]),
        ),
      },
    })),
  );
}
