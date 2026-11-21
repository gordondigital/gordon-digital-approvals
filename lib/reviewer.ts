import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Reviewer = { name: string; email: string; clientId: string; devices?: string[] };
const COOKIE = "gda_reviewer";
const TRUST = "gda_trust";
const key = () => new TextEncoder().encode(env("REVIEW_SECRET"));

export async function findLink(token: string) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const sb = supabaseAdmin();
  const { data } = await sb.from("review_links").select("token, client_id, revoked_at").eq("token", token).maybeSingle();
  if (!data || data.revoked_at) return null;
  return data as { token: string; client_id: string; revoked_at: string | null };
}

export async function setReviewer(r: Reviewer) {
  const jwt = await new SignJWT({ name: r.name, email: r.email.toLowerCase(), cid: r.clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(key());
  (await cookies()).set(COOKIE, jwt, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

export async function getReviewer(clientId: string): Promise<Reviewer | null> {
  const c = (await cookies()).get(COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, key());
    if (payload.cid !== clientId) return null;
    return { name: String(payload.name), email: String(payload.email), clientId };
  } catch {
    return null;
  }
}

/** Approvers for a client: comma separated emails in approverEmail. */
export function approverEmails(client: Record<string, unknown>): string[] {
  return String(client.approverEmail || "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

/** Has this browser confirmed an approval code for this approver? */
export async function isTrusted(clientId: string, email: string): Promise<boolean> {
  const c = (await cookies()).get(TRUST)?.value;
  if (!c) return false;
  try {
    const { payload } = await jwtVerify(c, key());
    const list = (payload.t as string[]) || [];
    return list.includes(`${clientId}:${email.toLowerCase()}`);
  } catch {
    return false;
  }
}

export async function addTrust(clientId: string, email: string) {
  const store = await cookies();
  let list: string[] = [];
  const c = store.get(TRUST)?.value;
  if (c) {
    try {
      list = ((await jwtVerify(c, key())).payload.t as string[]) || [];
    } catch {
      list = [];
    }
  }
  const k = `${clientId}:${email.toLowerCase()}`;
  if (!list.includes(k)) list.push(k);
  const jwt = await new SignJWT({ t: list.slice(-20) }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("365d").sign(key());
  store.set(TRUST, jwt, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function logEvent(e: { client_id?: string; item_id?: string; type: string; actor_name?: string; actor_email?: string; meta?: Record<string, unknown> }) {
  await supabaseAdmin().from("events").insert({ ...e, meta: e.meta || {} });
}

/** True when this browser has a valid reviewer cookie for any client. */
export async function hasAnyReviewer(): Promise<boolean> {
  const c = (await cookies()).get(COOKIE)?.value;
  if (!c) return false;
  try {
    await jwtVerify(c, key());
    return true;
  } catch {
    return false;
  }
}
