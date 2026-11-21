import { reviewContext, json, approverState } from "@/lib/review";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { forClient, clientRecordForClient } from "@/lib/clientMerge";
import { getTeamSettings } from "@/lib/data";

/** Everything this client can see: their record, items that have been sent to them, and their team's details. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await reviewContext(token);
  if ("error" in ctx) return ctx.error;
  const { data: rows, error } = await supabaseAdmin().from("items").select("id,data").eq("client_id", ctx.clientId).not("status", "in", "(draft,archived)");
  if (error) return json({ error: "Couldn't load your approvals." }, 500);
  const ads: Record<string, unknown> = {};
  (rows || []).forEach((r) => (ads[r.id] = { ...forClient(r.data as Record<string, unknown>), clientId: ctx.clientId }));
  const team = await getTeamSettings();
  const strategist = String(ctx.client.strategist || "");
  const people = ((team?.people as Record<string, unknown>) || {})[strategist];
  const st = await approverState(ctx.clientId, ctx.client, ctx.reviewer!.email);
  return json({
    clients: { [ctx.clientId]: clientRecordForClient(ctx.client) },
    ads,
    team: { strategists: strategist ? [strategist] : [], people: people ? { [strategist]: people } : {} },
    me: { id: ctx.reviewer!.email, name: ctx.reviewer!.name, email: ctx.reviewer!.email, ...st, approvers: undefined },
  });
}
