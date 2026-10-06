"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import SearchBar from "@/components/SearchBar";
import StreamethLogo from "@/components/StreamethLogo";
import AuthStatus from "@/components/AuthStatus";
import Avatar from "@/components/Avatar";
import PodcastPlayerProvider, { usePodcastPlayer } from "@/components/PodcastPlayerProvider";
import MiniPlayerBar from "@/components/MiniPlayerBar";
import OfflineSupport from "@/components/OfflineSupport";
import {
  BackIcon,
  ChannelsIcon,
  EventsIcon,
  HomeIcon,
  MenuIcon,
  SavedIcon,
  SearchIcon,
  SpeakersIcon,
  TopicsIcon,
} from "@/components/NavIcons";

type NavItem = { href: string; label: string; Icon: ComponentType<{ filled?: boolean; className?: string }> };

const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/events", label: "Events", Icon: EventsIcon },
  { href: "/channels", label: "Channels", Icon: ChannelsIcon },
  { href: "/speakers", label: "Speakers", Icon: SpeakersIcon },
  { href: "/topics", label: "Topics", Icon: TopicsIcon },
];
const YOU_NAV: NavItem[] = [{ href: "/saved", label: "Saved", Icon: SavedIcon }];

const RAIL_STORAGE_KEY = "streameth:sidebar-collapsed";
const RAIL_CHANGE_EVENT = "streameth:sidebar-collapsed-change";

// The collapsed/expanded guide is a per-viewer preference kept in
// localStorage; read through useSyncExternalStore so SSR renders expanded
// and the client picks up the stored choice without a mismatch.
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(RAIL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(RAIL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RAIL_CHANGE_EVENT, onChange);
  };
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(RAIL_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable (private mode etc.) — the event still updates
    // this tab, it just won't be remembered.
  }
  window.dispatchEvent(new Event(RAIL_CHANGE_EVENT));
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export type SidebarChannel = { slug: string; name: string };

export default function AppShell({
  channels,
  children,
}: {
  channels: SidebarChannel[];
  children: React.ReactNode;
}) {
  return (
    <PodcastPlayerProvider>
      <AppBody channels={channels}>{children}</AppBody>
    </PodcastPlayerProvider>
  );
}

/** YouTube's frame: a white top bar (menu, logo, centered search, account)
 * over a left sidebar. On wide screens the sidebar is a full guide that the
 * menu button collapses to an icon rail; on narrow screens and on watch
 * pages (where the "Up next" column needs the width) it's a drawer instead. */
function AppBody({ channels, children }: { channels: SidebarChannel[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const { track } = usePodcastPlayer();
  const isWatch = pathname.startsWith("/watch/") || /^\/[^/]+\/y\/[^/]+/.test(pathname);

  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the drawer and the mobile search on navigation.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
    setMobileSearch(false);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function toggleMenu() {
    // Below lg, or on a watch page, the menu button drives the drawer.
    if (isWatch || !window.matchMedia("(min-width: 1024px)").matches) {
      setDrawerOpen((v) => !v);
      return;
    }
    writeCollapsed(!collapsed);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-void/95 px-2 backdrop-blur sm:gap-4 sm:px-4">
        {mobileSearch ? (
          <>
            <button
              type="button"
              onClick={() => setMobileSearch(false)}
              aria-label="Close search"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-panel-raised"
            >
              <BackIcon />
            </button>
            <Suspense fallback={<div className="h-10 flex-1" />}>
              <SearchBar autoFocus />
            </Suspense>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-1 sm:gap-3">
              <button
                type="button"
                onClick={toggleMenu}
                aria-label="Menu"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-panel-raised"
              >
                <MenuIcon />
              </button>
              <Link href="/" className="flex items-center gap-2 rounded-md px-1" aria-label="StreamETH home">
                <StreamethLogo className="h-6 w-auto" />
                <span className="text-lg font-bold tracking-[-0.03em] text-ink">StreamETH</span>
              </Link>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center px-4 sm:flex">
              <Suspense fallback={<div className="h-10 w-full max-w-[640px]" />}>
                <SearchBar />
              </Suspense>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
              <button
                type="button"
                onClick={() => setMobileSearch(true)}
                aria-label="Search"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-panel-raised sm:hidden"
              >
                <SearchIcon className="h-6 w-6" />
              </button>
              <AuthStatus />
            </div>
          </>
        )}
      </header>

      <OfflineSupport />

      <div className="flex flex-1">
        {!isWatch && (
          <aside
            className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto overscroll-contain pb-6 [scrollbar-width:thin] lg:block ${
              collapsed ? "w-[76px] px-1" : "w-60 px-3"
            }`}
          >
            {collapsed ? <Rail pathname={pathname} /> : <Guide pathname={pathname} channels={channels} />}
          </aside>
        )}

        <main className={`min-w-0 flex-1 ${track ? "pb-20" : ""}`}>{children}</main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-void shadow-2xl">
            <div className="flex h-14 shrink-0 items-center gap-3 px-4">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-panel-raised"
              >
                <MenuIcon />
              </button>
              <Link href="/" className="flex items-center gap-2 rounded-md px-1">
                <StreamethLogo className="h-6 w-auto" />
                <span className="text-lg font-bold tracking-[-0.03em] text-ink">StreamETH</span>
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              <Guide pathname={pathname} channels={channels} />
            </div>
          </div>
        </div>
      )}

      <MiniPlayerBar />
    </div>
  );
}

function Guide({ pathname, channels }: { pathname: string; channels: SidebarChannel[] }) {
  return (
    <nav className="flex flex-col text-sm">
      <GuideSection items={PRIMARY_NAV} pathname={pathname} />
      <Divider />
      <p className="px-3 pb-1 pt-1 text-base font-semibold text-ink">You</p>
      <GuideSection items={YOU_NAV} pathname={pathname} />
      {channels.length > 0 && (
        <>
          <Divider />
          <p className="px-3 pb-1 pt-1 text-base font-semibold text-ink">Channels</p>
          {channels.map((c) => {
            const active = pathname === `/${c.slug}` || pathname.startsWith(`/${c.slug}/`);
            return (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                className={`flex h-10 items-center gap-4 rounded-lg px-3 ${
                  active ? "bg-panel-raised font-semibold text-ink" : "text-ink hover:bg-panel-raised"
                }`}
              >
                <Avatar name={c.name} channel className="h-6 w-6 text-[9px]" />
                <span className="truncate">{c.name}</span>
              </Link>
            );
          })}
          <Link
            href="/channels"
            className="flex h-10 items-center gap-4 rounded-lg px-3 text-ink hover:bg-panel-raised"
          >
            <span className="flex h-6 w-6 items-center justify-center">
              <ChannelsIcon className="h-5 w-5" />
            </span>
            All channels
          </Link>
        </>
      )}
      <Divider />
      <p className="px-3 text-xs leading-relaxed text-ink-faint">
        Talks from Ethereum conferences and meetups, by{" "}
        <a href="https://streameth.org" className="font-medium text-ink-dim hover:text-ink">
          StreamETH
        </a>
        .
      </p>
    </nav>
  );
}

function GuideSection({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <>
      {items.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center gap-5 rounded-lg px-3 ${
              active ? "bg-panel-raised font-semibold text-ink" : "text-ink hover:bg-panel-raised"
            }`}
          >
            <Icon filled={active} />
            {label}
          </Link>
        );
      })}
    </>
  );
}

function Rail({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1 pt-1">
      {[...PRIMARY_NAV, ...YOU_NAV].map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-1.5 rounded-lg py-4 text-[10px] text-ink hover:bg-panel-raised"
          >
            <Icon filled={active} />
            <span className={active ? "font-semibold" : ""}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Divider() {
  return <hr className="mx-3 my-3 border-line" />;
}
