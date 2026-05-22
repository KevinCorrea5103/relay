import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Relay — the cloud runtime for reliable AI agents",
  description:
    "Build, deploy and observe AI agents like you build apps. Multi-provider, persistent traces, semantic memory, custom tools, BYOK.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
