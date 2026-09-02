"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    return <div className="h-9 w-16 shrink-0" />;
  }

  if (!email) {
    return (
      <Link
        href="/signin"
        className="shrink-0 whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-dim hover:bg-panel hover:text-ink"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/saved"
        className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-dim hover:bg-panel hover:text-ink"
      >
        Saved
      </Link>
      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          router.refresh();
        }}
        className="whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim hover:bg-panel hover:text-ink"
      >
        Sign out
      </button>
    </div>
  );
}
