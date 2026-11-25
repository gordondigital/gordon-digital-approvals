import { NextResponse } from "next/server";
import { getTeamUser } from "@/lib/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClient } from "@/lib/data";
import { logEvent } from "@/lib/reviewer";

/**
 * Offboarding.
 *   archive: switch off every review link for the client (the portal marks the client archived).
 *   delete:  remove the client, all their items, links and codes, and their files in Storage. Permanent.
 */
export async function POST(req: Request) {
  const me = await getTeamUser();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { clientId, action } = await req.json().catch(() => ({}));
  const id = String(clientId || "");
  const client = id ? await getClient(id) : null;
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const sb = supabaseAdmin();

  if (action === "archive") {
    const { error } = await sb.from("review_links").update({ revoked_at: new Date().toISOString() }).eq("client_id", id).is("revoked_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logEvent({ client_id: id, type: "client_archived", actor_name: me.name, actor_email: me.email });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (!client.archived) return NextResponse.json({ error: "Archive the client first." }, { status: 400 });
    // Files: everything under c/<clientId>/
    const prefix = `c/${id.replace(/[^A-Za-z0-9_-]/g, "")}`;
    for (let round = 0; round < 50; round++) {
      const { data: list, error } = await sb.storage.from("media").list(prefix, { limit: 1000 });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!list?.length) break;
      const { error: rmErr } = await sb.storage.from("media").remove(list.map((f) => `${prefix}/${f.name}`));
      if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 500 });
      if (list.length < 1000) break;
    }
    // Items, review links and approval codes go with the client (on delete cascade).
    const { error } = await sb.from("clients").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logEvent({ client_id: id, type: "client_deleted", actor_name: me.name, actor_email: me.email, meta: { name: client.name } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
