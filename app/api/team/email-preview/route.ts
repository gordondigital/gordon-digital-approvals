import { NextResponse } from "next/server";
import { getTeamUser } from "@/lib/team";
import { getTeamSettings } from "@/lib/data";
import { previewClientEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";

/** /api/team/email-preview?kind=ready (or updated, both, reminder) shows the client email as it will look from you. */
export async function GET(req: Request) {
  const me = await getTeamUser();
  if (!me) return NextResponse.json({ error: "Sign in to the portal first." }, { status: 401 });
  const team = await getTeamSettings();
  const people = ((team?.people as Record<string, { email?: string; title?: string; phone?: string }>) || {});
  const name = Object.keys(people).find((n) => (people[n].email || "").toLowerCase() === me.email.toLowerCase()) || me.name;
  const p = people[name] || {};
  const k = new URL(req.url).searchParams.get("kind");
  const kind = k === "reminder" || k === "updated" || k === "both" ? k : "ready";
  const html = previewClientEmail(kind, { name, email: me.email, title: p.title, phone: p.phone }, `${appUrl()}/r/example`);
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
