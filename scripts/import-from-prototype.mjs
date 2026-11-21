#!/usr/bin/env node
/**
 * One-off import of the test version's data into Supabase.
 *
 *   seed/clients/*.json      one file per client (id = file name)
 *   seed/ads/*.json          one file per item
 *   seed/settings/team.json  strategists and their details
 *   seed/assets/<id>.<ext>   uploaded files, named by their asset id
 *
 * seed/ is gitignored: it holds client work and must never be committed.
 * Run with: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:prototype
 * Safe to run again: rows are upserted and files overwritten.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const SEED = path.resolve(process.argv[2] || "seed");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const list = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".json")) : []);
const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", pdf: "application/pdf", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf" };

const files = {};
const adir = path.join(SEED, "assets");
if (fs.existsSync(adir)) for (const f of fs.readdirSync(adir)) files[f.split(".")[0]] = f;

/** Replace every asset id string inside a record with its storage key. */
function rewrite(obj, prefix, used) {
  if (Array.isArray(obj)) return obj.map((v) => rewrite(v, prefix, used));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = rewrite(v, prefix, used);
    return out;
  }
  if (typeof obj === "string" && files[obj]) {
    used.set(obj, prefix + obj);
    return prefix + obj;
  }
  return obj;
}

const uploads = new Map();
const clients = list(path.join(SEED, "clients")).map((f) => ({ id: f.replace(/\.json$/, ""), data: read(path.join(SEED, "clients", f)) }));
const items = list(path.join(SEED, "ads")).map((f) => ({ id: f.replace(/\.json$/, ""), data: read(path.join(SEED, "ads", f)) }));
const teamFile = path.join(SEED, "settings", "team.json");

const clientRows = clients.map((c) => {
  const d = rewrite(c.data, `c/${c.id}/`, uploads);
  delete d.id;
  return { id: c.id, data: d };
});
const itemRows = items
  .filter((it) => clients.some((c) => c.id === it.data.clientId))
  .map((it) => {
    const d = rewrite(it.data, `c/${it.data.clientId}/`, uploads);
    delete d.id;
    return { id: it.id, client_id: it.data.clientId, data: d };
  });
const team = fs.existsSync(teamFile) ? rewrite(read(teamFile), "t/", uploads) : null;

console.log(`Uploading ${uploads.size} files…`);
for (const [id, k] of uploads) {
  const f = files[id];
  const ext = f.split(".").pop().toLowerCase();
  const { error } = await sb.storage.from("media").upload(k, fs.readFileSync(path.join(adir, f)), { contentType: TYPES[ext] || "application/octet-stream", upsert: true });
  if (error) throw new Error(`${f}: ${error.message}`);
}
console.log(`Saving ${clientRows.length} clients, ${itemRows.length} items…`);
let r = await sb.from("clients").upsert(clientRows);
if (r.error) throw r.error;
for (let i = 0; i < itemRows.length; i += 200) {
  r = await sb.from("items").upsert(itemRows.slice(i, i + 200));
  if (r.error) throw r.error;
}
if (team) {
  delete team.id;
  r = await sb.from("settings").upsert({ id: "team", data: team });
  if (r.error) throw r.error;
}
const skipped = items.length - itemRows.length;
console.log(`Done.${skipped ? ` Skipped ${skipped} items whose client no longer exists.` : ""}`);
