import { createHash, randomBytes } from "node:crypto";

export { formatMoney } from "./money";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Short, unguessable, URL-friendly id (e.g. for payment order ids). */
export function shortId(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Hash a value (an IP address, an email) for rate limiting, so the raw value is never stored. */
export function hashForLimit(kind: "ip" | "email", value: string): string {
  return createHash("sha256").update(`shortlist:${kind}:${value.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

