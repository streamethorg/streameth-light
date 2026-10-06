import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AppShell from "@/components/AppShell";
import { topChannels } from "@/lib/videoDb";
import { SITE_NAME, SITE_URL } from "@/lib/social";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

const DESCRIPTION =
  "A read-only archive of the StreamETH video library — talks, panels and livestreams from Ethereum ecosystem events.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, absolute: SITE_NAME },
  description: DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DESCRIPTION,
  },
  // Lets iOS open the home-screen app full screen like Android's
  // `display: standalone` from app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-void text-ink">
        <AppShell channels={topChannels(8)}>{children}</AppShell>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
