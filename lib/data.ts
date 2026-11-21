import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";

type Json = Record<string, unknown>;

export async function getClient(id: string): Promise<Json | null> {
  const { data } = await supabaseAdmin().from("clients").select("id,data").eq("id", id).maybeSingle();
  return data ? { ...(data.data as Json), id: data.id } : null;
}

export async function getItem(id: string): Promise<(Json & { clientId: string }) | null> {
  const { data } = await supabaseAdmin().from("items").select("id,client_id,data").eq("id", id).maybeSingle();
  return data ? ({ ...(data.data as Json), id: data.id, clientId: data.client_id } as Json & { clientId: string }) : null;
}

export async function saveItem(id: string, clientId: string, data: Json) {
  // The portal finds items by data.clientId, so it must always be in the saved data.
  const d: Json = { ...data, clientId };
  delete d.id;
  const { error } = await supabaseAdmin().from("items").upsert({ id, client_id: clientId, data: d });
  if (error) throw error;
}

export async function saveClientRow(id: string, data: Json) {
  const d = { ...data };
  delete d.id;
  const { error } = await supabaseAdmin().from("clients").upsert({ id, data: d });
  if (error) throw error;
}

export async function getTeamSettings(): Promise<Json | null> {
  const { data } = await supabaseAdmin().from("settings").select("data").eq("id", "team").maybeSingle();
  return (data?.data as Json) || null;
}

/** The client's current review link, made if they don't have one yet. */
export async function reviewLinkFor(clientId: string, createdBy?: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("review_links").select("token").eq("client_id", clientId).is("revoked_at", null).order("created_at", { ascending: false }).limit(1);
  let token = data?.[0]?.token as string | undefined;
  if (!token) {
    token = crypto.randomBytes(24).toString("base64url");
    const { error } = await sb.from("review_links").insert({ token, client_id: clientId, created_by: createdBy || null });
    if (error) throw error;
  }
  return `${appUrl()}/r/${token}`;
}

/** The strategist on this client, with their details from the Team page. Client emails go out from them. */
export async function strategistOf(client: Json): Promise<{ name: string; email: string; title?: string; phone?: string } | null> {
  const s = String(client.strategist || "");
  if (!s) return null;
  const team = await getTeamSettings();
  const p = (((team?.people as Json) || {}) as Record<string, { email?: string; title?: string; phone?: string }>)[s] || {};
  return { name: s, email: String(p.email || "").trim().toLowerCase(), title: p.title, phone: p.phone };
}

/** Emails for the people at Gordon Digital who look after this client. */
export async function teamEmailsFor(client: Json): Promise<string[]> {
  const team = await getTeamSettings();
  const people = ((team?.people as Json) || {}) as Record<string, { email?: string }>;
  const s = String(client.strategist || "");
  const out = [people[s]?.email, process.env.EMAIL_REPLY_TO].filter((e): e is string => !!e && e.includes("@"));
  return Array.from(new Set(out.map((e) => e.toLowerCase())));
}

export const KIND_NOUNS: Record<string, [string, string]> = {
  meta: ["Meta ad", "Meta ads"],
  search: ["Google ad", "Google ads"],
  landing: ["landing page", "landing pages"],
  webpage: ["website page", "website pages"],
  seo: ["piece of content", "pieces of content"],
  social: ["social post", "social posts"],
};
export const kindOf = (x: Json) => String(x.kind || "meta");

function monthLabel(k: string) {
  const [y, m] = k.split("-").map(Number);
  if (!y || !m) return k;
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

export function folderName(client: Json, item: Json): string {
  const k = kindOf(item);
  if (k === "meta") return item.monthKey ? monthLabel(String(item.monthKey)) : "";
  const list = (((client.folders as Json) || {})[k] as Json[]) || [];
  const f = list.find((x) => x.id === item.folderId);
  return f ? String(f.name || "") : "";
}

/** "3 Meta ads and 1 organic social post", plus the folders they sit in. */
export function describeItems(client: Json, items: Json[]): { what: string; where: string; count: number } {
  const by: Record<string, number> = {};
  items.forEach((x) => (by[kindOf(x)] = (by[kindOf(x)] || 0) + 1));
  const parts = Object.keys(by).map((k) => {
    const [one, many] = KIND_NOUNS[k] || ["item", "items"];
    return `${by[k]} ${by[k] === 1 ? one : many}`;
  });
  const what = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0] || "Work";
  const where = Array.from(new Set(items.map((x) => folderName(client, x)).filter(Boolean))).join(", ");
  return { what, where, count: items.length };
}
