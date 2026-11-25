import crypto from "node:crypto";
import { reviewContext, json, approverState, sameOrigin } from "@/lib/review";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { emails } from "@/lib/email";
import { hashCode } from "@/lib/codes";


/** Email a six digit code to the reviewer so they can approve on this device. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const { token } = await params;
  const ctx = await reviewContext(token);
  if ("error" in ctx) return ctx.error;
  const me = ctx.reviewer!;
  const st = await approverState(ctx.clientId, ctx.client, me.email, { brandId: ctx.brandId });
  if (!st.isApprover) return json({ error: "Only approvers can approve." }, 403);
  const sb = supabaseAdmin();
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await sb.from("approval_codes").select("id", { count: "exact", head: true }).eq("client_id", ctx.clientId).eq("email", me.email).gte("created_at", since);
  if ((count || 0) >= 5) return json({ error: "Too many codes. Wait 15 minutes and try again." }, 429);
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await sb.from("approval_codes").insert({ client_id: ctx.clientId, email: me.email, code_hash: hashCode(ctx.clientId, me.email, code), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  await emails.approvalCode(me.email, code, String(ctx.client.name || ""));
  return json({ ok: true, email: me.email });
}
