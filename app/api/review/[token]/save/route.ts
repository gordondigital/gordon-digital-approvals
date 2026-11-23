import { reviewContext, json, approverState, sameOrigin } from "@/lib/review";
import { mergeClientItem, mergeClientRecord, forClient } from "@/lib/clientMerge";
import { getItem, saveItem, saveClientRow, teamEmailsFor } from "@/lib/data";
import { logEvent } from "@/lib/reviewer";
import { emails } from "@/lib/email";
import { appUrl } from "@/lib/env";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const { token } = await params;
  const ctx = await reviewContext(token);
  if ("error" in ctx) return ctx.error;
  const me = ctx.reviewer!;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Bad request" }, 400);
  const { kind, id, data } = body as { kind: string; id: string; data: Record<string, unknown> };
  if (!data || typeof data !== "object") return json({ error: "Bad request" }, 400);

  if (kind === "clients") {
    if (id !== ctx.clientId) return json({ error: "Not found" }, 404);
    const next = mergeClientRecord(ctx.client, data);
    await saveClientRow(ctx.clientId, next);
    await logEvent({ client_id: ctx.clientId, type: "brand_updated", actor_name: me.name, actor_email: me.email });
    return json({ ok: true });
  }
  if (kind !== "ads") return json({ error: "Not allowed" }, 403);

  const item = await getItem(String(id));
  if (!item || item.clientId !== ctx.clientId) return json({ error: "Not found" }, 404);
  const st = await approverState(ctx.clientId, ctx.client, me.email);
  if (String(data.status) === "approved" && item.status === "awaiting") {
    if (!st.isApprover) {
      const who = String(ctx.client.approverName || "your approver");
      return json({ error: `Only ${who} can approve. Leave a comment or request changes instead.`, code: "not_approver" }, 403);
    }
    if (!st.trusted) return json({ error: "Confirm it's you first.", needCode: true, email: me.email }, 409);
  }
  const { clientId: _c, ...current } = item;
  const res = mergeClientItem(current, data, { name: me.name, email: me.email }, { canApprove: st.isApprover && st.trusted });
  if ("error" in res) return json({ error: res.error }, res.status);
  if (!res.added && !res.transition) return json({ ok: true, data: forClient(current) });
  await saveItem(item.id as string, ctx.clientId, res.data);
  await logEvent({ client_id: ctx.clientId, item_id: String(item.id), type: res.transition || "comment", actor_name: me.name, actor_email: me.email, meta: { comments: res.added } });

  if (res.transition) {
    const to = await teamEmailsFor(ctx.client);
    const portal = `${appUrl()}/portal`;
    const what = res.transition === "approved" && res.data.withChanges ? "approvedWithChanges" : res.transition;
    await emails.teamUpdate(to, String(ctx.client.name || ""), String(item.title || "an item"), what, me.name, portal).catch((e) => console.error(e));
  }
  return json({ ok: true, data: forClient(res.data) });
}
