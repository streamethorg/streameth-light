import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppShell from "@/components/AppShell";
import { topChannels } from "@/lib/videoDb";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "StreamETH — every talk from the Ethereum stage",
  description:
    "Search and watch talks, panels and workshops from Ethereum conferences and meetups, down to the transcript.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-void text-ink">
        <AppShell channels={topChannels(8)}>{children}</AppShell>
      </body>
    </html>
  );
}
