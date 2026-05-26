import type { ReactNode } from "react";

// ─── StackMarquee ──────────────────────────────────────────────────────────
//
// Infinite horizontal carousel of the boring-but-battle-tested stack we run
// on. SVG-only (no external images, no fonts to load), monochrome, hovers
// to emerald to match the rest of the site. Pure CSS — the track is the
// list duplicated twice, animated from translateX(0) to translateX(-50%)
// so the seam is invisible.

type LogoSpec = {
  name: string;
  Icon: () => ReactNode;
};

const ICON_CLASS = "h-7 w-auto text-ink-400 transition-colors group-hover:text-emerald-300";

const PostgresLogo = () => (
  <svg viewBox="0 0 64 64" className={ICON_CLASS} fill="none" aria-hidden>
    <path
      d="M50 16c-3-3-9-4-14-3 1-1 2-2 4-2 4-1 9 0 12 3 3 4 3 9 1 14-1 4-3 8-5 11-2 2-5 4-8 4-2 0-4-1-5-3-1-2-1-4 0-6 1-3 3-6 6-7 2-1 4-1 6 0M22 14c-2 0-4 1-6 3-3 4-4 9-3 14 0 5 2 10 5 14 2 3 5 5 9 6 3 0 6-1 8-3 1-2 2-4 1-7-1-3-3-6-6-7-2-1-5-1-7 0m12 4c-3 1-5 4-5 7-1 6 1 12 5 16 2 2 4 3 6 3 3 0 5-2 6-5 1-3 1-7-1-10-1-4-4-8-7-10-1-1-3-1-4-1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const PgvectorLogo = () => (
  <svg viewBox="0 0 64 64" className={ICON_CLASS} fill="none" aria-hidden>
    <path d="M10 32h44M32 10v44M16 16l32 32M48 16L16 48" stroke="currentColor" strokeWidth="2" />
    <circle cx="32" cy="32" r="4" fill="currentColor" />
  </svg>
);

const AnthropicLogo = () => (
  <svg viewBox="0 0 64 64" className={ICON_CLASS} fill="currentColor" aria-hidden>
    <path d="M22 12h7l13 40h-7l-3-9H19l-3 9H9l13-40zm1.5 25h11L29 21l-5.5 16z" />
  </svg>
);

const OpenAILogo = () => (
  <svg viewBox="0 0 64 64" className={ICON_CLASS} fill="none" aria-hidden>
    <path
      d="M32 8c-6 0-12 4-13 11-5 2-9 7-9 13s4 11 9 13c1 7 7 11 13 11s12-4 13-11c5-2 9-7 9-13s-4-11-9-13c-1-7-7-11-13-11zm0 6 14 8v16l-14 8-14-8V22l14-8z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M32 22v20M18 30l14 8 14-8" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const OllamaLogo = () => (
  <svg viewBox="0 0 64 64" className={ICON_CLASS} fill="none" aria-hidden>
    <ellipse cx="32" cy="40" rx="18" ry="14" stroke="currentColor" strokeWidth="2" />
    <circle cx="24" cy="22" r="6" stroke="currentColor" strokeWidth="2" />
    <circle cx="40" cy="22" r="6" stroke="currentColor" strokeWidth="2" />
    <circle cx="26" cy="38" r="2" fill="currentColor" />
    <circle cx="38" cy="38" r="2" fill="currentColor" />
  </svg>
);

const HonoLogo = () => (
  <svg viewBox="0 0 64 64" className={ICON_CLASS} fill="none" aria-hidden>
    <path
      d="M32 8c-2 10-12 14-12 26 0 11 6 22 12 22s12-11 12-22c0-12-10-16-12-26z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M32 26c-1 5-6 7-6 14 0 5 3 10 6 10s6-5 6-10c0-7-5-9-6-14z"
      fill="currentColor"
      fillOpacity="0.25"
    />
  </svg>
);

const NextLogo = () => (
  <svg viewBox="0 0 64 64" className={ICON_CLASS} fill="none" aria-hidden>
    <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="2" />
    <path d="M22 20v24M22 20l20 24M42 20v18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const GoLogo = () => (
  <svg viewBox="0 0 96 64" className={ICON_CLASS} fill="none" aria-hidden>
    <path
      d="M16 24h12M14 32h16M16 40h12"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M52 16c-9 0-16 7-16 16s7 16 16 16c5 0 9-2 12-5v-8H50v-3h17v13c-3 4-9 8-15 8-12 0-22-9-22-21s10-21 22-21c6 0 11 2 15 6l-2 2c-3-3-7-5-13-5z"
      fill="currentColor"
    />
  </svg>
);

const DockerLogo = () => (
  <svg viewBox="0 0 80 64" className={ICON_CLASS} fill="none" aria-hidden>
    <rect x="10" y="28" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
    <rect x="20" y="28" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
    <rect x="30" y="28" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
    <rect x="40" y="28" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
    <rect x="20" y="18" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
    <rect x="30" y="18" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
    <rect x="40" y="18" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
    <rect x="30" y="8" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M6 40c0 6 6 12 18 12h18c14 0 22-10 24-16-3 1-7 1-10 0-2 6-8 6-12 2"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const LOGOS: LogoSpec[] = [
  { name: "Postgres", Icon: PostgresLogo },
  { name: "pgvector", Icon: PgvectorLogo },
  { name: "Anthropic", Icon: AnthropicLogo },
  { name: "OpenAI", Icon: OpenAILogo },
  { name: "Ollama", Icon: OllamaLogo },
  { name: "Hono", Icon: HonoLogo },
  { name: "Next.js", Icon: NextLogo },
  { name: "Go", Icon: GoLogo },
  { name: "Docker", Icon: DockerLogo },
];

export function StackMarquee() {
  // The track holds the list twice end-to-end; animating -50% lands the
  // second copy exactly where the first started → seamless loop.
  return (
    <div
      className="relative overflow-hidden"
      // Soft fade on the edges so logos don't pop in/out abruptly.
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div className="flex w-max animate-marquee items-center gap-x-16 py-2 [&:hover]:[animation-play-state:paused]">
        {[...LOGOS, ...LOGOS].map(({ name, Icon }, i) => (
          <span
            key={`${name}-${i}`}
            className="group flex items-center"
            aria-label={name}
            title={name}
          >
            <Icon />
          </span>
        ))}
      </div>
    </div>
  );
}
