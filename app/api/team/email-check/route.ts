import { NextResponse } from "next/server";
import { getTeamUser, isTeamEmail } from "@/lib/team";
import { gmailCheck } from "@/lib/gmail";

/**
 * Open /api/team/email-check while signed in to see whether client emails can go from your Gmail.
 * Add ?send=1 to also send yourself a test email through Gmail.
 */
export async function GET(req: Request) {
  const me = await getTeamUser();
  if (!me) return NextResponse.json({ error: "Sign in to the portal first." }, { status: 401 });
  const check = await gmailCheck(me.email);
  let testEmail: string | undefined;
  if (check.tokenOk && new URL(req.url).searchParams.get("send") === "1") {
    try {
      const { gmailSend } = await import("@/lib/gmail");
      await gmailSend({ name: me.name, email: me.email }, [me.email], "Approvals portal: Gmail test", "<p>Gmail sending works. Client emails will come from this address.</p>", "Gmail sending works. Client emails will come from this address.");
      testEmail = `Sent to ${me.email}. Check your inbox and Sent folder.`;
    } catch (e) {
      testEmail = `Send failed: ${(e as Error).message}`;
    }
  }
  return NextResponse.json(
    {
      you: me.email,
      teamAddress: isTeamEmail(me.email),
      gmail: check,
      testEmail,
      whatToDo: !check.configured
        ? "Add GOOGLE_SERVICE_ACCOUNT_JSON in Vercel (the whole .json key file), tick Production, then redeploy."
        : !check.tokenOk
          ? /unauthorized_client/.test(check.error || "")
            ? "Workspace Admin > Security > API controls > Domain Wide Delegation: the Client ID must be this service account's Unique ID and the scope exactly https://www.googleapis.com/auth/gmail.send. Changes can take up to an hour."
            : /invalid_grant/.test(check.error || "")
              ? "The key may be pasted wrong, or this address isn't a Workspace user. Paste the JSON key again and redeploy."
              : "See the error above."
          : "Gmail is ready. Add ?send=1 to the address to send yourself a test.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
