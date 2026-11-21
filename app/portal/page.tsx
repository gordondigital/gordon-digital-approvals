import { redirect } from "next/navigation";
import { getTeamUser } from "@/lib/team";
import PortalShell from "@/components/PortalShell";

export const dynamic = "force-dynamic";

export default async function Portal() {
  const me = await getTeamUser();
  if (!me) redirect("/login");
  return <PortalShell config={{ mode: "team", me: { id: me.id, name: me.name, email: me.email } }} />;
}
