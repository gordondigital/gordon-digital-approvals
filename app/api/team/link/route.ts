import { NextResponse } from "next/server";
import { getTeamUser } from "@/lib/team";
import { getClient, reviewLinkFor } from "@/lib/data";
import { findBrand } from "@/lib/brands";

/** The client's private review link (made the first time it's asked for). */
export async function POST(req: Request) {
  const me = await getTeamUser();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { clientId, brandId } = await req.json().catch(() => ({}));
  const c = clientId ? await getClient(String(clientId)) : null;
  if (!c) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (brandId && !findBrand(c, brandId)) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  return NextResponse.json({ url: await reviewLinkFor(String(clientId), me.email, brandId ? String(brandId) : null) });
}
