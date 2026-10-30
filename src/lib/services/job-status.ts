/** Shared with client components, so it can't live in the server-only jobs service. */
export const STATUSES = ["saved", "applied", "interview", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = { saved: "Saved", applied: "Applied", interview: "Interviewing", offer: "Offer", rejected: "Closed" };

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}
