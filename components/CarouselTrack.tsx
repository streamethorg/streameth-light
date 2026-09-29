"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import SectionHeader from "@/components/SectionHeader";

/** Horizontal scroll track with prev/next buttons for pointer users (a
 * mouse wheel can't scroll sideways, so without these the off-screen cards
 * are effectively unreachable on desktop). Touch users just swipe; the
 * buttons are hidden below `sm` and whenever there's nothing to scroll to. */
export default function CarouselTrack({
  children,
  ...header
}: Omit<ComponentProps<typeof SectionHeader>, "action"> & {
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      observer.disconnect();
    };
  }, [updateEdges]);

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <SectionHeader
        {...header}
        action={
          <div className="hidden items-center gap-1.5 sm:flex">
            <ArrowButton label="Scroll back" disabled={!canPrev} onClick={() => scrollByPage(-1)}>
              <path d="M12.5 15l-5-5 5-5" />
            </ArrowButton>
            <ArrowButton label="Scroll forward" disabled={!canNext} onClick={() => scrollByPage(1)}>
              <path d="M7.5 5l5 5-5 5" />
            </ArrowButton>
          </div>
        }
      />
      <div
        ref={trackRef}
        className="-mx-4 flex snap-x gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6"
      >
        {children}
      </div>
    </div>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-panel text-ink shadow-sm ring-1 ring-line transition-colors enabled:hover:bg-stage enabled:hover:text-stage-ink enabled:hover:ring-stage disabled:cursor-default disabled:opacity-35"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        {children}
      </svg>
    </button>
  );
}
