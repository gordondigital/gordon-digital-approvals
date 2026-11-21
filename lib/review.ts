import { NextResponse } from "next/server";
import { findLink, getReviewer, approverEmails, isTrusted } from "@/lib/reviewer";
import { getClient } from "@/lib/data";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Everything a review route needs: the link, the client and (if they've said who they are) the reviewer. */
export async function reviewContext(token: string, needReviewer = true) {
  const link = await findLink(token);
  if (!link) return { error: json({ error: "This review link isn't active. Ask Gordon Digital for a new one." }, 404) } as const;
  const client = await getClient(link.client_id);
  if (!client) return { error: json({ error: "Not found" }, 404) } as const;
  const reviewer = await getReviewer(link.client_id);
  if (needReviewer && !reviewer) return { error: json({ error: "Tell us who you are first." }, 401) } as const;
  return { link, client, reviewer, clientId: link.client_id } as const;
}

export async function approverState(clientId: string, client: Record<string, unknown>, email?: string | null) {
  const list = approverEmails(client);
  const e = (email || "").toLowerCase();
  // No approver set on the client yet: anyone on the link can approve once they confirm their email.
  const isApprover = !!e && (list.length === 0 || list.includes(e));
  const trusted = isApprover ? await isTrusted(clientId, e) : false;
  return { isApprover, trusted, approvers: list };
}

/** Same-origin check for state-changing requests from browsers. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host || origin === (process.env.APP_URL || "").replace(/\/$/, "");
  } catch {
    return false;
  }
}
