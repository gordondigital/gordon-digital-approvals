"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export default function LoginButton() {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { hd: "gordondigital.com.au", prompt: "select_account" } },
    });
  };
  return (
    <button type="button" className="btn dark" style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }} onClick={go} disabled={busy}>
      {busy ? "Opening Google…" : "Sign in with Google"}
    </button>
  );
}
