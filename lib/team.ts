import { supabaseServer } from "@/lib/supabase/server";

export function isTeamEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  const domains = (process.env.TEAM_EMAIL_DOMAINS || "gordondigital.com.au").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  const emails = (process.env.TEAM_EMAILS || "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  return emails.includes(e) || domains.some((d) => e.endsWith("@" + d));
}

/** Returns the signed in team member, or null. */
export async function getTeamUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  const u = data.user;
  if (!u || !isTeamEmail(u.email)) return null;
  const name = (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || u.email || "Gordon Digital";
  return { id: u.id, email: u.email as string, name };
}
