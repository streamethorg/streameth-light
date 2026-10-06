import type { Metadata } from "next";
import DigestTokenAction from "@/components/DigestTokenAction";
import { confirmSubscription } from "@/lib/digest";

export const metadata: Metadata = { title: "Confirm digest — StreamETH", robots: { index: false } };

async function confirm(token: string) {
  "use server";
  return confirmSubscription(token);
}

/** Confirmation is a button, not a side effect of opening the link, so
 * mail scanners that prefetch links can't confirm on someone's behalf. */
export default async function ConfirmDigestPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <DigestTokenAction
      token={token}
      action={confirm}
      title="Confirm your weekly digest"
      body="One email every Monday with the new talks from Ethereum conferences and meetups."
      button="Confirm subscription"
      done="You're subscribed. The first digest arrives next Monday."
    />
  );
}
