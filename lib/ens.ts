import "server-only";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import type { Address } from "./userAddress";

const client = createPublicClient({
  chain: mainnet,
  // Falls back to viem's default public mainnet RPC when unset — fine for
  // dev, but rate-limited, so set ETH_RPC_URL in production.
  transport: http(process.env.ETH_RPC_URL || undefined, { timeout: 5_000 }),
});

const TTL_MS = 60 * 60 * 1000;
const cache = new Map<Address, { name: string | null; expires: number }>();

// Reverse-resolves an address to its primary ENS name (forward-verified by
// viem). Returns null when there's no name or the RPC fails — callers fall
// back to the short address, so a lookup failure never breaks a page.
export async function lookupEnsName(address: Address): Promise<string | null> {
  const key = address.toLowerCase() as Address;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.name;

  try {
    const name = await client.getEnsName({ address: key });
    cache.set(key, { name, expires: Date.now() + TTL_MS });
    return name;
  } catch (err) {
    console.error(`[ens] reverse lookup failed for ${key}:`, err);
    return null;
  }
}
