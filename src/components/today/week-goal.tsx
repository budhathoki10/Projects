import { weeklyGoalAction } from "@/app/actions/jobs";

/** "This week ■■□□□ 2 of 5" with a small inline form to change the goal. */
export function WeekGoal({ done, goal }: { done: number; goal: number }) {
  const boxes = Math.min(goal, 10);
  const filled = Math.min(boxes, Math.round((done / goal) * boxes));
  return (
    <div className="text-[13px]">
      <div className="flex items-center gap-2.5">
        <span className="text-muted">This week</span>
        <span className="flex gap-[3px]" role="img" aria-label={`${done} of ${goal} applications this week`}>
          {Array.from({ length: boxes }, (_, i) => (
            <span key={i} className={`size-2.5 rounded-[3px] ${i < filled ? "bg-brand" : "bg-subtle ring-1 ring-inset ring-border"}`} />
          ))}
        </span>
        <span className="font-medium tabular-nums">
          {done} of {goal}
        </span>
      </div>
      <details className="group mt-1 text-right [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none text-muted underline-offset-4 hover:text-foreground hover:underline">Change goal</summary>
        <form action={weeklyGoalAction} className="mt-2 flex items-center justify-end gap-2">
          <label htmlFor="goal" className="text-muted">
            Applications a week
          </label>
          <input id="goal" name="goal" type="number" min={1} max={30} defaultValue={goal} className="h-8 w-16 rounded-lg border border-strong-border bg-surface px-2 text-sm" />
          <button type="submit" className="h-8 rounded-lg border border-strong-border bg-surface px-3 font-medium hover:border-hover-border">
            Save
          </button>
        </form>
      </details>
    </div>
  );
}
