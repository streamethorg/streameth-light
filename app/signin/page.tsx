import { Suspense } from "react";
import SignInForm from "@/components/SignInForm";

export const metadata = {
  title: "Sign in — StreamETH",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="display text-5xl text-ink">Sign in</h1>
        <p className="text-[15px] text-ink-dim">
          Save talks to watch later. Sign a message with your Ethereum wallet — it&apos;s free, no
          transaction or gas.
        </p>
      </div>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
