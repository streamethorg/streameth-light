"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SearchSuggestions from "@/components/SearchSuggestions";
import { SearchIcon } from "@/components/NavIcons";
import { useSearchSuggestions } from "@/lib/useSearchSuggestions";

export default function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = pathname === "/" ? searchParams.get("q") ?? "" : "";
  const [value, setValue] = useState(urlValue);
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLFormElement>(null);
  const suggestions = useSearchSuggestions(value, dropdownOpen);

  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function push(nextValue: string) {
    const params = pathname === "/" ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
    if (nextValue.trim()) {
      params.set("q", nextValue);
    } else {
      params.delete("q");
    }
    params.delete("page");
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  return (
    <form
      ref={containerRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setDropdownOpen(false);
        push(value);
      }}
      className="relative flex w-full"
    >
      <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-panel-raised/60 px-3 transition-colors focus-within:border-accent focus-within:bg-void">
        <SearchIcon className="h-4 w-4 shrink-0 text-ink-faint" />
        <input
          type="search"
          value={value}
          autoFocus={autoFocus}
          aria-label="Search"
          placeholder="Search talks, speakers, topics"
          onFocus={() => setDropdownOpen(true)}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            setDropdownOpen(true);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => push(next), 250);
          }}
          className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>
      {dropdownOpen && (
        <SearchSuggestions results={suggestions} onSelect={() => setDropdownOpen(false)} />
      )}
    </form>
  );
}
