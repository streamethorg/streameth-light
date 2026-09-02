"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import SearchBar from "@/components/SearchBar";
import { initials } from "@/lib/format";
import type { DirectoryEntry } from "@/lib/directory";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/channels", label: "Channels" },
  { href: "/speakers", label: "Speakers" },
  { href: "/topics", label: "Topics" },
  { href: "/search", label: "Search everything" },
];

export default function AppShell({
  channels,
  children,
}: {
  channels: DirectoryEntry[];
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-void/95 px-3 py-2.5 backdrop-blur sm:gap-4 sm:px-4">
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          aria-label="Toggle navigation"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-dim hover:bg-panel lg:hidden"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M2.5 5.5h15a.75.75 0 000-1.5h-15a.75.75 0 000 1.5zm0 5.25h15a.75.75 0 000-1.5h-15a.75.75 0 000 1.5zm0 5.25h15a.75.75 0 000-1.5h-15a.75.75 0 000 1.5z" />
          </svg>
        </button>
        <Link href="/" className="shrink-0 text-base font-semibold tracking-tight text-ink sm:text-lg">
          StreamETH
        </Link>
        <Suspense fallback={<div className="h-9 w-full max-w-xl" />}>
          <SearchBar />
        </Suspense>
      </header>

      <div className="relative flex flex-1">
        {navOpen && (
          <button
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          />
        )}

        <aside
          className={`fixed bottom-0 left-0 top-[53px] z-20 w-64 shrink-0 overflow-y-auto border-r border-line bg-void p-3 transition-transform lg:sticky lg:top-[53px] lg:h-[calc(100vh-53px)] lg:translate-x-0 ${
            navOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="flex flex-col gap-0.5">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setNavOpen(false)}
                className="rounded-md px-2 py-1.5 text-sm font-medium text-ink-dim hover:bg-panel hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 border-t border-line pt-3">
            <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Channels
            </p>
            <div className="flex flex-col gap-0.5">
              {channels.map((entry) => (
                <Link
                  key={entry.slug}
                  href={`/${entry.slug}`}
                  onClick={() => setNavOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink-dim hover:bg-panel hover:text-ink"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panel text-[9px] font-medium text-ink-dim">
                    {initials(entry.name)}
                  </span>
                  <span className="truncate">{entry.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
