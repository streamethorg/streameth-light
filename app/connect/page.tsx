import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAddress } from "@/lib/userAddress";
import { SITE_URL } from "@/lib/social";
import PageHero from "@/components/PageHero";
import McpConnect, { type McpTokenRow } from "@/components/McpConnect";

export const metadata = {
  title: "Connect to MCP — StreamETH",
};

export default async function ConnectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/connect");
  }

  const hasWallet = Boolean(getUserAddress(user));
  const { data: tokens, error } = hasWallet
    ? await supabase
        .from("mcp_tokens")
        .select("id, name, token_hint, created_at, last_used_at")
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (error) {
    console.error("[connect] loading tokens failed:", error);
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        title="Connect to MCP"
        meta="Let Claude, Cursor and other AI apps search StreamETH talks and read their transcripts"
      />
      <div className="flex max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6">
        {hasWallet ? (
          <McpConnect
            endpoint={new URL("/api/mcp", SITE_URL).toString()}
            tokens={(tokens ?? []) as McpTokenRow[]}
            loadFailed={Boolean(error)}
          />
        ) : (
          <p className="rounded-2xl bg-panel p-5 text-sm text-ink-dim ring-1 ring-line">
            This account isn&apos;t linked to a wallet. Sign out and sign in with your wallet to
            connect AI apps.
          </p>
        )}
      </div>
    </div>
  );
}
