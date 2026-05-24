"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsNav } from "@/lib/docs-nav";

export function DocsSidebar({ lang }: { lang: string }) {
  const pathname = usePathname();
  const base = `/${lang}/docs`;

  function hrefFor(slug: string) {
    return slug ? `${base}/${slug}` : base;
  }
  function isActive(slug: string) {
    const target = hrefFor(slug);
    if (slug === "") return pathname === target;
    return pathname === target || pathname.startsWith(target + "/");
  }

  return (
    <nav className="space-y-7 text-sm">
      {docsNav.map((group) => (
        <div key={group.label}>
          <h4 className="px-3 text-[10px] uppercase tracking-[0.22em] text-ink-500">
            {group.label}
          </h4>
          <ul className="mt-2 space-y-0.5">
            {group.links.map((link) => {
              const active = isActive(link.slug);
              return (
                <li key={link.slug || "overview"}>
                  <Link
                    href={hrefFor(link.slug)}
                    className={
                      "block rounded-md px-3 py-1.5 transition " +
                      (active
                        ? "bg-emerald-500/10 text-emerald-200"
                        : "text-ink-400 hover:bg-ink-900/60 hover:text-ink-100")
                    }
                  >
                    {link.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
