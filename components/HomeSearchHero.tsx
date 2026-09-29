"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSuggestions from "@/components/SearchSuggestions";
import { useSearchSuggestions } from "@/lib/useSearchSuggestions";

/** The homepage's big search field, sitting on the dark stage hero. */
export default function HomeSearchHero() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLFormElement>(null);
  const suggestions = useSearchSuggestions(value, dropdownOpen);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <form
      ref={containerRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/?q=${encodeURIComponent(value.trim())}`);
      }}
      className="relative w-full"
    >
      <div className="flex w-full items-center gap-3 rounded-2xl bg-white py-2 pl-5 pr-2 shadow-[0_20px_60px_-20px_rgb(100_38_239/0.6)] ring-1 ring-white/20 transition-shadow focus-within:ring-4 focus-within:ring-accent/40">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="h-5 w-5 shrink-0 text-ink-faint"
        >
          <circle cx="9" cy="9" r="6.5" />
          <path d="M18 18l-4-4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={value}
          aria-label="Search talks"
          onFocus={() => setDropdownOpen(true)}
          onChange={(e) => {
            setValue(e.target.value);
            setDropdownOpen(true);
          }}
          placeholder="Search talks, speakers, topics"
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder:text-ink-faint focus:outline-none sm:text-lg"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-stage sm:px-5"
        >
          Search
        </button>
      </div>
      {dropdownOpen && (
        <SearchSuggestions results={suggestions} onSelect={() => setDropdownOpen(false)} />
      )}
    </form>
  );
}
