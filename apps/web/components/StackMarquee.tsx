// ─── StackMarquee ──────────────────────────────────────────────────────────
//
// Infinite horizontal carousel of the stack we run on.
//
// Why the math here is the way it is:
//
// The naive marquee (duplicate content once, translate 0 → -50%) breaks on
// wide viewports — when the animation finishes, the right side of the
// viewport can extend past the second copy, exposing the seam during the
// snap-back. You see it as the carousel "restarting" instead of looping.
//
// Robust fix: render the list FOUR times and animate from 0 to -25%. Math:
//   - At -25% (= -1 × content_width), the viewport sees copies 2-3-4.
//   - On snap-back to 0, the viewport sees copies 1-2-3 — which is visually
//     identical to copies 2-3-4 (same content, same gaps).
//   - As long as 3 × content_width ≥ viewport_width, the seam is invisible.
//     With 8 logos × ~110px + 64px gap = ~1400px per copy; 3 copies = 4200px
//     covers ultra-wide.
//
// All icons render as white via CSS filter regardless of their source color.

const LOGOS = [
  { name: "PostgreSQL", src: "/icons/postgresql.svg" },
  { name: "Anthropic", src: "/icons/anthropic-icon.svg" },
  { name: "OpenAI", src: "/icons/openai-icon.svg" },
  { name: "Python", src: "/icons/python.svg" },
  { name: "Deno", src: "/icons/deno.svg" },
  { name: "Next.js", src: "/icons/nextjs-icon.svg" },
  { name: "Go", src: "/icons/go.svg" },
  { name: "Docker", src: "/icons/docker-icon.svg" },
];

// Render the list this many times to guarantee a seamless loop on any
// viewport width. Animation target is -100% / COPIES.
const COPIES = 4;
const SHIFT_PERCENT = 100 / COPIES; // 25 → translateX(-25%)

export function StackMarquee() {
  const items = Array.from({ length: COPIES }).flatMap(() => LOGOS);

  return (
    <div
      className="relative overflow-hidden"
      // Soft fade on the edges so logos enter/exit smoothly instead of
      // popping at the viewport boundary.
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div
        // `animate-marquee` (not an inline `animation` style) so Tailwind
        // actually emits the @keyframes — it only generates the keyframe rule
        // when the matching utility class appears in the markup. The CSS var
        // still rides along inline to drive the shift distance.
        className="flex w-max animate-marquee items-center gap-x-16 py-2 [&:hover]:[animation-play-state:paused]"
        style={{
          ["--marquee-shift" as string]: `-${SHIFT_PERCENT}%`,
        }}
      >
        {items.map((logo, i) => (
          <span
            key={`${logo.name}-${i}`}
            className="group flex shrink-0 items-center"
            title={logo.name}
            aria-label={logo.name}
          >
            <img
              src={logo.src}
              alt=""
              aria-hidden
              draggable={false}
              className="h-8 w-auto select-none opacity-70 transition-opacity duration-200 group-hover:opacity-100"
              // brightness(0) crushes any source color to pure black;
              // invert(1) flips that to pure white. Works for both single-
              // and multi-color SVGs, preserves transparency.
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
