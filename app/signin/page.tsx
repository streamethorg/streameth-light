import { Suspense } from "react";
import SignInForm from "@/components/SignInForm";

export const metadata = {
  title: "Sign in — StreamETH",
  robots: { index: false },
};

/** Whether Google is switched on in Supabase Auth, so the button only shows
 * when it works. Re-checked every few minutes. */
async function googleEnabled(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch (err) {
    console.error("[signin] reading auth settings failed:", err);
    return false;
  }
}

export default async function SignInPage() {
  const google = await googleEnabled();
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="display text-5xl text-ink">Sign in</h1>
        <p className="text-[15px] text-ink-dim">
          Save talks, ask the archive and connect AI apps. No password: we email you a code.
        </p>
      </div>
      <Suspense fallback={null}>
        <SignInForm googleEnabled={google} />
      </Suspense>
    </div>
  );
}
