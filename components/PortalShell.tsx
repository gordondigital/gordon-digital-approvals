"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Runs the approvals app (public/portal/app.js, the approved test version) on the production backend.
 * The app talks to `window.claude.use(...)` for its database, file uploads, downloads and the current user.
 * This component provides those, backed by Supabase for the team and by the review API for clients.
 */
import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { PORTAL_MARKUP } from "@/lib/markup";

export type ShellConfig =
  | { mode: "team"; me: { id: string; name: string; email: string } }
  | { mode: "client"; token: string; clientId: string; me: { id: string; name: string; email: string } };

type Snap = { exists: boolean; data: () => any };
const snap = (d: any): Snap => ({ exists: d != null, data: () => (d == null ? undefined : JSON.parse(JSON.stringify(d))) });
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const sbAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function api(url: string, body?: unknown) {
  const r = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status, body: j, code: j.code });
  return j;
}


/** Upload straight to Storage with a signed URL, reporting progress (fetch can't). */
function putSigned(key: string, token: string, file: File, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const path = key.split("/").map(encodeURIComponent).join("/");
    xhr.open("PUT", `${sbUrl}/storage/v1/object/upload/sign/media/${path}?token=${encodeURIComponent(token)}`);
    xhr.setRequestHeader("apikey", sbAnon);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject({ code: "upload_failed", message: `Storage said ${xhr.status}: ${xhr.responseText.slice(0, 200)}` }));
    xhr.onerror = () => reject({ code: "upload_failed", message: "The connection dropped during the upload." });
    xhr.ontimeout = () => reject({ code: "timeout", message: "The upload took too long." });
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", file);
    xhr.send(fd);
  });
}

function downloadsApi() {
  return {
    save: async ({ filename, data }: { filename: string; data: Blob }) => {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
  };
}
const permissionsApi = { state: async () => ({}), request: async () => ({}) };

/* ---------------- Team: Supabase tables + realtime ---------------- */
function teamBackend(me: { id: string; name: string }) {
  const sb = createBrowserClient(sbUrl, sbAnon);
  const table = (col: string) => (col === "ads" ? "items" : col === "clients" ? "clients" : col === "settings" ? "settings" : null);
  const status: Record<string, string | undefined> = {};
  const seen = { clients: new Set<string>(), ads: new Set<string>() };
  let notifyQ: Record<string, Set<string>> = {};
  let notifyT: any = null;
  const listeners = new Set<() => void>();
  let changeT: any = null;
  const queues: Record<string, Promise<void>> = {};

  const flushNotify = () => {
    const q = notifyQ;
    notifyQ = {};
    Object.keys(q).forEach((clientId) =>
      api("/api/team/notify", { clientId, itemIds: Array.from(q[clientId]) })
        .then((r) => {
          const G = (window as any).GDA;
          if (r.warning) G?.toast?.(r.warning);
          else if (r.to?.length) G?.toast?.(`Emailed ${r.to.join(", ")}${r.from ? " from " + r.from : ""}`);
        })
        .catch((e) => (window as any).GDA?.toast?.("Sent, but the email didn't go: " + e.message)),
    );
  };

  async function pageAll(build: (from: number, to: number) => any) {
    const out: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await build(from, from + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  async function index() {
    const [cs, is] = await Promise.all([
      pageAll((a, b) => sb.from("clients").select("id,updated_at,u:data->>updatedAt").range(a, b)),
      pageAll((a, b) => sb.from("items").select("id,client_id,status,updated_at,u:data->>updatedAt").range(a, b)),
    ]);
    const ix: any = { clients: {}, ads: {} };
    const now = { clients: new Set<string>(), ads: new Set<string>() };
    cs.forEach((r) => {
      ix.clients[r.id] = { u: r.u || r.updated_at };
      now.clients.add(r.id);
    });
    is.forEach((r) => {
      ix.ads[r.id] = { c: r.client_id, u: r.u || r.updated_at };
      now.ads.add(r.id);
      status[r.id] = r.status;
    });
    (["clients", "ads"] as const).forEach((k) => {
      seen[k].forEach((id) => {
        if (!now[k].has(id)) ix[k][id] = { deleted: true, u: "gone" };
      });
      seen[k] = now[k];
    });
    return ix;
  }

  const channel = sb
    .channel("gda-portal")
    .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => changed())
    .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => changed())
    .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => changed())
    .subscribe();
  void channel;
  function changed() {
    clearTimeout(changeT);
    changeT = setTimeout(() => listeners.forEach((f) => f()), 400);
  }

  const doc = (path: string) => {
    const [col, id] = path.split("/");
    const t = table(col);
    return {
      async get(): Promise<Snap> {
        if (col === "index") return snap(await index());
        if (!t) return snap(null);
        const { data, error } = await sb.from(t).select(col === "ads" ? "data,client_id" : "data").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) return snap(null);
        const row = data as any;
        if (col === "ads") {
          status[id] = row.data?.status;
          return snap({ ...row.data, clientId: row.data?.clientId || row.client_id });
        }
        return snap(row.data);
      },
      set(obj: any) {
        // Saves to the same record go one after another, so a slower earlier save can't overwrite a later one.
        const run = (queues[path] || Promise.resolve()).catch(() => {}).then(() => this.write(obj));
        queues[path] = run;
        return run;
      },
      async write(obj: any) {
        if (col === "index") return;
        if (!t) throw new Error("Unknown collection " + col);
        const data = { ...obj };
        delete data.id;
        const row: any = { id, data };
        if (col === "ads") {
          row.client_id = obj.clientId;
          const was = status[id];
          if (obj.status === "awaiting" && was !== "awaiting") {
            (notifyQ[obj.clientId] = notifyQ[obj.clientId] || new Set()).add(id);
            clearTimeout(notifyT);
            notifyT = setTimeout(flushNotify, 1500);
          }
        }
        const { error } = await sb.from(t).upsert(row);
        if (error) throw error;
        if (col === "ads") status[id] = obj.status;
      },
      async update() {
        /* the index is worked out from the tables, nothing to store */
      },
      async delete() {
        if (!t) return;
        const { error } = await sb.from(t).delete().eq("id", id);
        if (error) throw error;
      },
      onSnapshot(cb: (s: Snap) => void, err?: (e: any) => void) {
        const run = () => this.get().then(cb, (e: any) => err && err(e));
        listeners.add(run);
        return () => listeners.delete(run);
      },
    };
  };

  const assets = {
    async upload(file: File, opts?: { team?: boolean; onProgress?: (p: number) => void }) {
      const G = (window as any).GDA;
      const clientId = opts?.team ? null : G?.currentClient?.() || null;
      const { key, token } = await api("/api/team/upload", { clientId, type: file.type, size: file.size }).catch((e) => {
        throw { code: e.code || "upload_failed", message: e.message };
      });
      await putSigned(key, token, file, opts?.onProgress);
      return { id: key, contentType: file.type };
    },
  };

  return {
    db: { doc },
    assets,
    user: { me: async () => ({ id: me.id, name: me.name }), profiles: async () => ({}) },
    hooks: {
      reviewLink: (clientId: string) => api("/api/team/link", { clientId }).then((r) => r.url),
      remind: (itemId: string) => api("/api/team/remind", { itemId }),
      clientAction: (clientId: string, action: string) => api("/api/team/client", { clientId, action }),
    },
  };
}

/* ---------------- Client: review API ---------------- */
function clientBackend(token: string, clientId: string) {
  const base = `/api/review/${encodeURIComponent(token)}`;
  let cache: any = null;
  let loading: Promise<any> | null = null;
  const versions: Record<string, string> = {};
  const listeners = new Set<() => void>();
  const queues: Record<string, Promise<void>> = {};

  const load = () =>
    (loading = api(base + "/data").then((d) => {
      cache = d;
      loading = null;
      return d;
    }, (e) => {
      loading = null;
      throw e;
    }));
  const ready = () => (cache ? Promise.resolve(cache) : loading || load());
  const index = () => {
    const ix: any = { clients: {}, ads: {} };
    Object.keys(cache.clients || {}).forEach((id) => (ix.clients[id] = { u: cache.clients[id].updatedAt || "0" }));
    Object.keys(cache.ads || {}).forEach((id) => (ix.ads[id] = { c: clientId, u: cache.ads[id].updatedAt || "0" }));
    Object.keys(versions).forEach((k) => {
      const [col, id] = k.split("/");
      if (!(cache[col] || {})[id]) ix[col][id] = { deleted: true, u: "gone" };
    });
    Object.keys(ix.ads).forEach((id) => (versions["ads/" + id] = ix.ads[id].u));
    Object.keys(ix.clients).forEach((id) => (versions["clients/" + id] = ix.clients[id].u));
    return ix;
  };
  const refresh = () => load().then(() => listeners.forEach((f) => f()), () => {});
  setInterval(() => {
    if (!document.hidden) refresh();
  }, 20000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  async function save(col: string, id: string, obj: any): Promise<void> {
    try {
      const r = await api(base + "/save", { kind: col, id, data: obj });
      if (r.data && col === "ads") cache.ads[id] = { ...r.data, clientId };
      else await load();
    } catch (e: any) {
      if (e.status === 409 && e.body?.needCode) {
        await confirmDevice(base, e.body.email);
        return save(col, id, obj);
      }
      await load().catch(() => {});
      setTimeout(() => (window as any).GDA?.reload?.(), 50);
      throw e;
    }
    listeners.forEach((f) => f());
  }

  const doc = (path: string) => {
    const [col, id] = path.split("/");
    return {
      async get(): Promise<Snap> {
        await ready();
        if (col === "index") return snap(index());
        if (col === "settings" && id === "team") return snap(cache.team);
        if (col === "clients" || col === "ads") return snap((cache[col] || {})[id] || null);
        return snap(null);
      },
      set(obj: any) {
        if (col === "index") return Promise.resolve();
        if (col !== "ads" && col !== "clients") return Promise.reject(new Error("You can't change that."));
        const run = (queues[path] || Promise.resolve()).catch(() => {}).then(() => save(col, id, obj));
        queues[path] = run;
        return run;
      },
      async update() {},
      async delete() {
        throw new Error("You can't delete that.");
      },
      onSnapshot(cb: (s: Snap) => void, err?: (e: any) => void) {
        const run = () => this.get().then(cb, (e: any) => err && err(e));
        listeners.add(run);
        return () => listeners.delete(run);
      },
    };
  };

  const assets = {
    async upload(file: File, opts?: { onProgress?: (p: number) => void }) {
      const { key, token: t } = await api(base + "/upload", { type: file.type, size: file.size }).catch((e) => {
        throw { code: e.code || "upload_failed", message: e.message };
      });
      await putSigned(key, t, file, opts?.onProgress);
      return { id: key, contentType: file.type };
    },
  };

  return {
    db: { doc },
    assets,
    user: { me: async () => (await ready()).me, profiles: async () => ({}) },
    hooks: {},
  };
}

/** Approvers confirm their email once per device before their first approval. */
function confirmDevice(base: string, email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const wrap = document.createElement("div");
    wrap.className = "gda-modal";
    wrap.innerHTML = `<div class="gda-modal-card" role="dialog" aria-modal="true" aria-labelledby="gda-mt">
      <h2 id="gda-mt">Confirm it's you</h2>
      <p class="small muted">Approvals go straight to Gordon Digital, so the first time you approve on this device we check it's you. We'll email a 6 digit code to <b></b>.</p>
      <div class="gda-step1"><button type="button" class="btn dark" data-x="send">Email me a code</button></div>
      <div class="gda-step2" hidden><label class="f" for="gda-code">Code<input class="in" id="gda-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></label>
        <div class="row" style="gap:8px"><button type="button" class="btn go" data-x="verify">Confirm and approve</button><button type="button" class="btn sm" data-x="send">Send a new code</button></div></div>
      <p class="small gda-err" role="alert"></p>
      <div class="row" style="justify-content:flex-end"><button type="button" class="btn sm" data-x="cancel">Cancel</button></div></div>`;
    (wrap.querySelector("b") as HTMLElement).textContent = email;
    document.body.appendChild(wrap);
    const err = wrap.querySelector(".gda-err") as HTMLElement;
    const close = () => wrap.remove();
    wrap.addEventListener("click", async (ev) => {
      const b = (ev.target as HTMLElement).closest("[data-x]") as HTMLButtonElement | null;
      if (!b) return;
      const x = b.dataset.x;
      err.textContent = "";
      if (x === "cancel") {
        close();
        reject(new Error("Approval not sent. Nothing has changed."));
      } else if (x === "send") {
        b.disabled = true;
        try {
          await api(base + "/code", {});
          (wrap.querySelector(".gda-step1") as HTMLElement).hidden = true;
          (wrap.querySelector(".gda-step2") as HTMLElement).hidden = false;
          (wrap.querySelector("#gda-code") as HTMLInputElement).focus();
        } catch (e: any) {
          err.textContent = e.message;
        }
        b.disabled = false;
      } else if (x === "verify") {
        const code = (wrap.querySelector("#gda-code") as HTMLInputElement).value;
        b.disabled = true;
        try {
          await api(base + "/verify", { code });
          close();
          resolve();
        } catch (e: any) {
          err.textContent = e.message;
          b.disabled = false;
        }
      }
    });
  });
}

export default function PortalShell({ config }: { config: ShellConfig }) {
  useEffect(() => {
    const w = window as any;
    if (w.__gdaBooted) return;
    w.__gdaBooted = true;
    const be = config.mode === "team" ? teamBackend(config.me) : clientBackend(config.token, config.clientId);
    w.GDA = { client: config.mode === "client" ? config.clientId : null, ...be.hooks };
    const caps: Record<string, any> = { db: be.db, assets: be.assets, user: be.user, downloads: downloadsApi(), permissions: permissionsApi };
    w.claude = { use: (name: string) => Promise.resolve(caps[name] ?? null) };
    if (config.mode === "team") {
      const right = document.querySelector(".top-right");
      if (right) {
        const f = document.createElement("form");
        f.method = "post";
        f.action = "/auth/signout";
        f.innerHTML = '<button type="submit" class="btn sm">Sign out</button>';
        right.appendChild(f);
      }
    }
    const s = document.createElement("script");
    s.src = "/portal/app.js?v=" + (process.env.NEXT_PUBLIC_BUILD_ID || "1");
    document.body.appendChild(s);
  }, [config]);
  return <div dangerouslySetInnerHTML={{ __html: PORTAL_MARKUP }} suppressHydrationWarning />;
}
