export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-mono">
          streameth<span className="text-accent">/</span>light — a read-only
          mirror of the public session archive.
        </p>
        <p className="font-mono tabular">
          <a
            href="https://streameth.org"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-ink-dim"
          >
            streameth.org
          </a>
        </p>
      </div>
    </footer>
  );
}
