import { SignJWT, importPKCS8 } from "jose";

/**
 * Sends email as a Gordon Digital team member through the Gmail API, using a Google service account
 * with domain wide delegation (scope gmail.send only). Mail appears in their Sent folder and replies go to them.
 * Set GOOGLE_SERVICE_ACCOUNT_JSON to the contents of the service account's JSON key.
 */
type Key = { client_email: string; private_key: string };
const tokens = new Map<string, { token: string; exp: number }>();

function serviceKey(): Key | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const k = JSON.parse(raw) as Key;
    return k.client_email && k.private_key ? { client_email: k.client_email, private_key: k.private_key.replace(/\\n/g, "\n") } : null;
  } catch {
    console.error("[gmail] GOOGLE_SERVICE_ACCOUNT_JSON isn't valid JSON");
    return null;
  }
}

export const gmailReady = () => !!serviceKey();

async function accessToken(asUser: string): Promise<string> {
  const hit = tokens.get(asUser);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const k = serviceKey();
  if (!k) throw new Error("Gmail sending isn't set up");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/gmail.send" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(k.client_email)
    .setSubject(asUser)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(await importPKCS8(k.private_key, "RS256"));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google token error for ${asUser}: ${j.error_description || j.error || r.status}`);
  tokens.set(asUser, { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 });
  return j.access_token;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const encHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const addr = (name: string, email: string) => (name ? `${encHeader(`"${name.replace(/"/g, "")}"`)} <${email}>` : email);

export async function gmailSend(from: { name: string; email: string }, to: string[], subject: string, html: string, text: string) {
  const token = await accessToken(from.email);
  const boundary = "gda" + Math.random().toString(36).slice(2);
  const mime = [
    `From: ${addr(from.name, from.email)}`,
    `To: ${to.join(", ")}`,
    `Subject: ${encHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(text).replace(/.{76}/g, "$&\r\n"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(html).replace(/.{76}/g, "$&\r\n"),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(mime, "utf8").toString("base64url") }),
  });
  if (!r.ok) throw new Error(`Gmail send failed for ${from.email}: ${r.status} ${(await r.text()).slice(0, 300)}`);
}
