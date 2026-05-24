import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#020617",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#34d399" />
              <stop offset="1" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <circle cx="4" cy="12" r="2.5" fill="url(#g)" />
          <circle cx="12" cy="6" r="2.5" fill="url(#g)" opacity="0.85" />
          <circle cx="20" cy="12" r="2.5" fill="url(#g)" opacity="0.7" />
          <path
            d="M5.5 11 L10.5 7 M13.5 7 L18.5 11"
            stroke="url(#g)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
