import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppShell from "@/components/AppShell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StreamETH Light",
  description:
    "A read-only archive of the StreamETH video library — talks, panels and livestreams from Ethereum ecosystem events.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-void text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
