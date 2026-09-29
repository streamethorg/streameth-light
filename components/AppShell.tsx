"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import SearchBar from "@/components/SearchBar";
import StreamethLogo from "@/components/StreamethLogo";
import AuthStatus from "@/components/AuthStatus";
import PodcastPlayerProvider, { usePodcastPlayer } from "@/components/PodcastPlayerProvider";
import MiniPlayerBar from "@/components/MiniPlayerBar";
import { filtersFromParams, isIdleFilters } from "@/lib/browseParams";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/channels", label: "Channels" },
  { href: "/speakers", label: "Speakers" },
  { href: "/topics", label: "Topics" },
  { href: "/saved", label: "Saved" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Header search — hidden only on the idle homepage, where the big hero
 * search already fills that role. On a results page (`/?q=…`) it stays so
 * the query can be refined without going back. On mobile it drops to its
 * own full-width row instead of squeezing between the logo and Sign in. */
function HeaderSearch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname === "/" && isIdleFilters(filtersFromParams(new URLSearchParams(searchParams.toString())))) {
    return null;
  }
  return (
    <div className="order-last w-full md:order-none md:w-auto md:max-w-xl md:flex-1">
      <SearchBar />
    </div>
  );
}

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
  const { track } = usePodcastPlayer();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex flex-col bg-stage text-stage-ink">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:gap-x-6 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md">
            <StreamethLogo className="h-7 w-auto" />
            <span className="display text-lg tracking-[-0.03em] text-stage-ink">StreamETH</span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative whitespace-nowrap py-1.5 text-sm font-medium transition-colors ${
                    active ? "text-stage-ink" : "text-stage-dim hover:text-stage-ink"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="brand-gradient absolute inset-x-0 -bottom-[13px] h-[3px] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          <Suspense fallback={null}>
            <HeaderSearch />
          </Suspense>

          <div className="ml-auto">
            <AuthStatus />
          </div>

          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={navOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stage-dim hover:bg-white/10 hover:text-stage-ink md:hidden"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M2.5 5.5h15a.75.75 0 000-1.5h-15a.75.75 0 000 1.5zm0 5.25h15a.75.75 0 000-1.5h-15a.75.75 0 000 1.5zm0 5.25h15a.75.75 0 000-1.5h-15a.75.75 0 000 1.5z" />
            </svg>
          </button>
        </div>

        {navOpen && (
          <nav className="flex flex-col gap-0.5 border-t border-stage-line px-3 py-2 md:hidden">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setNavOpen(false)}
                  className={`rounded-md px-3 py-2.5 text-[15px] font-medium ${
                    active ? "bg-white/10 text-stage-ink" : "text-stage-dim hover:bg-white/5 hover:text-stage-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className={`min-w-0 flex-1 ${track ? "pb-20" : ""}`}>{children}</main>

      <SiteFooter />

      <MiniPlayerBar />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-stage text-stage-dim">
      <div className="brand-gradient h-[3px] w-full" />
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex max-w-sm flex-col gap-3">
          <Link href="/" className="flex w-fit items-center gap-2.5 rounded-md">
            <StreamethLogo className="h-7 w-auto" />
            <span className="display text-lg tracking-[-0.03em] text-stage-ink">StreamETH</span>
          </Link>
          <p className="text-sm leading-relaxed">
            Talks, panels and workshops from Ethereum conferences and meetups, recorded and
            searchable in one place.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-stage-ink">
              {item.label}
            </Link>
          ))}
          <a href="https://streameth.org" className="hover:text-stage-ink">
            streameth.org
          </a>
        </nav>
      </div>
    </footer>
  );
}
