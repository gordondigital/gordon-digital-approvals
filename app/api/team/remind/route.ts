import { NextResponse } from "next/server";
import { getTeamUser } from "@/lib/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClient, getItem, saveItem, reviewLinkFor, strategistOf } from "@/lib/data";
import { logEvent } from "@/lib/reviewer";
import { brandApprovers, brandView, approverFirstName } from "@/lib/brands";
import { emails } from "@/lib/email";

/** "Send a reminder" on an item: one email to its approver listing everything still waiting for that brand. */
export async function POST(req: Request) {
  const me = await getTeamUser();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { itemId } = await req.json().catch(() => ({}));
  const item = itemId ? await getItem(String(itemId)) : null;
  if (!item || item.status !== "awaiting") return NextResponse.json({ error: "That item isn't waiting on the client." }, { status: 400 });
  const client = await getClient(item.clientId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (client.archived) return NextResponse.json({ error: "This client is archived." }, { status: 400 });
  const brandId = (item.brandId as string) || null;
  const to = brandApprovers(client, brandId);
  if (!to.length) return NextResponse.json({ error: "Add an approver email in client settings first." }, { status: 400 });
  const { data } = await supabaseAdmin().from("items").select("id,data").eq("client_id", item.clientId).eq("status", "awaiting");
  const count = (data || []).filter((r) => ((r.data as Record<string, unknown>).brandId || null) === brandId).length;
  const sentFrom = await emails.reminder(to, String(brandView(client, brandId).name || ""), count || 1, await reviewLinkFor(item.clientId, me.email, brandId), approverFirstName(client, brandId), await strategistOf(client));
  const { clientId, ...rest } = item;
  await saveItem(String(item.id), clientId, { ...rest, reminded: true, remindedAt: new Date().toISOString() });
  await logEvent({ client_id: clientId, item_id: String(item.id), type: "reminder", actor_name: me.name, actor_email: me.email, meta: { to } });
  return NextResponse.json({ ok: true, sentTo: to.join(", "), from: sentFrom });
}
