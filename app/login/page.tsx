import LoginButton from "@/components/LoginButton";

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="gate">
      <div className="gate-card">
        <img src="/gd-logo-black.png" alt="Gordon Digital" className="gate-logo lt" />
        <img src="/gd-logo-white.png" alt="Gordon Digital" className="gate-logo dk" />
        <h1>Creative approvals</h1>
        <p className="muted">Sign in with your Gordon Digital Google account.</p>
        {e === "domain" && <p className="gate-err">That account isn&apos;t on the Gordon Digital team. Sign in with your @gordondigital.com.au account.</p>}
        {e === "auth" && <p className="gate-err">Sign in didn&apos;t finish. Try again.</p>}
        <LoginButton />
        <p className="tiny muted">Clients don&apos;t sign in here. They use the review link we email them.</p>
      </div>
    </div>
  );
}
