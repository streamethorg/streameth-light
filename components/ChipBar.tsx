import Link from "next/link";

/** YouTube's home chip bar: "All" plus the archive's biggest topics. Sticks
 * under the top bar and scrolls sideways when it overflows. */
export default function ChipBar({ topics, active }: { topics: string[]; active: string }) {
  const chips = [{ label: "All", value: "" }, ...topics.map((t) => ({ label: t, value: t }))];

  return (
    <div className="sticky top-14 z-30 bg-void/95 backdrop-blur">
      <div className="flex gap-3 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6">
        {chips.map((chip) => {
          const isActive = chip.value.toLowerCase() === active.toLowerCase();
          return (
            <Link
              key={chip.label}
              href={chip.value ? `/?topic=${encodeURIComponent(chip.value)}` : "/"}
              aria-current={isActive ? "page" : undefined}
              scroll={false}
              className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${
                isActive ? "bg-stage text-stage-ink" : "bg-panel-raised text-ink hover:bg-panel-hover"
              }`}
            >
              {chip.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
