import { Suspense } from "react";
import SignInForm from "@/components/SignInForm";

export const metadata = {
  title: "Sign in — StreamETH",
};

export default function SignInPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Sign in</h1>
        <p className="text-sm text-ink-dim">
          We&apos;ll email you a link — no password needed.
        </p>
      </div>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
