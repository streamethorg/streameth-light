import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { accountName, accountPhoto } from "@/lib/account";
import { formatDateShort } from "@/lib/format";
import PageHero from "@/components/PageHero";
import Avatar from "@/components/Avatar";
import SignOutButton from "@/components/SignOutButton";

export const metadata = {
  title: "Settings — StreamETH",
  robots: { index: false },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/settings");
  }

  const { count: savedCount } = await supabase
    .from("saved_videos")
    .select("video_id", { count: "exact", head: true });
  const label = accountName(user);
  const providers: unknown = user.app_metadata?.providers;
  const viaGoogle = Array.isArray(providers) && providers.includes("google");

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        leading={<Avatar name={label} photo={accountPhoto(user)} channel className="h-16 w-16 text-lg sm:h-20 sm:w-20 sm:text-xl" />}
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
          <h2 className="text-base font-bold text-ink">Account</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-faint">Email</dt>
              <dd className="break-all font-medium text-ink">{user.email ?? "No email on this account"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-faint">Sign-in</dt>
              <dd className="text-ink">{viaGoogle ? "Google or email code" : "Email code"}</dd>
            </div>
          </dl>
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
