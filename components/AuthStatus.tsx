"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getUserAddress, shortAddress } from "@/lib/userAddress";
import { useEnsName } from "@/lib/useEnsName";
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
    return <div className="h-9 w-16 shrink-0" />;
  }

  if (!user) {
    return (
      <Link
        href="/signin"
        className="shrink-0 whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-dim hover:bg-panel hover:text-ink"
      >
        Sign in
      </Link>
    );
  }

  const label = ensName ?? (address ? shortAddress(address) : "Account");

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/saved"
        className="hidden whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-dim hover:bg-panel hover:text-ink sm:block"
      >
        Saved
      </Link>
      <Link
        href="/settings"
        title={address ?? undefined}
        className="max-w-[10rem] truncate whitespace-nowrap rounded-md px-2.5 py-1.5 font-mono text-sm text-ink-dim hover:bg-panel hover:text-ink"
      >
        {label}
      </Link>
      {/* On phones the header only has room for the account link; Saved is in
          the nav drawer and Sign out is on /settings. */}
      <SignOutButton className="hidden whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim hover:bg-panel hover:text-ink sm:block" />
    </div>
  );
}
