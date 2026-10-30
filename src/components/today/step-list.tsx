import Link from "next/link";
import { followUpAction } from "@/app/actions/jobs";
import type { Step } from "@/lib/today";

/** Today's to-do list: one row per step, each with a single clear action. */
export function StepList({ steps }: { steps: Step[] }) {
  if (!steps.length) {
    return (
      <p className="border-y border-border py-6 text-[15px] text-muted">
        You&apos;re all caught up.{" "}
        <Link href="/app/jobs?add=1" className="text-foreground underline underline-offset-4">
          Add another job
        </Link>{" "}
        if you&apos;d like to get ahead.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-border border-y border-border">
      {steps.map((s, i) => (
        <li key={`${s.kind}-${s.jobId ?? s.href}-${i}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 sm:flex-nowrap">
          <span className="mt-0.5 size-4 shrink-0 self-start rounded-full border-[1.5px] border-strong-border sm:self-center" aria-hidden />
          <div className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-0">
            <p className="text-[15px] font-medium">{s.title}</p>
            <p className="text-[13px] text-muted sm:truncate">{s.detail}</p>
          </div>
          <div className="ml-8 flex shrink-0 items-center gap-3 sm:ml-0">
            {s.alt && (
              <Link href={s.alt.href} className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
                {s.alt.label}
              </Link>
            )}
            {s.jobId && s.kind === "follow-up" && (
              <form action={followUpAction}>
                <input type="hidden" name="jobId" value={s.jobId} />
                <button type="submit" name="op" value="done" className="text-[13px] text-muted underline-offset-4 hover:text-foreground hover:underline">
                  Done
                </button>
              </form>
            )}
            <Link
              href={s.href}
              className={`inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium transition-colors ${
                i === 0 ? "bg-ink text-on-ink hover:bg-ink-hover" : "border border-strong-border bg-surface hover:border-hover-border hover:bg-panel"
              }`}
            >
              {s.cta}
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
