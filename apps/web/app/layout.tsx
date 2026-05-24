import "./globals.css";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://relaygh.dev"),
  title: {
    default: "Relay — the backend cloud for reliable AI agents",
    template: "%s · Relay",
  },
  description:
    "Memory, retries, tools, traces, and durable execution — without building orchestration infrastructure yourself.",
  keywords: [
    "ai agents",
    "ai infrastructure",
    "llm",
    "anthropic",
    "openai",
    "function calling",
    "agent memory",
    "open source",
    "relay",
  ],
  authors: [{ name: "Relay Contributors" }],
  creator: "Relay",
  openGraph: {
    type: "website",
    title: "Relay — the backend cloud for reliable AI agents",
    description:
      "Memory, retries, tools, traces, and durable execution — without building orchestration infrastructure yourself.",
    siteName: "Relay",
  },
  twitter: {
    card: "summary_large_image",
    title: "Relay — the backend cloud for reliable AI agents",
    description:
      "Memory, retries, tools, traces, and durable execution — without building orchestration infrastructure yourself.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased min-h-screen flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
