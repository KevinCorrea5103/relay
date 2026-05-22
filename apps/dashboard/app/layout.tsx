import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Relay",
  description: "Cloud runtime for reliable AI agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-mono antialiased">
        <header className="border-b border-ink-800 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              <span className="text-ink-100">relay</span>
              <span className="ml-2 text-xs text-ink-400">/ runs</span>
            </Link>
            <span className="text-xs text-ink-500">
              cloud runtime for reliable AI agents
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
