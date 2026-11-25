import { approverEmails } from "@/lib/reviewer";

/**
 * Brands within a client: franchisees, or separate brands with their own website and socials.
 * Each brand can have its own approver. Items carry brandId; no brandId = the client itself (head office).
 */
type Json = Record<string, unknown>;
export type Brand = { id: string; name?: string; logoId?: string; website?: string; ig?: string; landing?: string; approverName?: string; approverEmail?: string };

export const subBrands = (client: Json): Brand[] => (Array.isArray(client.brands) ? (client.brands as Brand[]) : []).filter((b) => b && b.id);
export const findBrand = (client: Json, id?: unknown): Brand | null => (id ? subBrands(client).find((b) => b.id === id) || null : null);

/** Who approves this brand's work: its own approvers, or the client's when it has none. */
export function brandApprovers(client: Json, brandId?: unknown): string[] {
  const b = findBrand(client, brandId);
  const own = b ? approverEmails(b as Json) : [];
  return own.length ? own : approverEmails(client);
}

/**
 * Who can approve, as seen through a link.
 * A brand link: that brand's approvers.
 * The client's own link (head office): the client's approvers can approve anything, plus each item's brand approvers.
 */
export function approversFor(client: Json, linkBrandId: string | null, item?: Json | null): string[] {
  if (linkBrandId) return brandApprovers(client, linkBrandId);
  const head = approverEmails(client);
  if (item) return Array.from(new Set([...head, ...brandApprovers(client, item.brandId)]));
  return Array.from(new Set([...head, ...subBrands(client).flatMap((b) => approverEmails(b as Json))]));
}

/** The client record as a brand's link shows it: the brand's name, logo, website and approver. */
export function brandView(client: Json, brandId: string | null): Json {
  const b = findBrand(client, brandId);
  if (!b) return client;
  const v: Json = { ...client };
  for (const k of ["name", "logoId", "website", "ig", "landing", "approverName", "approverEmail"] as const) if (b[k]) v[k] = b[k];
  v.brands = [b];
  v.brandOf = client.name;
  return v;
}

/** First name of whoever approves for this brand, for email greetings. */
export function approverFirstName(client: Json, brandId?: unknown): string {
  const b = findBrand(client, brandId);
  return String((b && b.approverName) || client.approverName || "").split(" ")[0];
}
