"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import SearchBar from "@/components/SearchBar";
import StreamethLogo from "@/components/StreamethLogo";
import AuthStatus from "@/components/AuthStatus";
import PodcastPlayerProvider, { usePodcastPlayer } from "@/components/PodcastPlayerProvider";
import MiniPlayerBar from "@/components/MiniPlayerBar";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/channels", label: "Channels" },
  { href: "/speakers", label: "Speakers" },
  { href: "/topics", label: "Topics" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PodcastPlayerProvider>
      <AppBody>{children}</AppBody>
    </PodcastPlayerProvider>
  );
}

function AppBody({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const isRoot = pathname === "/";
  const { track } = usePodcastPlayer();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex flex-col border-b border-line bg-void/95 backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <StreamethLogo className="h-6 w-auto" />
            <span className="font-display text-[15px] font-bold tracking-tight text-ink sm:text-base">
              StreamETH
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-dim hover:bg-panel hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {!isRoot && (
            <Suspense fallback={<div className="h-9 w-full max-w-xl" />}>
              <SearchBar />
            </Suspense>
          )}

          <div className={isRoot ? "ml-auto" : ""}>
            <AuthStatus />
          </div>

          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-dim hover:bg-panel md:hidden"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M2.5 5.5h15a.75.75 0 000-1.5h-15a.75.75 0 000 1.5zm0 5.25h15a.75.75 0 000-1.5h-15a.75.75 0 000 1.5zm0 5.25h15a.75.75 0 000-1.5h-15a.75.75 0 000 1.5z" />
            </svg>
          </button>
        </div>

        {navOpen && (
          <nav className="flex flex-col gap-0.5 border-t border-line px-3 py-2 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setNavOpen(false)}
                className="rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-dim hover:bg-panel hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className={`min-w-0 flex-1 ${track ? "pb-16" : ""}`}>{children}</main>

      <MiniPlayerBar />
    </div>
  );
}
