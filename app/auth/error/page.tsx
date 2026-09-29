import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="display text-4xl text-ink">That link didn&apos;t work</h1>
      <p className="text-sm text-ink-dim">
        That link may have expired or already been used. Request a new one.
      </p>
      <Link
        href="/signin"
        className="mt-2 rounded-full bg-stage px-5 py-2.5 text-sm font-semibold text-stage-ink transition-colors hover:bg-accent"
      >
        Send a new link
      </Link>
    </div>
  );
}
