import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { workDays } from "@/lib/workdays";
import { approverEmails, logEvent } from "@/lib/reviewer";
import { reviewLinkFor, strategistOf } from "@/lib/data";
import { emails } from "@/lib/email";

/**
 * Runs each weekday morning (see vercel.json). For each client, if anything has waited longer than
 * their reminder setting (working days, default 3), send one reminder email covering everything waiting.
 * Each item is chased at most once per send, and again every further N working days.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) return new NextResponse("Unauthorised", { status: 401 });
  const sb = supabaseAdmin();
  const { data: items } = await sb.from("items").select("id,client_id,data").eq("status", "awaiting");
  const { data: clients } = await sb.from("clients").select("id,data");
  const { data: sent } = await sb.from("reminders").select("item_id,sent_for,sent_at");
  const cmap = new Map((clients || []).map((c) => [c.id, c.data as Record<string, unknown>]));
  const byClient = new Map<string, { id: string; sentAt: string }[]>();
  for (const it of items || []) {
    const d = it.data as Record<string, unknown>;
    const sentAt = String(d.sentAt || "");
    if (!sentAt) continue;
    const c = cmap.get(it.client_id);
    if (!c || c.remindersOff) continue;
    const every = Number(c.reminderDays) || 3;
    const prior = (sent || []).filter((r) => r.item_id === it.id && r.sent_for === sentAt).map((r) => r.sent_at).sort().pop();
    const due = prior ? workDays(prior) >= every : workDays(sentAt) > every;
    if (due) byClient.set(it.client_id, [...(byClient.get(it.client_id) || []), { id: it.id, sentAt }]);
  }
  let emailsSent = 0;
  for (const [clientId, list] of byClient) {
    const c = cmap.get(clientId)!;
    const to = approverEmails(c);
    if (!to.length) continue;
    const waiting = (items || []).filter((i) => i.client_id === clientId).length;
    await emails.reminder(to, String(c.name || ""), waiting, await reviewLinkFor(clientId, "reminders"), String(c.approverName || "").split(" ")[0], await strategistOf(c));
    await sb.from("reminders").upsert(list.map((x) => ({ item_id: x.id, sent_for: x.sentAt, sent_at: new Date().toISOString() })));
    await logEvent({ client_id: clientId, type: "auto_reminder", meta: { items: list.map((x) => x.id), to } });
    emailsSent++;
  }
  return NextResponse.json({ ok: true, emailsSent });
}
