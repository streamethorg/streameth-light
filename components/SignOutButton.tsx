"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearCachedPages } from "@/lib/offline";

export default function SignOutButton({
  className,
  redirectTo,
}: {
  className: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await createClient().auth.signOut();
        await clearCachedPages().catch(() => {});
        if (redirectTo) router.replace(redirectTo);
        router.refresh();
        setBusy(false);
      }}
      className={`${className} disabled:opacity-60`}
    >
      Sign out
    </button>
  );
}
