import { NextResponse } from "next/server";
import { getTeamUser } from "@/lib/team";
import { getReviewer, hasAnyReviewer } from "@/lib/reviewer";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Files are private. The team can open anything; a reviewer can open their own client's files and team photos. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const parts = (await params).key || [];
  const key = parts.map(decodeURIComponent).join("/");
  if (!/^(c\/[A-Za-z0-9_-]+\/[a-f0-9]{16,64}|t\/[a-f0-9]{16,64})$/.test(key)) return new NextResponse("Not found", { status: 404 });
  let ok = !!(await getTeamUser());
  if (!ok) {
    if (key.startsWith("c/")) ok = !!(await getReviewer(key.split("/")[1]));
    else ok = await hasAnyReviewer();
  }
  if (!ok) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await supabaseAdmin().storage.from("media").createSignedUrl(key, 60 * 60);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, max-age=3000" } });
}
