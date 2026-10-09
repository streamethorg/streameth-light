import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/social";
import PageHero from "@/components/PageHero";
import McpConnect, { type McpTokenRow } from "@/components/McpConnect";

export const metadata = {
  title: "Connect to MCP — StreamETH",
  robots: { index: false },
};

export default async function ConnectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?next=/connect");
  }

  const { data: tokens, error } = await supabase
    .from("mcp_tokens")
    .select("id, name, token_hint, created_at, last_used_at")
    .order("created_at", { ascending: false });

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
        <McpConnect
          endpoint={new URL("/api/mcp", SITE_URL).toString()}
          tokens={(tokens ?? []) as McpTokenRow[]}
          loadFailed={Boolean(error)}
        />
      </div>
    </div>
  );
}
