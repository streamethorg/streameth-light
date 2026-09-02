import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">Sign-in link didn&apos;t work</h1>
      <p className="text-sm text-ink-dim">
        That link may have expired or already been used. Request a new one.
      </p>
      <Link
        href="/signin"
        className="rounded-md border border-line px-4 py-2 text-sm text-ink-dim hover:bg-panel hover:text-ink"
      >
        Back to sign in
      </Link>
    </div>
  );
}
