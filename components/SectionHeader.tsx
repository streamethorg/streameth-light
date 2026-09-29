import Link from "next/link";
import type { ReactNode } from "react";

/** Title row for a content section: a bold sentence-case heading, an
 * optional short supporting line, and an optional link to the full list. */
export default function SectionHeader({
  title,
  href,
  linkLabel = "See all",
  detail,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  detail?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl">{title}</h2>
        {detail && <p className="text-sm text-ink-faint">{detail}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 rounded-sm text-[15px] font-semibold text-accent underline-offset-4 hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
