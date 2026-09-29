"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSuggestions from "@/components/SearchSuggestions";
import { useSearchSuggestions } from "@/lib/useSearchSuggestions";

/** The homepage's search, set as the page headline: the query is typed in
 * display-size type directly on the stage band, underlined by the logo
 * gradient — the search box *is* the hero, not a widget under a slogan. */
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
      <div className="flex items-end gap-4">
        <input
          type="search"
          value={value}
          aria-label="Search the archive"
          onFocus={() => setDropdownOpen(true)}
          onChange={(e) => {
            setValue(e.target.value);
            setDropdownOpen(true);
          }}
          placeholder="Search the archive"
          className="display min-w-0 flex-1 bg-transparent pb-3 text-[clamp(2.5rem,7vw,6.5rem)] text-stage-ink caret-peach placeholder:text-stage-ink/30 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          aria-label="Search"
          className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-stage transition-colors hover:bg-peach sm:h-16 sm:w-16"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6">
            <path d="M4 10h12m0 0l-5-5m5 5l-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="brand-gradient h-[3px] w-full rounded-full" />
      {dropdownOpen && (
        <div className="relative max-w-3xl">
          <SearchSuggestions results={suggestions} onSelect={() => setDropdownOpen(false)} />
        </div>
      )}
    </form>
  );
}
