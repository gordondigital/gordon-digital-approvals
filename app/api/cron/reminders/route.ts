import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { workDays } from "@/lib/workdays";
import { logEvent } from "@/lib/reviewer";
import { reviewLinkFor, strategistOf } from "@/lib/data";
import { brandApprovers, brandView, approverFirstName } from "@/lib/brands";
import { emails } from "@/lib/email";

/**
 * Runs each weekday morning (see vercel.json). For each client (and each brand within it), if anything has
 * waited longer than the client's reminder setting (working days, default 3), send one reminder covering
 * everything waiting for that brand. Each item is chased again every further N working days.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) return new NextResponse("Unauthorised", { status: 401 });
  const sb = supabaseAdmin();
  const { data: items } = await sb.from("items").select("id,client_id,data").eq("status", "awaiting");
  const { data: clients } = await sb.from("clients").select("id,data");
  const { data: sent } = await sb.from("reminders").select("item_id,sent_for,sent_at");
  const cmap = new Map((clients || []).map((c) => [c.id, c.data as Record<string, unknown>]));
  const groups = new Map<string, { clientId: string; brandId: string | null; due: { id: string; sentAt: string }[]; waiting: number }>();
  for (const it of items || []) {
    const d = it.data as Record<string, unknown>;
    const c = cmap.get(it.client_id);
    if (!c || c.remindersOff || c.archived) continue;
    const brandId = (d.brandId as string) || null;
    const key = `${it.client_id}|${brandId || ""}`;
    const g = groups.get(key) || { clientId: it.client_id as string, brandId, due: [] as { id: string; sentAt: string }[], waiting: 0 };
    g.waiting++;
    const sentAt = String(d.sentAt || "");
    if (sentAt) {
      const every = Number(c.reminderDays) || 3;
      const prior = (sent || []).filter((r) => r.item_id === it.id && r.sent_for === sentAt).map((r) => r.sent_at).sort().pop();
      if (prior ? workDays(prior) >= every : workDays(sentAt) > every) g.due.push({ id: it.id, sentAt });
    }
    groups.set(key, g);
  }
  let emailsSent = 0;
  for (const g of groups.values()) {
    if (!g.due.length) continue;
    const c = cmap.get(g.clientId)!;
    const to = brandApprovers(c, g.brandId);
    if (!to.length) continue;
    await emails.reminder(to, String(brandView(c, g.brandId).name || ""), g.waiting, await reviewLinkFor(g.clientId, "reminders", g.brandId), approverFirstName(c, g.brandId), await strategistOf(c));
    await sb.from("reminders").upsert(g.due.map((x) => ({ item_id: x.id, sent_for: x.sentAt, sent_at: new Date().toISOString() })));
    await logEvent({ client_id: g.clientId, type: "auto_reminder", meta: { items: g.due.map((x) => x.id), to, brand: g.brandId } });
    emailsSent++;
  }
  return NextResponse.json({ ok: true, emailsSent });
}
