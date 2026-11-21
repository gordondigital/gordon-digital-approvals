import { NextResponse } from "next/server";
import { getTeamUser } from "@/lib/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClient, reviewLinkFor, describeItems, strategistOf } from "@/lib/data";
import { approverEmails, logEvent } from "@/lib/reviewer";
import { emails } from "@/lib/email";

/** Called after the team sends work to a client. One email per send, however many items. */
export async function POST(req: Request) {
  const me = await getTeamUser();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId || "");
  const ids: string[] = Array.isArray(body.itemIds) ? body.itemIds.map(String).slice(0, 200) : [];
  const client = await getClient(clientId);
  if (!client || !ids.length) return NextResponse.json({ error: "Nothing to send" }, { status: 400 });
  const { data } = await supabaseAdmin().from("items").select("id,data").eq("client_id", clientId).eq("status", "awaiting").in("id", ids);
  const items = (data || []).map((r) => r.data as Record<string, unknown>);
  if (!items.length) return NextResponse.json({ ok: true, sent: 0 });
  const to = approverEmails(client);
  if (!to.length) return NextResponse.json({ ok: true, sent: 0, warning: "No approver email on this client. Add one in client settings." });
  const link = await reviewLinkFor(clientId, me.email);
  const d = describeItems(client, items);
  const first = String(client.approverName || "").split(" ")[0];
  const sentFrom = await emails.batchReady(to, String(client.name || ""), d.what, d.where, link, first, await strategistOf(client));
  await logEvent({ client_id: clientId, type: "sent", actor_name: me.name, actor_email: me.email, meta: { items: ids, to } });
  return NextResponse.json({ ok: true, sent: items.length, to, from: sentFrom });
}
