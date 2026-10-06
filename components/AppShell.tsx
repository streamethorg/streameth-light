"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import StreamethLogo from "@/components/StreamethLogo";
import AccountMenu from "@/components/AccountMenu";
import { DigestBanner, SubscribeButton } from "@/components/DigestSignup";
import PodcastPlayerProvider, { usePodcastPlayer } from "@/components/PodcastPlayerProvider";
import MiniPlayerBar from "@/components/MiniPlayerBar";
import { BackIcon, CloseIcon, McpIcon, MenuIcon, SearchIcon } from "@/components/NavIcons";

const NAV = [
  { href: "/events", label: "Events" },
  { href: "/speakers", label: "Speakers" },
  { href: "/topics", label: "Topics" },
];
const MCP = { href: "/connect", label: "Connect with MCP" };

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

/** One compact bar: logo and section links on the left; search, the
 * "Connect with MCP" button and the account menu on the right. Search collapses to an icon on
 * small screens and on the home page (which has its own big bar); opening
 * it swaps the bar's contents for a full-width search field. Below md the
 * section links move into a menu. */
function AppBody({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { track } = usePodcastPlayer();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the search field and menu on navigation.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setSearchOpen(false);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!searchOpen && !menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen, menuOpen]);

  return (
    <div className="flex min-h-screen flex-col">
      <DigestBanner />
      <header className="sticky top-0 z-40 bg-void/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1760px] items-center gap-2 px-4 sm:px-6">
          {searchOpen ? (
            <>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-dim hover:bg-panel-raised hover:text-ink"
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
              <Link href="/" className="mr-3 flex shrink-0 items-center gap-2 rounded-md" aria-label="StreamETH home">
                <StreamethLogo className="h-6 w-auto" />
                <span className="text-base font-bold tracking-[-0.02em] text-ink">StreamETH</span>
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
                <SubscribeButton />
                <Link
                  href={MCP.href}
                  aria-current={isActive(pathname, MCP.href) ? "page" : undefined}
                  title="Connect StreamETH to Claude, ChatGPT or any MCP client"
                  className={`hidden h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors md:flex ${
                    isActive(pathname, MCP.href)
                      ? "border-accent/40 bg-accent/5 text-accent"
                      : "border-line text-ink hover:border-accent/40 hover:text-accent"
                  }`}
                >
                  <McpIcon className="h-4 w-4" />
                  {MCP.label}
                </Link>
                <div className="ml-1">
                  <AccountMenu />
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={menuOpen ? "Close menu" : "Menu"}
                  aria-expanded={menuOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-ink-dim hover:bg-panel-raised hover:text-ink md:hidden"
                >
                  {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
                </button>
              </div>
            </>
          )}
        </div>

        {menuOpen && !searchOpen && (
          <nav className="flex flex-col gap-0.5 px-3 pb-3 md:hidden" aria-label="Sections">
            {[...NAV, MCP].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(pathname, href) ? "bg-panel-raised text-ink" : "text-ink-dim hover:bg-panel-raised hover:text-ink"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Same max width as the top bar, so page content lines up with it. */}
      <main className={`mx-auto w-full min-w-0 max-w-[1760px] flex-1 ${track ? "pb-20" : ""}`}>{children}</main>

      <MiniPlayerBar />
    </div>
  );
}

/** Inline search field on wide screens, except on the home page before a
 * search, where the big centered bar already is — there (and on phones)
 * it's an icon that opens the full-width field. */
function HeaderSearch({ onOpen }: { onOpen: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const idleHome = pathname === "/" && [...searchParams.keys()].every((key) => key === "ask");

  return (
    <>
      {!idleHome && (
        <div className="hidden w-[min(20rem,28vw)] lg:block">
          <SearchBar />
        </div>
      )}
      <div className={idleHome ? "" : "lg:hidden"}>
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
      className="flex h-9 w-9 items-center justify-center rounded-md text-ink-dim hover:bg-panel-raised hover:text-ink"
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
      className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-panel-raised text-ink" : "text-ink-dim hover:bg-panel-raised hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
