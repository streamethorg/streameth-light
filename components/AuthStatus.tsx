"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getUserAddress, shortAddress } from "@/lib/userAddress";
import { useEnsName } from "@/lib/useEnsName";
import Avatar from "@/components/Avatar";
import SignOutButton from "@/components/SignOutButton";

export default function AuthStatus() {
  const [supabase] = useState(() => createClient());
  // Keyed on the user, not their email — wallet accounts have an empty email.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const address = getUserAddress(user);
  const ensName = useEnsName(address);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  if (user === undefined) {
    return <div className="h-9 w-20 shrink-0" />;
  }

  if (!user) {
    return (
      <Link
        href="/signin"
        className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line pl-2 pr-3 text-sm font-semibold text-accent transition-colors hover:border-accent/20 hover:bg-accent/10"
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

  const label = ensName ?? (address ? shortAddress(address) : "Account");

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/settings"
        title={address ? `Signed in as ${address}` : "Account settings"}
        className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-panel-raised sm:pr-3"
      >
        <Avatar name={label} channel className="h-8 w-8 text-[11px]" />
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink-dim sm:block">
          {label}
        </span>
      </Link>
      {/* On phones the header only has room for the avatar; Sign out is on /settings. */}
      <SignOutButton className="hidden whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-ink-dim transition-colors hover:bg-panel-raised hover:text-ink sm:block" />
    </div>
  );
}
