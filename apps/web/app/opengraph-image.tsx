import { ImageResponse } from "next/og";

export const alt = "Relay — the backend cloud for reliable AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#010410",
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.18), transparent 55%), radial-gradient(circle at 85% 75%, rgba(16,185,129,0.08), transparent 50%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#f1f5f9",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Top bar: logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width={36} height={36} viewBox="0 0 24 24">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34d399" />
                <stop offset="1" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <circle cx="4" cy="12" r="2.5" fill="url(#g)" />
            <circle cx="12" cy="6" r="2.5" fill="url(#g)" opacity="0.85" />
            <circle cx="20" cy="12" r="2.5" fill="url(#g)" opacity="0.7" />
            <path d="M5.5 11 L10.5 7 M13.5 7 L18.5 11" stroke="url(#g)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            relay
          </span>
        </div>

        {/* Main */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 14px",
              border: "1px solid rgba(52, 211, 153, 0.35)",
              background: "rgba(52, 211, 153, 0.08)",
              color: "#6ee7b7",
              fontSize: 18,
              borderRadius: 999,
              alignSelf: "flex-start",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 999, background: "#34d399" }} />
            Open source · Apache 2.0
          </div>
          <div
            style={{
              fontSize: 76,
              lineHeight: 1.05,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              maxWidth: 1040,
            }}
          >
            The backend cloud for reliable AI agents.
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.45,
              color: "#94a3b8",
              maxWidth: 980,
            }}
          >
            Memory, retries, tools, traces, and durable execution — without building orchestration infrastructure yourself.
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#64748b",
            fontSize: 20,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <span>npm i @relayhq/sdk</span>
          <span>github.com/KevinCorrea5103/relay</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
