import Link from "next/link";
import type { ReactNode } from "react";

/** Page header: optional back link, an optional avatar, the name as the
 * page headline, a stats line, a short description, buttons, and an
 * optional tab strip underneath. Used by every browse/detail page. */
export default function PageHero({
  back,
  leading,
  title,
  description,
  meta,
  actions,
  tabs,
}: {
  back?: { href: string; label: string };
  leading?: ReactNode;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tabs?: { label: string; href: string; active: boolean }[];
}) {
  return (
    <section className="px-4 pt-6 sm:px-8 sm:pt-10">
      {back && (
        <Link
          href={back.href}
          className="mb-4 flex w-fit items-center gap-1 rounded-sm py-1 pr-3 text-sm font-medium text-ink-dim transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
            <path d="M12.5 15l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {back.label}
        </Link>
      )}
      {/* Avatar beside the name on every screen; on phones the description
          and buttons drop below at full width, on wider screens they stay
          in the column beside it. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:gap-x-6">
        {leading && <div className="row-span-1 sm:row-span-3 sm:self-center">{leading}</div>}
        <div className={`flex min-w-0 flex-col gap-1 ${leading ? "" : "col-span-2"}`}>
          <h1 className="headline text-[clamp(1.9rem,4vw,3.25rem)] text-ink">
            {title}
          </h1>
          {meta && <div className="text-sm tabular-nums text-ink-dim">{meta}</div>}
        </div>
        {description && (
          <div
            className={`col-span-2 line-clamp-2 max-w-[70ch] text-sm leading-relaxed text-ink-dim ${leading ? "sm:col-span-1 sm:col-start-2" : ""}`}
          >
            {description}
          </div>
        )}
        {actions && (
          <div className={`col-span-2 flex flex-wrap items-center gap-2 ${leading ? "sm:col-span-1 sm:col-start-2" : ""}`}>
            {actions}
          </div>
        )}
      </div>
      {tabs && tabs.length > 0 ? (
        <nav className="mt-6 flex gap-7 overflow-x-auto border-b border-line [scrollbar-width:none]">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 py-3 text-[15px] font-medium transition-colors ${
                tab.active ? "border-accent text-ink" : "border-transparent text-ink-dim hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : (
        <div className="mt-6" />
      )}
    </section>
  );
}

/** Button for a PageHero's actions row (website, YouTube, …). */
export function HeroLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  const external = /^https?:\/\//.test(href);
  const className = `flex h-9 items-center gap-1.5 rounded-sm border px-3.5 text-sm font-medium transition-colors ${
    primary ? "border-accent bg-accent text-accent-ink hover:opacity-90" : "border-line-strong text-ink hover:border-ink-faint"
  }`;
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M7 13l6-6M8 7h5v5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
