import { findLink, getReviewer } from "@/lib/reviewer";
import { getClient } from "@/lib/data";
import PortalShell from "@/components/PortalShell";
import IdentifyForm from "@/components/IdentifyForm";

export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };

export default async function Review({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await findLink(token);
  const client = link ? await getClient(link.client_id) : null;
  if (!link || !client || client.archived)
    return (
      <div className="gate">
        <div className="gate-card">
          <img src="/gd-logo-black.png" alt="Gordon Digital" className="gate-logo lt" />
          <img src="/gd-logo-white.png" alt="Gordon Digital" className="gate-logo dk" />
          <h1>This link isn&apos;t active</h1>
          <p className="muted">Ask your Gordon Digital strategist for a new review link.</p>
        </div>
      </div>
    );
  const me = await getReviewer(link.client_id);
  if (!me) return <IdentifyForm token={token} clientName={String(client.name || "")} />;
  return <PortalShell config={{ mode: "client", token, clientId: link.client_id, me: { id: me.email, name: me.name, email: me.email } }} />;
}
