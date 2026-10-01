"use client";

import { useEffect, useState } from "react";

const resolved = new Map<string, string | null>();

// Client-side ENS name for an address via /api/ens, memoized for the life of
// the tab so the header doesn't refetch on every navigation.
export function useEnsName(address: string | null): string | null {
  const [name, setName] = useState<string | null>(() =>
    address ? resolved.get(address) ?? null : null
  );
  const [syncedAddress, setSyncedAddress] = useState(address);

  if (address !== syncedAddress) {
    setSyncedAddress(address);
    setName(address ? resolved.get(address) ?? null : null);
  }

  useEffect(() => {
    if (!address || resolved.has(address)) return;
    let active = true;
    fetch(`/api/ens?address=${address}`)
      .then((res) => (res.ok ? res.json() : { name: null }))
      .then((data: { name: string | null }) => {
        resolved.set(address, data.name);
        if (active) setName(data.name);
      })
      .catch(() => {
        // Leave unresolved so a later mount retries; the short address shows meanwhile.
      });
    return () => {
      active = false;
    };
  }, [address]);

  return name;
}
