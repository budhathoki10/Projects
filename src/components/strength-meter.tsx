import Link from "next/link";
import { cvStrength, strengthLabel } from "@/lib/cv/strength";
import type { Profile } from "@/lib/model/types";
import { Icon } from "./icons";

/** A ring with the CV strength score, and the checks that aren't passing yet, each linking to its fix. */
export function StrengthMeter({ profile, compact = false }: { profile: Profile; compact?: boolean }) {
  const { score, checks } = cvStrength(profile);
  const failing = checks.filter((c) => !c.ok);
  const r = 26;
  const circ = 2 * Math.PI * r;
  const tone = score >= 85 ? "var(--brand)" : score >= 60 ? "var(--notice)" : "var(--pen)";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`CV strength ${score} out of 100`}>
          <circle cx="34" cy="34" r={r} fill="none" stroke="var(--subtle)" strokeWidth="7" />
          <circle
            cx="34"
            cy="34"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * circ} ${circ}`}
            transform="rotate(-90 34 34)"
          />
          <text x="34" y="39" textAnchor="middle" className="fill-foreground text-[15px] font-semibold tabular-nums">
            {score}
          </text>
        </svg>
        <div>
          <p className="font-medium">{strengthLabel(score)}</p>
          <p className="text-[13px] text-muted">
            {failing.length === 0 ? "Every check passes." : `${failing.length} ${failing.length === 1 ? "thing" : "things"} to improve`}
          </p>
        </div>
      </div>
      {failing.length > 0 && (
        <ul className="space-y-2">
          {(compact ? failing.slice(0, 3) : failing).map((c) => (
            <li key={c.id}>
              <Link href={c.href} className="group flex gap-3 rounded-lg p-2 -mx-2 hover:bg-subtle">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-pen" aria-hidden />
                <span className="min-w-0 text-[13px]">
                  <span className="font-medium">{c.label}</span>
                  <span className="block text-muted">{c.detail}</span>
                </span>
                <Icon name="chevron" size={14} className="ml-auto mt-1 shrink-0 text-faint group-hover:text-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!compact && checks.some((c) => c.ok) && (
        <ul className="space-y-1 border-t border-border pt-3">
          {checks
            .filter((c) => c.ok)
            .map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-[13px] text-muted">
                <Icon name="check" size={14} className="text-brand" /> {c.label}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
