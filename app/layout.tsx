import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";
import { LintButton } from "./lint-button";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Knowledge Base",
  description: "AI-powered knowledge base for your team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-black text-white font-mono">
        <nav className="border-b border-neutral-800 px-6 py-3 flex items-center gap-6">
          <span className="font-bold text-lg">KB2</span>
          <Link href="/" className="text-neutral-400 hover:text-white">
            Query
          </Link>
          <Link href="/ingest" className="text-neutral-400 hover:text-white">
            Ingest
          </Link>
          <Link href="/wiki" className="text-neutral-400 hover:text-white">
            Wiki
          </Link>
          <Link href="/manage" className="text-neutral-400 hover:text-white">
            Manage
          </Link>
          <LintButton />
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}
