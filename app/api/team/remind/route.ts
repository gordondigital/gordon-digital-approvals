import { NextResponse } from "next/server";
import { getTeamUser } from "@/lib/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClient, getItem, saveItem, reviewLinkFor } from "@/lib/data";
import { approverEmails, logEvent } from "@/lib/reviewer";
import { emails } from "@/lib/email";

/** "Send a reminder" on an item: one email listing everything still waiting for that client. */
export async function POST(req: Request) {
  const me = await getTeamUser();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { itemId } = await req.json().catch(() => ({}));
  const item = itemId ? await getItem(String(itemId)) : null;
  if (!item || item.status !== "awaiting") return NextResponse.json({ error: "That item isn't waiting on the client." }, { status: 400 });
  const client = await getClient(item.clientId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const to = approverEmails(client);
  if (!to.length) return NextResponse.json({ error: "Add an approver email in client settings first." }, { status: 400 });
  const { count } = await supabaseAdmin().from("items").select("id", { count: "exact", head: true }).eq("client_id", item.clientId).eq("status", "awaiting");
  await emails.reminder(to, String(client.name || ""), count || 1, await reviewLinkFor(item.clientId, me.email), String(client.approverName || "").split(" ")[0]);
  const { clientId, ...rest } = item;
  await saveItem(String(item.id), clientId, { ...rest, reminded: true, remindedAt: new Date().toISOString() });
  await logEvent({ client_id: clientId, item_id: String(item.id), type: "reminder", actor_name: me.name, actor_email: me.email, meta: { to } });
  return NextResponse.json({ ok: true, sentTo: to.join(", ") });
}
