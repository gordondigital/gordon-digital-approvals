import { reviewContext, json, sameOrigin } from "@/lib/review";
import { setReviewer, logEvent } from "@/lib/reviewer";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const { token } = await params;
  const ctx = await reviewContext(token, false);
  if ("error" in ctx) return ctx.error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 80);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
  if (!name) return json({ error: "Add your name." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Add a valid email address." }, 400);
  await setReviewer({ name, email, clientId: ctx.clientId });
  await logEvent({ client_id: ctx.clientId, type: "reviewer_identified", actor_name: name, actor_email: email });
  return json({ ok: true });
}
