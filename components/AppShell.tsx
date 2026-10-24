"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import StreamethLogo from "@/components/StreamethLogo";
import AccountMenu from "@/components/AccountMenu";
import { DigestBanner, DigestForm } from "@/components/DigestSignup";
import PodcastPlayerProvider, { usePodcastPlayer } from "@/components/PodcastPlayerProvider";
import MiniPlayerBar from "@/components/MiniPlayerBar";
import OfflineSupport from "@/components/OfflineSupport";
import {
  BackIcon,
  BookmarkIcon,
  CalendarIcon,
  HomeIcon,
  SearchIcon,
  StoriesIcon,
} from "@/components/NavIcons";

// The top bar keeps to the two places people go; everything else is in the
// footer.
const NAV = [
  { href: "/events", label: "Events" },
  { href: "/stories", label: "Stories" },
];
const FOOTER_NAV = [
  ...NAV,
  { href: "/speakers", label: "Speakers" },
  { href: "/topics", label: "Topics" },
  { href: "/connect", label: "Connect with MCP" },
  { href: "/llms.txt", label: "llms.txt" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PodcastPlayerProvider>
      <AppBody>{children}</AppBody>
    </PodcastPlayerProvider>
  );
}

/** One compact bar, the same on every page: logo and section links on the
 * left; search and the account menu on the right. The weekly email lives in
 * the strip above it and the footer; MCP lives in the footer. Search
 * collapses to an icon on small screens; opening
 * it swaps the bar's contents for a full-width search field. Below md the
 * section links and search move to the tab bar at the bottom of the screen,
 * where a thumb can reach them. */
function AppBody({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { track } = usePodcastPlayer();
  const [searchOpen, setSearchOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the search field on navigation.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!searchOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <DigestBanner />
      <header className="sticky top-0 z-40 border-b border-line bg-void/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-2 px-4 sm:px-8">
          {searchOpen ? (
            <>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-dim hover:bg-panel-raised hover:text-ink"
              >
                <BackIcon className="h-5 w-5" />
              </button>
              <div className="mx-auto w-full max-w-2xl">
                <Suspense fallback={<div className="h-9 w-full" />}>
                  <SearchBar autoFocus />
                </Suspense>
              </div>
              <div className="w-9 shrink-0" aria-hidden="true" />
            </>
          ) : (
            <>
              <Link href="/" className="mr-2 flex shrink-0 items-center gap-2 rounded-sm sm:mr-5" aria-label="StreamETH home">
                <StreamethLogo className="h-6 w-auto" />
                <span className="text-base font-semibold tracking-[-0.02em] text-ink">StreamETH</span>
              </Link>

              <nav className="hidden items-center gap-0.5 md:flex" aria-label="Sections">
                {NAV.map(({ href, label }) => (
                  <NavLink key={href} href={href} label={label} active={isActive(pathname, href)} />
                ))}
              </nav>

              <div className="ml-auto flex items-center gap-1">
                <Suspense fallback={<SearchButton onClick={() => setSearchOpen(true)} />}>
                  <HeaderSearch onOpen={() => setSearchOpen(true)} />
                </Suspense>
                <div className="ml-1">
                  <AccountMenu />
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      <OfflineSupport />

      {/* Same max width as the top bar, so page content lines up with it. */}
      <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1">{children}</main>

      <SiteFooter clearPlayer={Boolean(track)} />

      <MiniPlayerBar />

      <TabBar pathname={pathname} searchOpen={searchOpen} onSearch={() => setSearchOpen(true)} />
    </div>
  );
}

// Search sits fourth, between the sections and Saved, as on most phone apps.
const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/events", label: "Events", Icon: CalendarIcon },
  { href: "/stories", label: "Stories", Icon: StoriesIcon },
  { href: null, label: "Search", Icon: SearchIcon },
  { href: "/saved", label: "Saved", Icon: BookmarkIcon },
] as const;

/** Phones only: the sections and search along the bottom edge, padded
 * clear of the home indicator. Search opens the top bar's search field. */
function TabBar({
  pathname,
  searchOpen,
  onSearch,
}: {
  pathname: string;
  searchOpen: boolean;
  onSearch: () => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-void/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="flex h-[var(--tabbar-h)] items-stretch px-[env(safe-area-inset-left)]">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            href === null ? searchOpen : !searchOpen && (href === "/" ? pathname === "/" : isActive(pathname, href));
          const className = `flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            active ? "text-accent" : "text-ink-dim active:text-ink"
          }`;
          const content = (
            <>
              <Icon filled={active} className="h-6 w-6" />
              {label}
            </>
          );
          return href === null ? (
            <button key={label} type="button" onClick={onSearch} aria-label="Search talks" className={className}>
              {content}
            </button>
          ) : (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Logo, the weekly email signup, every section link (including the ones
 * the top bar leaves out), and the year. Pads for the mini player when one
 * is open so nothing sits under it. */
function SiteFooter({ clearPlayer }: { clearPlayer: boolean }) {
  return (
    <footer className={`border-t border-line ${clearPlayer ? "pb-20" : ""}`}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-10 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <Link href="/" className="flex items-center gap-2 self-start rounded-sm" aria-label="StreamETH home">
            <StreamethLogo className="h-5 w-auto" />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">StreamETH</span>
          </Link>
          <p className="max-w-[36ch] text-sm text-ink-faint">Live coverage and recordings from Ethereum events.</p>
          <div id="digest" className="mt-3 flex max-w-sm scroll-mt-24 flex-col gap-2">
            <p className="text-sm font-semibold text-ink">New talks every Monday</p>
            <DigestForm tone="panel" />
          </div>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 text-sm sm:grid-cols-3 sm:gap-y-2" aria-label="Footer">
          {FOOTER_NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="py-2.5 text-ink-dim transition-colors hover:text-ink sm:py-0">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-8 text-[13px] text-ink-faint sm:px-8">
        © {new Date().getFullYear()} StreamETH
      </div>
    </footer>
  );
}

/** Inline search field on wide screens; on tablets, an icon that opens the
 * full-width field. Phones search from the tab bar. */
function HeaderSearch({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <div className="hidden w-[min(20rem,28vw)] lg:block">
        <SearchBar />
      </div>
      <div className="hidden md:block lg:hidden">
        <SearchButton onClick={onOpen} />
      </div>
    </>
  );
}

function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search talks"
      title="Search talks"
      className="flex h-9 w-9 items-center justify-center rounded-sm text-ink-dim hover:bg-panel-raised hover:text-ink"
    >
      <SearchIcon className="h-5 w-5" />
    </button>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap px-3 py-1.5 text-[15px] transition-colors ${
        active ? "text-ink" : "text-ink-dim hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
