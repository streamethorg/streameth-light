"use client";

import { useEffect, useRef, useState } from "react";

export interface Suggestion {
  id: string;
  title: string;
  orgName: string;
  coverImage: string | null;
  durationSeconds: number | null;
  watchUrl: string;
}

/** Debounced fetch against /api/suggest — the dropdown shown under a search
 * box (like YouTube/Google's autocomplete), distinct from submitting the
 * query to the full filterable grid on `/`. */
export function useSearchSuggestions(query: string, open: boolean) {
  const [results, setResults] = useState<Suggestion[]>([]);
  const requestId = useRef(0);
  const q = query.trim();
  const active = open && q.length >= 2;

  useEffect(() => {
    if (!active) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          if (requestId.current === id) setResults(data.results ?? []);
        })
        .catch(() => {
          if (requestId.current === id) setResults([]);
        });
    }, 150);
    return () => clearTimeout(timer);
  }, [q, active]);

  return active ? results : [];
}
