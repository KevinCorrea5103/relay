"use client";

import { useState } from "react";

type Tab = { label: string; code: string; language?: string };

export function CodeTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active]!;

  return (
    <figure className="overflow-hidden rounded-lg border border-ink-800 bg-ink-900/50">
      <div className="flex items-center gap-0 border-b border-ink-800 text-xs">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`px-4 py-2 transition border-b -mb-px ${
              i === active
                ? "border-emerald-400 text-ink-100"
                : "border-transparent text-ink-500 hover:text-ink-300"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto px-4 text-[10px] uppercase tracking-widest text-ink-600">
          {tab.language ?? "ts"}
        </div>
      </div>
      <pre className="overflow-x-auto px-4 py-5 text-[13px] leading-relaxed text-ink-100 font-mono">
        <code>{tab.code}</code>
      </pre>
    </figure>
  );
}
