/**
 * Clients send back the whole item they were looking at. We never trust it.
 * Starting from the copy in the database, we keep only the changes a client is allowed to make:
 *   - new comments they wrote (role forced to "client", name and time set by the server)
 *   - awaiting -> changes ("Submit changes" / "Request changes")
 *   - awaiting -> approved (approvers only, checked by the caller)
 * Everything else in their copy is ignored.
 */
type Json = Record<string, unknown>;
export type Actor = { name: string; email: string };
export type MergeResult = { data: Json; added: number; transition: null | "changes" | "approved" };

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const isCommentList = (key: string, v: unknown) => (key === "comments" || key === "overall") && Array.isArray(v);
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

/** Walk both trees together and append any new client comments found in `incoming` onto `base`. */
function mergeComments(base: unknown, incoming: unknown, actor: Actor, at: string, depth = 0): number {
  if (depth > 12) return 0;
  let added = 0;
  if (Array.isArray(base) && Array.isArray(incoming)) {
    // Arrays of lines/creatives/paragraphs line up by position.
    for (let i = 0; i < Math.min(base.length, incoming.length); i++) added += mergeComments(base[i], incoming[i], actor, at, depth + 1);
    return added;
  }
  if (!isObj(base) || !isObj(incoming)) return 0;
  for (const key of Object.keys(incoming)) {
    const inc = incoming[key];
    if (isCommentList(key, inc)) {
      const cur = Array.isArray(base[key]) ? (base[key] as Json[]) : [];
      const ids = new Set(cur.map((c) => (isObj(c) ? String(c.id) : "")));
      const fresh = (inc as unknown[]).filter((c): c is Json => isObj(c) && !!c.id && !ids.has(String(c.id)) && String(c.text || "").trim() !== "");
      if (fresh.length) {
        base[key] = cur.concat(
          fresh.slice(0, 50).map((c) => {
            const out: Json = { id: clip(c.id, 40), by: actor.email, name: actor.name, role: "client", text: clip(c.text, 5000), at, resolved: false, resolvedByName: null };
            if (typeof c.x === "number" && typeof c.y === "number") {
              out.x = Math.max(0, Math.min(1, c.x));
              out.y = Math.max(0, Math.min(1, c.y));
            }
            return out;
          }),
        );
        added += fresh.length;
      }
    } else if (key in base && (isObj(inc) || Array.isArray(inc))) {
      added += mergeComments(base[key], inc, actor, at, depth + 1);
    }
  }
  return added;
}

export function mergeClientItem(current: Json, incoming: Json, actor: Actor, opts: { canApprove: boolean }): MergeResult | { error: string; status: number } {
  const status = String(current.status || "");
  if (status === "draft" || status === "archived") return { error: "This item isn't open for review.", status: 404 };
  const at = new Date().toISOString();
  const data = clone(current);
  const added = mergeComments(data, incoming, actor, at);

  let transition: MergeResult["transition"] = null;
  const want = String(incoming.status || "");
  if (status === "awaiting" && want === "changes") {
    transition = "changes";
    data.status = "changes";
    data.changesAt = at;
    data.changesBy = actor.email;
    data.changesByName = actor.name;
    data.note = clip(incoming.note, 300) || `Version ${data.version}. Changes sent ${at.slice(0, 10)}.`;
  } else if (status === "awaiting" && want === "approved") {
    if (!opts.canApprove) return { error: "need_approver", status: 403 };
    transition = "approved";
    data.status = "approved";
    data.approvedAt = at;
    data.approvedBy = actor.email;
    data.approvedByName = actor.name;
    data.note = clip(incoming.note, 300) || `Version ${data.version}. Approved.`;
  }
  if (!added && !transition) return { data, added, transition };
  data.updatedAt = at;
  return { data, added, transition };
}

/** Clients can add to and tidy their own brand library. Nothing else on the client record. */
export function mergeClientRecord(current: Json, incoming: Json): Json {
  const data = clone(current);
  if (isObj(incoming.brand)) {
    const b = clone(incoming.brand) as Json;
    const out: Json = {};
    for (const k of ["colours", "fonts", "logos", "images", "files"]) if (Array.isArray(b[k])) out[k] = (b[k] as unknown[]).slice(0, 300);
    if (typeof b.notes === "string") out.notes = clip(b.notes, 20000);
    data.brand = { ...(isObj(current.brand) ? current.brand : {}), ...out };
    data.updatedAt = new Date().toISOString();
  }
  return data;
}

/** What a client is allowed to see of an item. */
export function forClient(item: Json): Json {
  const x = clone(item);
  delete x.internal;
  delete x.owner;
  return x;
}

/** What a client is allowed to see of their own record. */
export function clientRecordForClient(c: Json): Json {
  const x = clone(c);
  for (const k of ["metaAccount", "googleId", "internal", "notesInternal"]) delete x[k];
  return x;
}
