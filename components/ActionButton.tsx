/** Shared visual language for the small action buttons that sit around a
 * video (Save, Download, Show transcript, Listen, Switch to video), so they
 * read as one consistent button system instead of a mix of ad-hoc styles. */
export function actionButtonClass(active = false) {
  const base =
    "flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors";
  return active
    ? `${base} border-accent bg-accent/10 text-accent`
    : `${base} border-line text-ink-dim hover:bg-panel hover:text-ink`;
}

export function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return filled ? (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M5.5 2.5A1.5 1.5 0 004 4v13.5a.75.75 0 001.187.61L10 14.6l4.813 3.51A.75.75 0 0016 17.5V4a1.5 1.5 0 00-1.5-1.5h-9z" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path
        d="M5.5 3h9A1.5 1.5 0 0116 4.5v13l-6-4.375L4 17.5v-13A1.5 1.5 0 015.5 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="M10 3v9.5m0 0l-3.25-3.25M10 12.5l3.25-3.25M4 15.5h12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TranscriptIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path d="M4.5 5h11M4.5 10h11M4.5 15h7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
