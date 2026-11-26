import crypto from "node:crypto";

export const MAX_BYTES = 200 * 1024 * 1024;
const OK = /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|quicktime|webm)|application\/pdf|font\/(ttf|otf|woff2?)|application\/(font-woff|x-font-ttf|x-font-otf|octet-stream|zip))$/;

export function checkUpload(type: string, size: number): string | null {
  if (!size || size > MAX_BYTES) return "too_large";
  if (!OK.test(type || "application/octet-stream")) return "unsupported_type";
  return null;
}

/** Storage keys: c/<clientId>/<random> for client work, t/<random> for team photos. */
export function newKey(clientId?: string | null) {
  const id = crypto.randomBytes(16).toString("hex");
  return clientId ? `c/${clientId.replace(/[^A-Za-z0-9_-]/g, "")}/${id}` : `t/${id}`;
}
