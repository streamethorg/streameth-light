import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lookupEnsName } from "@/lib/ens";
import { getUserAddress, shortAddress } from "@/lib/userAddress";
import { formatDateShort } from "@/lib/format";
import PageHero from "@/components/PageHero";
import Avatar from "@/components/Avatar";
import SignOutButton from "@/components/SignOutButton";

export const metadata = {
  title: "Settings — StreamETH",
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
  const label = ensName ?? (address ? shortAddress(address) : "Your account");

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        leading={<Avatar name={label} channel className="h-16 w-16 text-lg sm:h-20 sm:w-20 sm:text-xl" />}
        title={label}
        meta={`Member since ${formatDateShort(user.created_at)}`}
        actions={
          <SignOutButton
            redirectTo="/"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40"
          />
        }
      />

      <div className="flex max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6">
        <section className="flex flex-col gap-3 rounded-2xl bg-panel p-5 ring-1 ring-line">
          <h2 className="text-base font-bold text-ink">Wallet</h2>
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
              <a
                href={`https://etherscan.io/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-sm font-medium text-accent hover:underline"
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

        <section className="flex flex-col gap-2 rounded-2xl bg-panel p-5 ring-1 ring-line">
          <h2 className="text-base font-bold text-ink">Library</h2>
          <Link href="/saved" className="w-fit text-sm font-medium text-accent hover:underline">
            {savedCount ?? 0} saved {savedCount === 1 ? "talk" : "talks"} →
          </Link>
        </section>
      </div>
    </div>
  );
}
