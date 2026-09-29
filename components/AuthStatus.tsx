"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

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
        className="shrink-0 whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-semibold text-stage transition-colors hover:bg-peach"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span title={`Signed in as ${email}`} className="hidden sm:flex">
        <Avatar name={email} className="h-8 w-8 text-[11px]" />
      </span>
      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          router.refresh();
        }}
        className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-stage-dim transition-colors hover:bg-white/10 hover:text-stage-ink"
      >
        Sign out
      </button>
    </div>
  );
}
