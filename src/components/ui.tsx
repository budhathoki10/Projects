import Link from "next/link";
import { cloneElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-on-ink shadow-1 hover:bg-ink-hover disabled:opacity-50",
  secondary: "border border-strong-border bg-surface text-foreground shadow-1 hover:border-hover-border hover:bg-panel disabled:opacity-50",
  ghost: "text-muted underline-offset-4 hover:text-foreground hover:underline",
};

const BASE = "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-border bg-surface p-5 shadow-1 ${className}`}>{children}</div>;
}

/** Small uppercase label used above sections and table columns. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-medium uppercase tracking-[0.08em] text-muted ${className}`}>{children}</p>;
}

// Text on a tint uses the scale's darkest step, so small badge text stays readable.
const BADGES = {
  neutral: "border-border bg-surface text-muted",
  good: "border-transparent bg-money-soft text-money-strong",
  warn: "border-transparent bg-notice-soft text-notice-strong ring-1 ring-inset ring-notice-border",
  bad: "border-transparent bg-pen-soft text-pen-strong",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-px text-xs font-medium ${BADGES[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Label + control + optional hint. The hint is linked with aria-describedby rather than
 * nested in the label, so screen readers announce "Email", not "Email We'll never share…".
 */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactElement<ControlProps> }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      {cloneElement(children, { id, "aria-describedby": hint ? hintId : undefined })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

type ControlProps = { id?: string; "aria-describedby"?: string };

export const inputClass =
  "w-full rounded-lg border border-strong-border bg-surface px-3 py-2 text-sm shadow-1 outline-none placeholder:text-faint hover:border-hover-border focus:border-brand focus:ring-2 focus:ring-brand/25";

export function scoreTone(score: number): keyof typeof BADGES {
  return score >= 80 ? "good" : score >= 50 ? "neutral" : "bad";
}

/** A 0–100 score as a number with a thin 20-step meter. */
export function ScoreMeter({ score }: { score: number }) {
  const filled = Math.round(score / 5);
  const color = score >= 80 ? "bg-brand" : score >= 50 ? "bg-ink" : "bg-pen";
  return (
    <div className="w-40" role="img" aria-label={`Match score ${score} out of 100`}>
      <p className="font-mono text-4xl font-medium tabular-nums tracking-tight">
        {score}
        <span className="text-base text-muted">/100</span>
      </p>
      <div className="mt-2 flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-[1px] ${i < filled ? color : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}

export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error)
    return (
      <p role="alert" className="rounded-lg border border-pen-border/60 bg-pen-soft px-3 py-2 text-sm text-pen-strong">
        {error}
      </p>
    );
  if (success)
    return (
      <p role="status" className="rounded-lg border border-brand-border/60 bg-money-soft px-3 py-2 text-sm text-money-strong">
        {success}
      </p>
    );
  return null;
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-1.5 font-serif text-[22px] font-semibold leading-none tracking-tight">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect x="1" y="1" width="16" height="16" rx="4.5" fill="var(--brand)" />
        <path d="M5 9.5l2.6 2.6L13 6.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Shortlist
    </span>
  );
}
