# Gordon Digital Approvals

The creative approvals portal for Gordon Digital clients. Clients review Meta ads, Google Search ads, landing pages, website pages, content (articles, pages, Google Business posts) and organic social, then comment or approve. The team works in the portal.

- **Team**: `/portal`, signed in with Google (@gordondigital.com.au only).
- **Clients**: a private review link per client, `/r/<token>`. No password. They enter their name and email once per device. Approvers confirm their email with a 6 digit code the first time they approve on a device.

Stack: Next.js on Vercel, Supabase (Postgres, Auth, Storage, Realtime), Resend for email.

## How it's built

`public/portal/app.js` is the approved test version of the app, almost unchanged. `components/PortalShell.tsx` gives it a backend:

- **Team**: reads and writes Supabase directly. Row level security only lets @gordondigital.com.au accounts in. Changes appear live for everyone through Realtime.
- **Clients**: never touch the database. They go through `/api/review/<token>/*`, which:
  - returns only their client, with drafts, archived items and internal notes removed
  - accepts only new comments, "request changes" and "approve" (approvers on a confirmed device), and ignores anything else in what the browser sends
- **Files** are in a private Storage bucket. `/api/media/...` checks who's asking and then hands out a short-lived link.
- **Emails** (Resend) go out when:
  - the team sends work (one email per send, however many items). This and reminders come from the strategist's own Gmail when set up.
  - a client approves or asks for changes (to the strategist)
  - someone presses Remind
  - something has waited longer than the client's reminder setting in working days (checked every weekday at 8:45am Brisbane time)

## Setup

### 1. Supabase

1. Create a project at supabase.com. Choose region **Sydney (ap-southeast-2)**.
2. Open **SQL editor**, paste in `supabase/migrations/0001_init.sql` and run it.
3. **Authentication → Providers → Google**: turn it on. You'll need a Google OAuth client:
   1. Go to Google Cloud Console, then APIs & Services, then Credentials, then Create OAuth client ID (Web application).
   2. Add Supabase's callback URL as an authorised redirect URI. It's shown on the Supabase Google provider page.
   3. Paste the client ID and secret into Supabase.
4. **Authentication → URL configuration**:
   - Site URL: `https://approvals.gordondigital.com.au`
   - Redirect URLs: add `https://approvals.gordondigital.com.au/auth/callback`, and your Vercel preview URL's `/auth/callback` if you want to test previews.
5. **Project settings → API**: copy the URL, the anon key and the service role key. The service role key is secret. It only goes into Vercel, never into chat or the code.

### 2. Resend

1. Create an account, then go to **Domains** and add `notify.gordondigital.com.au`.
2. Add the DNS records Resend shows (SPF, DKIM and the MX for bounces) in Cloudflare. Set them all to **DNS only** (grey cloud).
3. Wait for Resend to show Verified, then create an API key with sending access.

Sending from a subdomain keeps approval emails separate from your main mail's reputation.

### 2b. Send client emails from the strategist's Gmail

"Ready for your approval" and reminder emails go out from the client's strategist. They come from the strategist's own @gordondigital.com.au address, show in their Sent folder, and client replies land in their inbox. Approval codes and the team alerts still go through Resend.

1. **Google Cloud** (project: client approvals portal):
   1. Create a service account (`approvals-mailer`) with no roles.
   2. Enable the **Gmail API**.
   3. Create a JSON key.
2. **Workspace Admin**: go to **Security → API controls → Domain Wide Delegation** and add the service account's Unique ID with the scope `https://www.googleapis.com/auth/gmail.send`. That scope can send only. It can't read mail.
3. **Vercel**: paste the JSON key's contents into `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. **In the portal**: each strategist needs their email filled in under **Team → Edit**. That's the address their client emails come from.

If a strategist has no email saved, or Gmail refuses a send, that email goes through Resend instead. It shows "Name at Gordon Digital" as the sender, with replies going to the strategist. Nothing gets lost.

### 3. Vercel

1. Import this GitHub repo into Vercel. The framework is detected as Next.js.
2. Add the environment variables from `.env.example` under **Settings → Environment Variables**:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (secret) |
| `APP_URL` | `https://approvals.gordondigital.com.au` |
| `REVIEW_SECRET` | a long random string, e.g. from `openssl rand -base64 48`. Changing it signs every client out. |
| `TEAM_EMAIL_DOMAINS` | `gordondigital.com.au` |
| `TEAM_EMAILS` | extra individual addresses allowed in, comma separated (optional) |
| `RESEND_API_KEY` | from Resend (secret) |
| `EMAIL_FROM` | `Gordon Digital Approvals <approvals@notify.gordondigital.com.au>` |
| `EMAIL_REPLY_TO` | where client replies go. This address is also copied on approvals and changes. |
| `CRON_SECRET` | another long random string |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole contents of the service account's .json key (secret). See step 2b. |

3. Deploy.
4. **Settings → Domains**: add `approvals.gordondigital.com.au`.
5. In Cloudflare, add the record Vercel asks for, usually `CNAME approvals → cname.vercel-dns.com`. Set it to **DNS only** (grey cloud), so Vercel can issue the certificate.

### 4. Bring across the test version's data (optional)

1. Put the export in `seed/` (gitignored, never commit it) with this layout:
   - `seed/clients/*.json`
   - `seed/ads/*.json`
   - `seed/settings/team.json`
   - `seed/assets/<id>.<ext>`
2. Run:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:prototype
```

The script uploads the files to Storage and points every item at its new file location. You can run it again safely.

### 5. Check it works

1. Sign in at `/portal` with your Google account.
2. On a test client, put your own email in **Approver email** in client settings.
3. Create an item and send it. You should get the "ready for your approval" email.
4. Open the link in a private window:
   - Enter a name and email.
   - Leave a comment and request changes. The strategist gets an email.
   - Approve another item. You'll be asked for the emailed code once.
5. Copy client link (on the team side) gives the same private link. To cut off a link, set `revoked_at` on its row in `review_links`. The next "Copy client link" makes a new one.

## Local development

```bash
cp .env.example .env.local   # fill in values (use a separate Supabase project for dev)
npm install
npm run dev
```

Without `RESEND_API_KEY`, emails are printed to the terminal instead of sent. That includes approval codes.

## Notes

- **Approvers**:
  - Approvers are the addresses in the client's **Approver email** field, comma separated if there are several.
  - If it's blank, anyone with the link can approve after confirming their email with a code.
  - Anyone else can comment and request changes.
- **Overdue and reminders** count working days (Monday to Friday, not counting the day it was sent), using each client's reminder setting (default 3).
- **Audit trail**: every client action is written to the `events` table with who and when.
