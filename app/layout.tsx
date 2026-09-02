import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";
import { getDirectory } from "@/lib/directory";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StreamETH Light",
  description:
    "A read-only archive of the StreamETH video library — talks, panels and livestreams from Ethereum ecosystem events.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const channels = [...getDirectory()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-ink">
        <AppShell channels={channels}>{children}</AppShell>
      </body>
    </html>
  );
}
