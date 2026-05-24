"use client";

import { useState } from "react";

export type LanguageTab = {
  label: string;
  /** Pre-rendered Shiki HTML, generated server-side via codeToHtml. */
  html: string;
  /** Tiny line shown beside the tabs — e.g. "npm install @relayhq/sdk". */
  install?: string;
  /** Optional badge link (e.g. npm / PyPI page). */
  badge?: { label: string; href: string };
};

export function LanguageTabs({ tabs }: { tabs: LanguageTab[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active]!;

  return (
    <figure className="overflow-hidden rounded-xl border border-ink-800/80 bg-ink-950/80 backdrop-blur ring-1 ring-inset ring-white/[0.03] shadow-2xl shadow-emerald-950/20">
      <div className="flex flex-wrap items-center gap-0 border-b border-ink-800/70 px-2 text-sm">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={
              "relative px-3 py-3 font-mono text-[12.5px] transition border-b-2 -mb-px " +
              (i === active
                ? "border-emerald-400 text-ink-100"
                : "border-transparent text-ink-500 hover:text-ink-300")
            }
          >
            {t.label}
          </button>
        ))}
        {tab.install && (
          <div className="ml-auto flex items-center gap-2 px-3 py-3 text-[11px] text-ink-500">
            {tab.badge ? (
              <a
                href={tab.badge.href}
                target="_blank"
                rel="noreferrer"
                className="font-mono hover:text-emerald-300 transition"
              >
                {tab.install} ↗
              </a>
            ) : (
              <span className="font-mono">{tab.install}</span>
            )}
          </div>
        )}
      </div>
      <div
        className="text-[13px] [&_pre]:!bg-transparent [&_pre]:py-5 [&_pre]:px-5 [&_pre]:overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: tab.html }}
      />
    </figure>
  );
}
