import { Resend } from "resend";
import { appUrl } from "@/lib/env";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#fafcfb;font-family:'Public Sans',Arial,sans-serif;color:#001d21">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafcfb;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e7e6e0;border-radius:12px">
<tr><td style="padding:24px 28px 8px"><img src="${appUrl()}/gd-logo-black.png" alt="Gordon Digital" height="22" style="display:block;height:22px"></td></tr>
<tr><td style="padding:8px 28px 4px"><h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600">${esc(title)}</h1></td></tr>
<tr><td style="padding:8px 28px 8px;font-size:15px;line-height:24px">${body}</td></tr>
${cta ? `<tr><td style="padding:12px 28px 28px"><a href="${cta.url}" style="display:inline-block;background:#001d21;color:#f7f6f2;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:9px">${esc(cta.label)}</a></td></tr>` : ""}
</table>
<p style="font-size:12px;color:#8a9696;margin:16px 0 0">Gordon Digital · Creative approvals</p>
</td></tr></table></body></html>`;
}

async function send(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const list = Array.from(new Set(to.filter(Boolean)));
  if (!key || !list.length) {
    console.log("[email skipped]", subject, list);
    return;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Gordon Digital Approvals <approvals@notify.gordondigital.com.au>",
    to: list,
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
    subject,
    html,
  });
  if (error) console.error("[email error]", error);
}

export const emails = {
  batchReady: (to: string[], clientName: string, what: string, where: string, link: string, firstName?: string) =>
    send(
      to,
      `${what} ready for your approval`,
      layout(
        `${firstName ? "Hi " + firstName + ", " : ""}there's something to review`,
        `<p>Gordon Digital has sent <b>${esc(what)}</b> for <b>${esc(clientName)}</b>${where ? ` (${esc(where)})` : ""}.</p><p>Leave comments on anything you'd like changed, or approve when you're happy. Nothing goes live until you approve it.</p>`,
        { label: "Review now", url: link },
      ),
    ),
  approvalCode: (to: string, code: string, clientName: string) =>
    send(
      [to],
      `${code} is your approval code`,
      layout(
        "Confirm it's you",
        `<p>Enter this code to approve work for <b>${esc(clientName)}</b>. It works for 10 minutes.</p><p style="font-size:30px;letter-spacing:6px;font-weight:700;margin:16px 0">${esc(code)}</p><p style="color:#5f6f70;font-size:13px">You only need to do this once on each device. If you didn't ask for this, you can ignore this email.</p>`,
      ),
    ),
  teamUpdate: (to: string[], clientName: string, title: string, what: "approved" | "changes", who: string, link: string) =>
    send(
      to,
      what === "approved" ? `Approved: ${title} (${clientName})` : `Changes requested: ${title} (${clientName})`,
      layout(
        what === "approved" ? `${clientName} approved ${title}` : `${clientName} wants changes to ${title}`,
        what === "approved" ? `<p>${esc(who)} approved it. It's ready to go live.</p>` : `<p>${esc(who)} sent changes. Their comments are on the item.</p>`,
        { label: "Open in the portal", url: link },
      ),
    ),
  reminder: (to: string[], clientName: string, count: number, link: string, firstName?: string) =>
    send(
      to,
      `Reminder: ${count} item${count === 1 ? "" : "s"} waiting for your approval`,
      layout(
        `${firstName ? "Hi " + firstName + ", " : ""}a quick reminder`,
        `<p>There ${count === 1 ? "is 1 item" : `are ${count} items`} for <b>${esc(clientName)}</b> waiting on your approval.</p><p>It only takes a minute. Approve, or leave a comment on anything you'd like changed.</p>`,
        { label: "Review now", url: link },
      ),
    ),
};
