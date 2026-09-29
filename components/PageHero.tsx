import Link from "next/link";
import type { ReactNode } from "react";

/** Title band for every browse/detail page (channel, event, speaker, topic,
 * the index pages): the same dark stage surface as the header and home
 * hero, with a softer version of its gradient light and the gradient edge
 * underneath. Keeps page openings consistent and on-brand. */
export default function PageHero({
  back,
  leading,
  title,
  description,
  meta,
  actions,
  width = "max-w-6xl",
}: {
  back?: { href: string; label: string };
  leading?: ReactNode;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  width?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-stage text-stage-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -bottom-2/3 left-[-5%] h-full w-1/2 rounded-full bg-accent/35 blur-[110px]" />
        <div className="absolute -bottom-2/3 right-0 h-full w-2/5 rounded-full bg-peach/20 blur-[110px]" />
      </div>
      <div className={`mx-auto flex w-full ${width} flex-col gap-5 px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-8`}>
        {back && (
          <Link
            href={back.href}
            className="flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-stage-dim transition-colors hover:text-stage-ink"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
              <path d="M12.5 15l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {back.label}
          </Link>
        )}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          {leading}
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="display text-[clamp(2.1rem,5vw,4rem)]">{title}</h1>
            {meta && <div className="text-sm font-medium text-stage-dim">{meta}</div>}
          </div>
        </div>
        {description && (
          <div className="max-w-[68ch] text-[15px] leading-relaxed text-stage-dim">{description}</div>
        )}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="brand-gradient h-[3px] w-full" />
    </section>
  );
}

/** Small pill link for a PageHero's actions row (website, YouTube, …). */
export function HeroLink({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:\/\//.test(href);
  const className =
    "flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-stage-ink ring-1 ring-inset ring-stage-line transition-colors hover:bg-white hover:text-stage";
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
