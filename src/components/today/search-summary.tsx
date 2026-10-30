import Link from "next/link";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/services/job-status";

const SEGMENT: Record<Status, string> = {
  saved: "bg-strong-border",
  applied: "bg-muted",
  interview: "bg-foreground",
  offer: "bg-brand",
  rejected: "bg-border",
};

/** The whole search at a glance: counts per stage, one bar, and the numbers that matter. */
export function SearchSummary({
  counts,
  responseRate,
  waiting,
  applied,
  weekly,
}: {
  counts: Record<Status, number>;
  responseRate: number | null;
  waiting: number;
  applied: number;
  weekly: number[];
}) {
  const total = STATUSES.reduce((n, s) => n + counts[s], 0);
  const peak = Math.max(1, ...weekly);
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-3 gap-y-3 sm:grid-cols-5">
        {STATUSES.map((s) => (
          <li key={s}>
            <Link href={`/app/jobs#stage-${s}`} className="group block">
              <span data-testid={`stage-${s}`} className="block text-2xl font-semibold tabular-nums tracking-tight group-hover:underline">
                {counts[s]}
              </span>
              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                <span className={`size-2 rounded-full ${SEGMENT[s]}`} aria-hidden />
                {STATUS_LABELS[s]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {total > 0 && (
        <div className="flex h-1.5 overflow-hidden rounded-full bg-subtle" role="img" aria-label={STATUSES.map((s) => `${counts[s]} ${STATUS_LABELS[s].toLowerCase()}`).join(", ")}>
          {STATUSES.filter((s) => counts[s]).map((s) => (
            <span key={s} className={`${SEGMENT[s]} border-r-2 border-background last:border-r-0`} style={{ width: `${(counts[s] / total) * 100}%` }} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 text-[13px] text-muted">
        <p>
          <span className="font-medium text-foreground tabular-nums">{responseRate === null ? "No" : `${responseRate}%`}</span> response rate
          {applied ? ` from ${applied} sent` : " yet"} · <span className="font-medium text-foreground tabular-nums">{waiting}</span> waiting to hear
        </p>
        <div className="flex items-end gap-2">
          <span>Last 8 weeks</span>
          <span className="flex h-5 items-end gap-[3px]" role="img" aria-label={`Applications per week, oldest first: ${weekly.join(", ")}`}>
            {weekly.map((n, i) => (
              <span key={i} className={`w-1.5 rounded-sm ${i === weekly.length - 1 ? "bg-brand" : "bg-strong-border"}`} style={{ height: `${Math.max(12, (n / peak) * 100)}%` }} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
