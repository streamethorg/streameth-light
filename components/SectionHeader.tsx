import Link from "next/link";
import type { ReactNode } from "react";

/** Title row for a content section: a bold sentence-case heading, optional
 * leading visual (a channel logo), a short supporting line, and an optional
 * link to the full list. Replaces the tracked-out uppercase labels. */
export default function SectionHeader({
  title,
  href,
  linkLabel = "See all",
  leading,
  detail,
  action,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  leading?: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  const heading = (
    <h2 className="text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl">{title}</h2>
  );

  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="flex min-w-0 flex-col">
          {href ? (
            <Link href={href} className="w-fit rounded-md hover:text-accent [&>h2]:hover:text-accent">
              {heading}
            </Link>
          ) : (
            heading
          )}
          {detail && <p className="truncate text-sm text-ink-faint">{detail}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {href && (
          <Link
            href={href}
            className="hidden rounded-full px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 sm:block"
          >
            {linkLabel}
          </Link>
        )}
        {action}
      </div>
    </div>
  );
}
