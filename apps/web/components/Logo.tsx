export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="relay-glow" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      {/* three nodes connected — relay/forwarding metaphor */}
      <circle cx="4" cy="12" r="2" fill="url(#relay-glow)" />
      <circle cx="12" cy="6" r="2" fill="url(#relay-glow)" opacity="0.85" />
      <circle cx="20" cy="12" r="2" fill="url(#relay-glow)" opacity="0.7" />
      <path
        d="M5.5 11 L10.5 7 M13.5 7 L18.5 11"
        stroke="url(#relay-glow)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="font-mono font-semibold tracking-tight text-ink-50">
        relay
      </span>
    </span>
  );
}
