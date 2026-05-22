"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/dict";

export function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();

  function pathFor(l: Locale): string {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return `/${l}`;
    parts[0] = l;
    return "/" + parts.join("/");
  }

  return (
    <div className="flex items-center gap-1 text-xs text-ink-500">
      {locales.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className="text-ink-700">·</span>}
          {l === current ? (
            <span className="text-ink-200">{l.toUpperCase()}</span>
          ) : (
            <Link href={pathFor(l)} className="hover:text-ink-200 transition">
              {l.toUpperCase()}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}
