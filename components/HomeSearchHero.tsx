"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import StreamethLogo from "@/components/StreamethLogo";

export default function HomeSearchHero() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/?q=${encodeURIComponent(value)}`);
      }}
      className="flex w-full max-w-xl flex-col items-center gap-6"
    >
      <div className="flex items-center gap-2.5">
        <StreamethLogo className="h-8 w-auto" />
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          StreamETH
        </h1>
      </div>
      <div className="flex w-full items-center gap-3 rounded-full border border-line bg-panel px-5 py-3.5 shadow-sm transition-shadow focus-within:border-accent focus-within:shadow-[0_0_0_3px_hsl(250_75%_45%/0.15)]">
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
          autoFocus
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search talks, speakers, topics..."
          className="w-full bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>
      <p className="font-mono text-xs text-ink-faint">
        Every talk, panel and livestream from the Ethereum events world.
      </p>
    </form>
  );
}
