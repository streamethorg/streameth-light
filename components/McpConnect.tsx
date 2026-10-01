"use client";

import { useState, useTransition } from "react";
import { createMcpToken, revokeMcpToken } from "@/app/connect/actions";
import { formatDateShort } from "@/lib/format";

export interface McpTokenRow {
  id: string;
  name: string;
  token_hint: string;
  created_at: string;
  last_used_at: string | null;
}

export default function McpConnect({
  endpoint,
  tokens,
  loadFailed,
}: {
  endpoint: string;
  tokens: McpTokenRow[];
  loadFailed: boolean;
}) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ token: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createMcpToken(name);
      if (result.ok) {
        setCreated({ token: result.token, name: result.name });
        setName("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      {created ? (
        <NewToken endpoint={endpoint} token={created.token} name={created.name} onDone={() => setCreated(null)} />
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl bg-panel p-5 ring-1 ring-line">
          <h2 className="text-base font-bold text-ink">New connection</h2>
          <p className="text-sm text-ink-dim">
            Creates a personal token for one AI app. Anyone with the token can use the archive as you,
            so keep it private and revoke it if it leaks.
          </p>
          <form onSubmit={connect} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="App name, e.g. Claude Code on my laptop"
              aria-label="App name"
              className="h-11 min-w-0 flex-1 rounded-xl bg-panel-raised px-4 text-sm text-ink ring-1 ring-line placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={pending}
              className="h-11 shrink-0 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink transition-colors hover:bg-stage disabled:opacity-60"
            >
              {pending ? "Creating…" : "Connect to MCP"}
            </button>
          </form>
          {error && <p className="text-sm text-error">{error}</p>}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl bg-panel p-5 ring-1 ring-line">
        <h2 className="text-base font-bold text-ink">Connected apps</h2>
        {loadFailed ? (
          <p className="text-sm text-error">Couldn&apos;t load your tokens. Refresh to try again.</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-ink-dim">No apps connected yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {tokens.map((t) => (
              <TokenItem key={t.id} token={t} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function NewToken({
  endpoint,
  token,
  name,
  onDone,
}: {
  endpoint: string;
  token: string;
  name: string;
  onDone: () => void;
}) {
  const claudeCode = `claude mcp add --transport http streameth ${endpoint} --header "Authorization: Bearer ${token}"`;
  const json = JSON.stringify(
    { mcpServers: { streameth: { url: endpoint, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2
  );

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-panel p-5 ring-2 ring-accent">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-ink">Token for {name}</h2>
        <p className="text-sm text-ink-dim">
          Copy it now. It won&apos;t be shown again; if you lose it, revoke it and create a new one.
        </p>
      </div>
      <CopyBlock label="Token" value={token} />
      <CopyBlock label="Claude Code: run in a terminal" value={claudeCode} />
      <CopyBlock label="Cursor and other apps: add to your MCP config (e.g. ~/.cursor/mcp.json)" value={json} />
      <button
        type="button"
        onClick={onDone}
        className="h-10 w-fit rounded-full bg-panel-raised px-5 text-sm font-semibold text-ink transition-colors hover:bg-panel-hover"
      >
        Done
      </button>
    </section>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions, insecure context) — the text
      // is selectable, so the user can still copy it by hand.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-faint">{label}</span>
        <button type="button" onClick={copy} className="text-xs font-semibold text-accent hover:underline">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="select-all overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-panel-raised p-3 font-mono text-xs text-ink ring-1 ring-line">
        {value}
      </pre>
    </div>
  );
}

function TokenItem({ token }: { token: McpTokenRow }) {
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function revoke() {
    setFailed(false);
    startTransition(async () => {
      const { ok } = await revokeMcpToken(token.id);
      if (!ok) {
        setFailed(true);
        setConfirming(false);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{token.name}</span>
        <span className="text-xs text-ink-faint">
          <span className="font-mono">smcp_…{token.token_hint}</span> · Created {formatDateShort(token.created_at)} ·{" "}
          {token.last_used_at ? `Last used ${formatDateShort(token.last_used_at)}` : "Never used"}
        </span>
        {failed && <span className="text-xs text-error">Couldn&apos;t revoke. Try again.</span>}
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={revoke}
            disabled={pending}
            className="h-8 rounded-full bg-error px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Revoking…" : "Revoke"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="h-8 rounded-full px-3 text-xs font-semibold text-ink-dim hover:bg-panel-raised"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-8 rounded-full bg-panel-raised px-3 text-xs font-semibold text-ink transition-colors hover:bg-panel-hover"
        >
          Revoke
        </button>
      )}
    </li>
  );
}
