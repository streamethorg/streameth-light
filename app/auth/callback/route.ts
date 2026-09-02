import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's free-tier default magic-link email links to its own hosted
// verify endpoint, which then redirects here with a PKCE `code` param —
// customizing the email template to hit our own /auth/confirm+token_hash
// route instead requires a paid plan or custom SMTP, so this exchanges the
// code for a session rather than verifying a token_hash directly.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
