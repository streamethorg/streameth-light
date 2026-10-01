import type { User } from "@supabase/supabase-js";

export type Address = `0x${string}`;

// Supabase Web3 auth gives every wallet account an identity whose id is
// "web3:ethereum:<lowercased address>". Read the address from there, not from
// user_metadata.custom_claims — user_metadata is writable by the user via
// auth.updateUser(), identities are not.
const WEB3_IDENTITY_ID = /^web3:ethereum:(0x[0-9a-f]{40})$/;

export function getUserAddress(user: User | null | undefined): Address | null {
  for (const identity of user?.identities ?? []) {
    if (identity.provider !== "web3") continue;
    const match = WEB3_IDENTITY_ID.exec(identity.id);
    if (match) return match[1] as Address;
  }
  return null;
}

export function isAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
