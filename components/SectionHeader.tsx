import Link from "next/link";
import type { ReactNode } from "react";

/** Title row for a content section, set like a newspaper section head: a
 * hairline above, a semibold title, an optional supporting line, and a
 * small "See all" link at the right. */
export default function SectionHeader({
  title,
  href,
  linkLabel = "See all",
  detail,
  rule = true,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  detail?: ReactNode;
  /** Off for the first section under a tab bar, which already draws a line. */
  rule?: boolean;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 ${rule ? "border-t border-line-strong pt-4" : ""}`}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {detail && <p className="text-sm tabular-nums text-ink-faint">{detail}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm text-ink-dim transition-colors hover:text-accent">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
