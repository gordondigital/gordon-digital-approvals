import crypto from "node:crypto";
export const hashCode = (clientId: string, email: string, code: string) =>
  crypto.createHmac("sha256", process.env.REVIEW_SECRET || "").update(`${clientId}:${email}:${code}`).digest("hex");
