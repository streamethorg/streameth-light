"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useInjectedWallets, type InjectedWallet } from "@/lib/useInjectedWallets";

type Status =
  | { kind: "idle" }
  | { kind: "connecting"; walletId: string }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

// Only same-origin paths — `next` comes from the URL, so "//evil.com" or
// "https://…" must not become a post-sign-in redirect.
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function isUserRejection(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 4001;
}

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const wallets = useInjectedWallets();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function signIn(wallet: InjectedWallet) {
    setStatus({ kind: "connecting", walletId: wallet.id });
    try {
      // Connect first ourselves: supabase-js turns a rejected connect into a
      // generic "method missing" error, which would read as a bug to the user.
      await wallet.provider.request({ method: "eth_requestAccounts" });

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithWeb3({
        chain: "ethereum",
        wallet: wallet.provider,
        statement: "Sign in to StreamETH.",
        // Pin mainnet in the signed message regardless of the network the
        // wallet happens to be on — the signature itself is chain-agnostic.
        options: { signInWithEthereum: { chainId: 1 } },
      });

      if (error) {
        console.error("[signin] web3 sign-in rejected by auth server:", error);
        setStatus({ kind: "error", message: "Couldn't sign you in — try again." });
        return;
      }

      router.replace(next);
      router.refresh();
    } catch (err) {
      if (isUserRejection(err)) {
        setStatus({ kind: "cancelled" });
        return;
      }
      console.error("[signin] wallet sign-in failed:", err);
      setStatus({ kind: "error", message: "Your wallet couldn't complete sign-in — try again." });
    }
  }

  if (wallets === null) {
    return <div className="h-12 w-full max-w-sm" />;
  }

  if (wallets.length === 0) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-ink-dim">
          No Ethereum wallet found in this browser.
        </p>
        <a
          href="https://ethereum.org/en/wallets/find-wallet/"
          target="_blank"
          rel="noreferrer"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-ink transition-colors hover:bg-stage"
        >
          Get a wallet ↗
        </a>
      </div>
    );
  }

  const busy = status.kind === "connecting";

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {wallets.map((wallet) => (
        <button
          key={wallet.id}
          type="button"
          onClick={() => signIn(wallet)}
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-semibold text-accent-ink transition-colors hover:bg-stage disabled:opacity-60"
        >
          {wallet.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wallet.icon} alt="" className="h-5 w-5 rounded" />
          )}
          {status.kind === "connecting" && status.walletId === wallet.id
            ? "Check your wallet…"
            : wallets.length === 1
              ? "Connect wallet"
              : `Connect ${wallet.name}`}
        </button>
      ))}
      {status.kind === "cancelled" && (
        <p className="text-center text-sm text-ink-faint">Signature cancelled.</p>
      )}
      {status.kind === "error" && (
        <p className="text-center text-sm text-error">{status.message}</p>
      )}
    </div>
  );
}
