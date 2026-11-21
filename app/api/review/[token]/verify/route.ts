import crypto from "node:crypto";
import { reviewContext, json, sameOrigin } from "@/lib/review";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addTrust, logEvent } from "@/lib/reviewer";
import { hashCode } from "@/lib/codes";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const { token } = await params;
  const ctx = await reviewContext(token);
  if ("error" in ctx) return ctx.error;
  const me = ctx.reviewer!;
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length !== 6) return json({ error: "Enter the 6 digit code from the email." }, 400);
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("approval_codes")
    .select("id,code_hash,expires_at,used_at,attempts")
    .eq("client_id", ctx.clientId)
    .eq("email", me.email)
    .is("used_at", null)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(5);
  const want = Buffer.from(hashCode(ctx.clientId, me.email, code));
  const hit = (data || []).find((r) => {
    const got = Buffer.from(String(r.code_hash));
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  });
  if (!hit) {
    // Three wrong guesses and the code stops working, so codes can't be guessed.
    const last = data?.[0];
    if (last) {
      const attempts = (Number(last.attempts) || 0) + 1;
      await sb.from("approval_codes").update({ attempts, used_at: attempts >= 3 ? new Date().toISOString() : null }).eq("id", last.id);
      if (attempts >= 3) return json({ error: "That code didn't match. Send a new code and try again." }, 400);
    }
    return json({ error: "That code didn't match. Check the email and try again." }, 400);
  }
  await sb.from("approval_codes").update({ used_at: new Date().toISOString() }).eq("id", hit.id);
  await addTrust(ctx.clientId, me.email);
  await logEvent({ client_id: ctx.clientId, type: "device_confirmed", actor_name: me.name, actor_email: me.email });
  return json({ ok: true });
}
