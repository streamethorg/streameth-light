import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lookupEnsName } from "@/lib/ens";
import { getUserAddress, shortAddress } from "@/lib/userAddress";

export const metadata = {
  title: "Connect an app — StreamETH",
};

// Supabase Auth's OAuth server sends MCP clients (Claude, Cursor, …) here
// with an `authorization_id` once they've started an authorization request.
// The signed-in user approves or denies, and Supabase hands back the URL to
// return them to the client with a code (or an access_denied error).
async function decide(formData: FormData) {
  "use server";
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const approve = formData.get("decision") === "approve";

  const supabase = await createClient();
  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });

  if (error || !data) {
    redirect(`/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}&failed=1`);
  }
  redirect(data.redirect_url);
}

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const authorizationId = typeof params.authorization_id === "string" ? params.authorization_id : "";
  const failed = params.failed === "1";

  if (!authorizationId) {
    return <ConsentError message="This connection link is missing its authorization request. Start connecting again from your app." />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
  }

  // Accounts are wallets — a leftover email-only account can't connect apps.
  const address = getUserAddress(user);
  if (!address) {
    return <ConsentError message="This account isn't linked to a wallet. Sign out and sign in with your wallet, then connect again from your app." />;
  }

  const [{ data, error }, ensName] = await Promise.all([
    supabase.auth.oauth.getAuthorizationDetails(authorizationId),
    lookupEnsName(address),
  ]);

  if (error || !data) {
    return <ConsentError message="This connection request has expired or is no longer valid. Start connecting again from your app." />;
  }

  // Already approved this client before — send it straight back.
  if (!("authorization_id" in data)) {
    redirect(data.redirect_url);
  }

  const { client, scope } = data;
  const scopes = scope.split(" ").filter(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        {client.logo_uri ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party logo host
          <img src={client.logo_uri} alt="" className="h-14 w-14 rounded-xl object-contain ring-1 ring-line" />
        ) : null}
        <h1 className="display text-4xl text-ink">Connect {client.name || "this app"}</h1>
        <p className="text-[15px] text-ink-dim">
          {client.name || "This app"} wants to search the StreamETH archive and read transcripts as{" "}
          <span className="font-semibold text-ink" title={address}>
            {ensName ?? shortAddress(address)}
          </span>
          .
        </p>
        {client.uri ? (
          <a href={client.uri} target="_blank" rel="noreferrer" className="text-sm text-ink-faint underline">
            {client.uri}
          </a>
        ) : null}
      </div>

      {scopes.length > 0 && (
        <div className="w-full max-w-sm rounded-xl bg-panel px-4 py-3 text-sm text-ink-dim ring-1 ring-line">
          <p className="mb-1 font-semibold text-ink">Requested access</p>
          <ul className="list-inside list-disc">
            {scopes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <form action={decide} className="flex w-full max-w-sm flex-col gap-3">
        <input type="hidden" name="authorization_id" value={data.authorization_id} />
        <button
          type="submit"
          name="decision"
          value="approve"
          className="h-12 w-full rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-ink transition-colors hover:bg-stage"
        >
          Allow
        </button>
        <button
          type="submit"
          name="decision"
          value="deny"
          className="h-12 w-full rounded-xl bg-panel px-4 text-[15px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-panel-hover"
        >
          Deny
        </button>
        {failed && (
          <p className="text-sm text-error">Couldn&apos;t complete that. Try again, or restart connecting from your app.</p>
        )}
      </form>
    </div>
  );
}

function ConsentError({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="display text-4xl text-ink">Can&apos;t connect</h1>
      <p className="text-sm text-ink-dim">{message}</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-stage px-5 py-2.5 text-sm font-semibold text-stage-ink transition-colors hover:bg-accent"
      >
        Back to StreamETH
      </Link>
    </div>
  );
}
