"use client";
import { useState } from "react";

export default function IdentifyForm({ token, clientName }: { token: string; clientName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/review/${encodeURIComponent(token)}/identify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.error || "Something went wrong. Try again.");
      setBusy(false);
      return;
    }
    window.location.reload();
  };
  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
        <img src="/gd-logo-black.png" alt="Gordon Digital" className="gate-logo lt" />
        <img src="/gd-logo-white.png" alt="Gordon Digital" className="gate-logo dk" />
        <h1>{clientName} approvals</h1>
        <p className="muted">Tell us who you are so Gordon Digital knows who left each comment. We&apos;ll remember you on this device.</p>
        <label className="f" htmlFor="id-name">
          Your name
          <input className="in" id="id-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="f" htmlFor="id-email">
          Email
          <input className="in" id="id-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {err && <p className="gate-err">{err}</p>}
        <button type="submit" className="btn dark" style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }} disabled={busy}>
          {busy ? "One moment…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
