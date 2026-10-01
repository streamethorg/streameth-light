import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lookupEnsName } from "@/lib/ens";
import { getUserAddress } from "@/lib/userAddress";
import { formatDateShort } from "@/lib/format";
import SignOutButton from "@/components/SignOutButton";

export const metadata = {
  title: "Settings — StreamETH Light",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/settings");
  }

  const address = getUserAddress(user);
  const [ensName, { count: savedCount }] = await Promise.all([
    address ? lookupEnsName(address) : Promise.resolve(null),
    supabase.from("saved_videos").select("video_id", { count: "exact", head: true }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Settings</h1>
        <p className="text-sm text-ink-dim">Your StreamETH account.</p>
      </header>

      <section className="flex flex-col gap-4 rounded-md border border-line bg-panel p-5">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">Wallet</h2>
        {address ? (
          <dl className="flex flex-col gap-3 text-sm">
            {ensName && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-ink-faint">ENS name</dt>
                <dd className="font-medium text-ink">{ensName}</dd>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-faint">Address</dt>
              <dd className="break-all font-mono text-ink">{address}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-faint">Member since</dt>
              <dd className="text-ink">{formatDateShort(user.created_at)}</dd>
            </div>
            <a
              href={`https://etherscan.io/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="w-fit font-mono text-xs text-ink-dim transition-colors hover:text-accent"
            >
              View on Etherscan ↗
            </a>
          </dl>
        ) : (
          <p className="text-sm text-ink-dim">
            This account isn&apos;t linked to a wallet. Sign out and sign in with your wallet to
            use StreamETH.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-line bg-panel p-5">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">Library</h2>
        <Link href="/saved" className="w-fit text-sm text-ink hover:text-accent">
          {savedCount ?? 0} saved {savedCount === 1 ? "video" : "videos"} →
        </Link>
      </section>

      <SignOutButton
        redirectTo="/"
        className="w-fit rounded-md border border-line px-4 py-2 text-sm text-ink-dim hover:bg-panel hover:text-ink"
      />
    </div>
  );
}
