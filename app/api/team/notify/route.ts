import { NextResponse } from "next/server";
import { getTeamUser } from "@/lib/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClient, reviewLinkFor, describeItems, strategistOf } from "@/lib/data";
import { logEvent } from "@/lib/reviewer";
import { brandApprovers, brandView, approverFirstName } from "@/lib/brands";
import { emails } from "@/lib/email";

/**
 * Called after the team sends work to a client. One email per brand per send, however many items.
 * Items for a brand go to that brand's approver with that brand's link; the rest to the client's approver.
 */
export async function POST(req: Request) {
  const me = await getTeamUser();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId || "");
  const ids: string[] = Array.isArray(body.itemIds) ? body.itemIds.map(String).slice(0, 200) : [];
  const client = await getClient(clientId);
  if (client?.archived) return NextResponse.json({ error: "This client is archived." }, { status: 400 });
  if (!client || !ids.length) return NextResponse.json({ error: "Nothing to send" }, { status: 400 });
  const { data } = await supabaseAdmin().from("items").select("id,data").eq("client_id", clientId).eq("status", "awaiting").in("id", ids);
  const items = (data || []).map((r) => r.data as Record<string, unknown>);
  if (!items.length) return NextResponse.json({ ok: true, sent: 0 });

  const groups = new Map<string, Record<string, unknown>[]>();
  items.forEach((x) => {
    const k = String(x.brandId || "");
    groups.set(k, [...(groups.get(k) || []), x]);
  });
  const from = await strategistOf(client);
  const allTo: string[] = [];
  const missing: string[] = [];
  let sentFrom = "";
  for (const [brandId, list] of groups) {
    const view = brandView(client, brandId || null);
    const to = brandApprovers(client, brandId || null);
    if (!to.length) {
      missing.push(String(view.name || "this client"));
      continue;
    }
    const link = await reviewLinkFor(clientId, me.email, brandId || null);
    const fresh = list.filter((x) => (Number(x.version) || 1) <= 1);
    const updated = list.filter((x) => (Number(x.version) || 1) > 1);
    sentFrom = await emails.batchReady(
      to,
      String(view.name || ""),
      fresh.length ? describeItems(client, fresh).what : "",
      updated.length ? describeItems(client, updated).what : "",
      describeItems(client, list).where,
      link,
      approverFirstName(client, brandId || null),
      from,
    );
    allTo.push(...to);
  }
  await logEvent({ client_id: clientId, type: "sent", actor_name: me.name, actor_email: me.email, meta: { items: ids, to: allTo } });
  const warning = missing.length ? `No approver email for ${missing.join(", ")}. Add one in client settings.` : undefined;
  return NextResponse.json({ ok: true, sent: items.length, to: allTo, from: sentFrom, warning });
}
