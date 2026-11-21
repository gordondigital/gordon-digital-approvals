import { NextResponse } from "next/server";
import { getTeamUser } from "@/lib/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkUpload, newKey } from "@/lib/media";

export async function POST(req: Request) {
  const me = await getTeamUser();
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const bad = checkUpload(String(body.type || ""), Number(body.size || 0));
  if (bad) return NextResponse.json({ code: bad }, { status: 400 });
  const key = newKey(body.clientId ? String(body.clientId) : null);
  const { data, error } = await supabaseAdmin().storage.from("media").createSignedUploadUrl(key);
  if (error || !data) return NextResponse.json({ error: "Upload isn't available right now." }, { status: 500 });
  return NextResponse.json({ key, token: data.token });
}
