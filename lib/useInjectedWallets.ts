"use client";

import { useEffect, useState } from "react";
import type { EthereumWallet } from "@supabase/supabase-js";

// Supabase's EIP-1193 shape (request + on/removeListener), so a discovered
// provider can be handed straight to auth.signInWithWeb3.
export type EIP1193Provider = EthereumWallet;

export interface InjectedWallet {
  id: string;
  name: string;
  icon: string | null;
  provider: EIP1193Provider;
}

interface EIP6963AnnounceEvent extends Event {
  detail: {
    info: { uuid: string; name: string; icon: string; rdns: string };
    provider: EIP1193Provider;
  };
}

// Discovers browser wallets via EIP-6963 (each extension announces itself,
// so several installed wallets don't fight over window.ethereum). Falls back
// to window.ethereum for older wallets that don't announce. `null` until the
// first discovery pass has run, so callers can tell "none" from "not yet".
export function useInjectedWallets(): InjectedWallet[] | null {
  const [wallets, setWallets] = useState<InjectedWallet[] | null>(null);

  useEffect(() => {
    const found = new Map<string, InjectedWallet>();

    function onAnnounce(event: Event) {
      const { info, provider } = (event as EIP6963AnnounceEvent).detail;
      if (found.has(info.rdns)) return;
      found.set(info.rdns, { id: info.rdns, name: info.name, icon: info.icon || null, provider });
      setWallets([...found.values()]);
    }

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Announcements are synchronous responses to requestProvider, so by the
    // next tick every EIP-6963 wallet has spoken.
    const timer = window.setTimeout(() => {
      if (found.size === 0) {
        const legacy = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
        if (legacy && typeof legacy.request === "function" && typeof legacy.on === "function") {
          found.set("injected", { id: "injected", name: "Browser wallet", icon: null, provider: legacy });
        }
      }
      setWallets([...found.values()]);
    }, 50);

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      window.clearTimeout(timer);
    };
  }, []);

  return wallets;
}
