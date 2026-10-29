import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time comparison. Hashing first makes both sides the same length. */
export function secretMatches(given: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !given) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

const bearer = (request: Request) => request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];

/**
 * cron-job.org (or any outside scheduler) authenticates with CRON_JOB_SECRET, sent either as
 * `Authorization: Bearer <secret>` (preferred, set under the job's Advanced tab) or as `?key=<secret>`.
 * Without the secret set, every call is refused.
 */
export function cronJobAuthorized(request: Request) {
  const secret = process.env.CRON_JOB_SECRET;
  return secretMatches(bearer(request), secret) || secretMatches(new URL(request.url).searchParams.get("key"), secret);
}
