import { NextResponse } from "next/server";
import { lookupEnsName } from "@/lib/ens";
import { isAddress } from "@/lib/userAddress";

// Lets client components (the header's account button) show an ENS name
// without shipping an RPC URL to the browser.
export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address") ?? "";

  if (!isAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const name = await lookupEnsName(address);
  return NextResponse.json(
    { name },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
