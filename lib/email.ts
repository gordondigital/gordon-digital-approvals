import { Resend } from "resend";
import { appUrl } from "@/lib/env";
import { gmailReady, gmailSend } from "@/lib/gmail";
import { isTeamEmail } from "@/lib/team";

export type Sender = { name: string; email: string; title?: string; phone?: string } | null;

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

const toText = (html: string) =>
  html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2: $1")
    .replace(/<br\s*\/?>|<\/p>|<\/tr>|<\/h1>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();

/**
 * Client facing emails (work ready, reminders) go from the strategist's own Gmail when they have an
 * @gordondigital.com.au address and Gmail sending is set up. Anything else, or if Gmail fails, goes through Resend.
 */
async function send(to: string[], subject: string, html: string, from?: Sender): Promise<string> {
  const list = Array.from(new Set(to.filter(Boolean)));
  if (!list.length) return "";
  if (from?.email && !isTeamEmail(from.email)) console.log(`[email] ${from.email} isn't a team address, sending from Resend`);
  if (from?.email && isTeamEmail(from.email) && !gmailReady()) console.log("[email] GOOGLE_SERVICE_ACCOUNT_JSON isn't set, sending from Resend");
  if (from && from.email && isTeamEmail(from.email) && gmailReady()) {
    try {
      await gmailSend({ name: from.name, email: from.email }, list, subject, html, toText(html));
      return from.email;
    } catch (e) {
      console.error("[gmail] falling back to Resend:", e);
    }
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("[email skipped]", subject, list);
    return "";
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: from?.name ? `${from.name.replace(/[<>"]/g, "")} at Gordon Digital <${(process.env.EMAIL_FROM || "").match(/<([^>]+)>/)?.[1] || "approvals@notify.gordondigital.com.au"}>` : process.env.EMAIL_FROM || "Gordon Digital Approvals <approvals@notify.gordondigital.com.au>",
    to: list,
    replyTo: from?.email || process.env.EMAIL_REPLY_TO || undefined,
    subject,
    html,
  });
  if (error) {
    console.error("[email error]", error);
    return "";
  }
  return "approvals@notify";
}

/* ---------- client emails: written like a normal email from the strategist, with their Gmail signature ---------- */

const OFFICE_PHONE = "07 3124 0257";
const OFFICE_ADDRESS = "Suite 301, 33 Longland Street, Newstead QLD 4006";
const SITE = "https://gordondigital.com.au";
const SIG_LOGO = "https://gordondigital.com.au/wp-content/uploads/GD-Primary-Inline-SC-Black-scaled.png";
const REVIEW_LINK = "https://g.page/r/CWezHNvBHtiiEAI/review";

const tel = (p: string) => {
  const d = p.replace(/[^\d+]/g, "");
  return d.startsWith("+") ? d : d.startsWith("0") ? "+61" + d.slice(1) : d;
};
const A = "font-family:Arial, Helvetica, sans-serif;";
const sep = '<span style="color:#d7d7cb;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>';
const lbl = (t: string) => `<span style="${A}color:#4d5f61;font-weight:bold;font-size:11px;">${t}</span>`;
const plainLink = (href: string, text: string) => `<a href="${esc(href)}" style="${A}color:#001d21;text-decoration:none;">${esc(text)}</a>`;

/** The Gordon Digital Gmail signature, filled in from the strategist's Team page details. */
function signature(from: NonNullable<Sender>) {
  const contact = [
    from.phone ? `${lbl("M")}&nbsp;${plainLink("tel:" + tel(from.phone), from.phone)}` : "",
    `${lbl("P")}&nbsp;${plainLink("tel:" + tel(OFFICE_PHONE), OFFICE_PHONE)}`,
  ]
    .filter(Boolean)
    .join(sep);
  return `<table width="480" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:480px;max-width:100%;border-collapse:collapse;${A}color:#001d21;">
<tr><td style="padding:0 0 16px 0;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td valign="top">
<div style="${A}font-size:22px;line-height:28px;font-weight:normal;color:#001d21;">${esc(from.name)}</div>
<div style="${A}font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#4d5f61;padding:4px 0 12px 0;">${esc(from.title || "Strategist")}${sep}Gordon Digital</div>
<div style="${A}font-size:13px;line-height:20px;color:#001d21;">${contact}<br>${plainLink("mailto:" + from.email, from.email)}${sep}${plainLink(SITE, "gordondigital.com.au")}</div><div style="${A}font-size:12px;line-height:18px;color:#4d5f61;padding-top:8px;">${OFFICE_ADDRESS}</div>
</td></tr></table></td></tr>
<tr><td style="border-top:2px solid #001d21;padding:16px 0 0 0;"><a href="${SITE}" style="text-decoration:none;"><img src="${SIG_LOGO}" width="480" alt="Gordon Digital" style="display:block;width:480px;max-width:100%;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:14px 0 0 0;"><a href="${REVIEW_LINK}" style="${A}font-size:12px;font-weight:bold;color:#001d21;text-decoration:underline;">Love working with our team? Leave us a Google review &rarr;</a></td></tr>
</table>`;
}

/** A plain, personal looking email: paragraphs of text, a link, a sign off and the signature. No card, no header. */
function personal(paras: string[], from?: Sender) {
  const p = (t: string) => `<p style="${A}font-size:14px;line-height:22px;color:#001d21;margin:0 0 14px 0;">${t}</p>`;
  const first = from?.name ? from.name.split(" ")[0] : "The Gordon Digital team";
  return `<!doctype html><html><body style="margin:0;padding:16px;background:#ffffff;">
<div style="max-width:600px;">${paras.map(p).join("")}${from?.email ? p("Thanks,") + signature(from) : p(`Thanks,<br>${esc(first)}`)}</div>
</body></html>`;
}
const reviewLink = (url: string, text: string) => `<a href="${esc(url)}" style="${A}color:#1a5ccf;text-decoration:underline;font-weight:bold;">${esc(text)}</a>`;

export const emails = {
  batchReady: (to: string[], clientName: string, what: string, where: string, link: string, firstName?: string, from?: Sender) =>
    send(
      to,
      `${clientName}: ${what} ready for your approval`,
      personal(
        [
          `Hi ${esc(firstName || "there")},`,
          `I've sent through ${esc(what)} for ${esc(clientName)}${where ? ` (${esc(where)})` : ""} for your review.`,
          `You can see everything here: ${reviewLink(link, "Review and approve")}`,
          `Leave a comment on anything you'd like changed, or approve when you're happy. Nothing goes live until you approve it.`,
        ],
        from,
      ),
      from,
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
  reminder: (to: string[], clientName: string, count: number, link: string, firstName?: string, from?: Sender) =>
    send(
      to,
      `${clientName}: ${count === 1 ? "1 item" : count + " items"} waiting on your approval`,
      personal(
        [
          `Hi ${esc(firstName || "there")},`,
          `Just a quick reminder that ${count === 1 ? "there's 1 item" : `there are ${count} items`} for ${esc(clientName)} waiting on your approval.`,
          `You can review ${count === 1 ? "it" : "them"} here: ${reviewLink(link, "Review and approve")}`,
          `Let me know if you have any questions.`,
        ],
        from,
      ),
      from,
    ),
};

/** Sample client emails for the preview page. */
export function previewClientEmail(kind: "ready" | "reminder", from: Sender, link: string) {
  return kind === "reminder"
    ? personal(
        [
          "Hi Bridgette,",
          "Just a quick reminder that there are 3 items for OJ Pippin Homes waiting on your approval.",
          `You can review them here: ${reviewLink(link, "Review and approve")}`,
          "Let me know if you have any questions.",
        ],
        from,
      )
    : personal(
        [
          "Hi Bridgette,",
          "I've sent through 4 Meta ads for OJ Pippin Homes (December 2026) for your review.",
          `You can see everything here: ${reviewLink(link, "Review and approve")}`,
          "Leave a comment on anything you'd like changed, or approve when you're happy. Nothing goes live until you approve it.",
        ],
        from,
      );
}
