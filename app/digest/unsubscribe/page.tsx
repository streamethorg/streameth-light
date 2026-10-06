import type { Metadata } from "next";
import DigestTokenAction from "@/components/DigestTokenAction";
import { unsubscribe } from "@/lib/digest";

export const metadata: Metadata = { title: "Unsubscribe — StreamETH", robots: { index: false } };

async function unsubscribeAction(token: string) {
  "use server";
  return unsubscribe(token);
}

export default async function UnsubscribeDigestPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <DigestTokenAction
      token={token}
      action={unsubscribeAction}
      title="Unsubscribe from the weekly digest"
      body="You'll stop getting the Monday email of new talks."
      button="Unsubscribe"
      done="You're unsubscribed. You won't get any more digest emails."
    />
  );
}
