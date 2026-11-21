import { reviewContext, json, sameOrigin } from "@/lib/review";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkUpload, newKey } from "@/lib/media";

/** Clients can add files to their brand library. They get a one-time signed upload URL for a key under their client. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const { token } = await params;
  const ctx = await reviewContext(token);
  if ("error" in ctx) return ctx.error;
  const body = await req.json().catch(() => ({}));
  const bad = checkUpload(String(body.type || ""), Number(body.size || 0));
  if (bad) return json({ code: bad }, 400);
  const key = newKey(ctx.clientId);
  const { data, error } = await supabaseAdmin().storage.from("media").createSignedUploadUrl(key);
  if (error || !data) return json({ error: "Upload isn't available right now." }, 500);
  return json({ key, token: data.token });
}
