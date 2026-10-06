"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { clearCachedPages } from "@/lib/offline";

export default function AuthStatus() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  if (email === undefined) {
    return <div className="h-9 w-20 shrink-0" />;
  }

  if (!email) {
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

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span title={`Signed in as ${email}`} className="hidden sm:flex">
        <Avatar name={email} channel className="h-8 w-8 text-[11px]" />
      </span>
      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          await clearCachedPages().catch(() => {});
          router.refresh();
        }}
        className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-ink-dim transition-colors hover:bg-panel-raised hover:text-ink"
      >
        Sign out
      </button>
    </div>
  );
}
