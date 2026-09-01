import Link from "next/link";
import { listAllSessions } from "@/lib/data";
import { getDirectory } from "@/lib/directory";

const NAV = [
  { href: "/videos", label: "Archive", color: "var(--color-tag-cyan)" },
  { href: "/speakers", label: "Speakers", color: "var(--color-tag-yellow)" },
  { href: "/topics", label: "Topics", color: "var(--color-tag-magenta)" },
  { href: "/search", label: "Search", color: "var(--color-tag-green)" },
];

export default function SiteHeader() {
  const sessionCount = listAllSessions().length;
  const channelCount = getDirectory().length;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-void/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="on-air-dot h-2 w-2 rounded-full bg-accent" />
          <span className="font-display text-[15px] font-bold tracking-tight text-ink">
            STREAM<span className="text-accent">Ξ</span>TH
          </span>
          <span className="hidden rounded-sm border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-dim sm:inline">
            light
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group/nav relative px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-dim transition-colors hover:text-ink ${
                item.label === "Topics" || item.label === "Speakers" ? "hidden sm:block" : ""
              }`}
            >
              <span
                className="absolute inset-x-2.5 bottom-0.5 h-px scale-x-0 transition-transform duration-150 group-hover/nav:scale-x-100"
                style={{ background: item.color }}
              />
              {String(i + 1).padStart(2, "0")}·{item.label}
            </Link>
          ))}
          <span className="ml-3 hidden border-l border-line pl-3 font-mono text-[11px] tabular text-ink-faint md:inline">
            {sessionCount.toLocaleString()} sessions · {channelCount} channels
          </span>
        </nav>
      </div>
    </header>
  );
}
