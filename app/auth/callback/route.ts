import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isTeamEmail } from "@/lib/team";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?e=auth", url.origin));
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?e=auth", url.origin));
  if (!isTeamEmail(data.user.email)) {
    await sb.auth.signOut();
    return NextResponse.redirect(new URL("/login?e=domain", url.origin));
  }
  return NextResponse.redirect(new URL("/portal", url.origin));
}
