"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { accountName, accountPhoto } from "@/lib/account";
import Avatar from "@/components/Avatar";
import SignOutButton from "@/components/SignOutButton";

const ITEMS = [
  { href: "/saved", label: "Saved talks" },
  { href: "/connect", label: "Connect with MCP" },
  { href: "/settings", label: "Settings" },
];

/** Everything about the signed-in user in one place: a "Sign in" button
 * when signed out; when signed in, the avatar opens a menu with saved
 * talks, AI (MCP) access, settings and sign out. */
export default function AccountMenu() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on navigation.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (user === undefined) {
    return <div className="h-9 w-20 shrink-0" />;
  }

  if (!user) {
    return (
      <Link
        href="/signin"
        className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line pl-2 pr-3 text-sm font-semibold text-accent transition-colors hover:border-accent/20 hover:bg-accent/10"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="10" r="3" />
          <path d="M6.5 18.2a6.5 6.5 0 0111 0" strokeLinecap="round" />
        </svg>
        Sign in
      </Link>
    );
  }

  const label = accountName(user);
  const photo = accountPhoto(user);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.email ? `Signed in as ${user.email}` : "Account"}
        className={`flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 transition-colors hover:bg-panel-raised ${
          open ? "bg-panel-raised" : ""
        }`}
      >
        <Avatar name={label} photo={photo} channel className="h-7 w-7 text-[10px]" />
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink sm:block">{label}</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 text-ink-faint" aria-hidden="true">
          <path d="M5.5 8l4.5 4.5L14.5 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-panel p-1.5 shadow-lg"
        >
          <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-1.5">
            <Avatar name={label} photo={photo} channel className="h-9 w-9 text-xs" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-ink">{label}</span>
              {user.email && user.email !== label && (
                <span className="truncate text-[11px] text-ink-faint">{user.email}</span>
              )}
            </div>
          </div>
          <div className="border-t border-line pt-1.5">
            {ITEMS.map(({ href, label: itemLabel }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-panel-raised ${
                    active ? "font-medium text-ink" : "text-ink-dim hover:text-ink"
                  }`}
                >
                  {itemLabel}
                </Link>
              );
            })}
          </div>
          <div className="mt-1.5 border-t border-line pt-1.5">
            <SignOutButton
              redirectTo="/"
              className="block w-full rounded-md px-2.5 py-2 text-left text-sm text-ink-dim transition-colors hover:bg-panel-raised hover:text-ink"
            />
          </div>
        </div>
      )}
    </div>
  );
}
