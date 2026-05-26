import type { ReactNode } from "react";
import {
  siAnthropic,
  siDocker,
  siGo,
  siHono,
  siNextdotjs,
  siOllama,
  siPostgresql,
} from "simple-icons";

// ─── StackMarquee ──────────────────────────────────────────────────────────
//
// Infinite horizontal carousel of the stack we run on. Uses the official
// brand marks from the `simple-icons` package (CC0, community-maintained,
// the de-facto standard for tech-stack strips on landing pages).
//
// Two icons aren't in simple-icons and stay as small inline SVGs:
//   - OpenAI (simple-icons removed it over brand restrictions)
//   - pgvector (it's a Postgres extension, not its own brand)
//
// The track is the list duplicated end-to-end; we animate from
// translateX(0) to translateX(-50%) so the seam is invisible.

type LogoSpec = {
  name: string;
  path: string; // SVG path data
  color: string; // brand hex with leading #
  viewBox?: string; // simple-icons defaults to 24×24; overrides for custom marks
};

// Helper to read a simple-icons entry into our LogoSpec shape.
function fromSI(icon: {
  title: string;
  slug?: string;
  path: string;
  hex: string;
}): LogoSpec {
  return { name: icon.title, path: icon.path, color: `#${icon.hex}` };
}

// Custom marks for the two we can't pull from simple-icons.
// Kept abstract on purpose so they read as "this thing" without
// pretending to be the trademarked artwork.
const PGVECTOR: LogoSpec = {
  name: "pgvector",
  viewBox: "0 0 24 24",
  color: "#4169E1", // share Postgres blue — it's an extension
  path:
    "M12 2L12 22 M2 12L22 12 M5 5L19 19 M19 5L5 19 " +
    "M12 9.5A2.5 2.5 0 1 1 12 14.5A2.5 2.5 0 1 1 12 9.5Z",
};

const OPENAI: LogoSpec = {
  name: "OpenAI",
  viewBox: "0 0 24 24",
  color: "#10A37F", // OpenAI's brand green
  path:
    "M12 2c-3 0-5.5 2-6.3 5C3.2 7.8 1.5 10.3 1.5 13.2c0 2.4 1.2 4.5 3 5.7C5.2 21.5 7.4 23 10 23c3 0 5.5-2 6.3-5C18.8 17.2 20.5 14.7 20.5 11.8c0-2.4-1.2-4.5-3-5.7C16.8 4.5 14.6 3 12 3z" +
    "M9 9l3 1.8v3.6l3-1.8M9 9l3-1.8L15 9M9 9v3.6L12 14.4",
};

const LOGOS: LogoSpec[] = [
  fromSI(siPostgresql),
  PGVECTOR,
  fromSI(siAnthropic),
  OPENAI,
  fromSI(siOllama),
  fromSI(siHono),
  fromSI(siNextdotjs),
  fromSI(siGo),
  fromSI(siDocker),
];

// On a dark site, pure-black brands (Anthropic, Ollama, Next.js) read as
// invisible at idle. Lighten them slightly while keeping the rest of the
// brand colors faithful. Hover always reveals true brand color.
const NEAR_BLACK = new Set(["Anthropic", "Ollama", "Next.js"]);

function colorFor(spec: LogoSpec): string {
  return NEAR_BLACK.has(spec.name) ? "#cbd5e1" /* ink-300 */ : spec.color;
}

function Logo({ spec }: { spec: LogoSpec }): ReactNode {
  return (
    <span
      className="group flex items-center"
      title={spec.name}
      aria-label={spec.name}
    >
      <svg
        viewBox={spec.viewBox ?? "0 0 24 24"}
        className="h-7 w-auto opacity-80 transition-all group-hover:opacity-100 group-hover:scale-110"
        fill={colorFor(spec)}
        aria-hidden
        style={{
          // Hover swaps to true brand color even for the near-black overrides.
          transitionProperty: "fill, opacity, transform",
        }}
      >
        <path d={spec.path} />
      </svg>
    </span>
  );
}

export function StackMarquee() {
  // The track holds the list twice end-to-end; animating to -50% lands the
  // second copy exactly where the first started → seamless loop.
  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div className="flex w-max animate-marquee items-center gap-x-16 py-2 [&:hover]:[animation-play-state:paused]">
        {[...LOGOS, ...LOGOS].map((spec, i) => (
          <Logo key={`${spec.name}-${i}`} spec={spec} />
        ))}
      </div>
    </div>
  );
}
