"use client";

import { useActionState } from "react";
import { practiseAnswer } from "@/app/actions/tailor";
import type { AnswerFeedback } from "@/lib/model/types";
import { Button, FormMessage, inputClass } from "./ui";
import { keepInputOnSubmit } from "./use-keep-input";

export function PracticeAnswer({ jobId, questionId, answer, feedback }: { jobId: string; questionId: string; answer: string; feedback: AnswerFeedback | null }) {
  const [state, action, pending] = useActionState(practiseAnswer, undefined);
  return (
    <div className="space-y-3">
      <form onSubmit={keepInputOnSubmit(action)} className="space-y-2">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="questionId" value={questionId} />
        <textarea
          name="answer"
          aria-label="Your answer"
          defaultValue={answer}
          rows={6}
          className={inputClass}
          placeholder="Write it as you'd say it. A real example works best: what was going on, what you did, what changed."
        />
        <Button type="submit" variant="secondary" disabled={pending} className="py-1.5">
          {pending ? "Reading your answer…" : answer ? "Get feedback again" : "Get feedback"}
        </Button>
        <FormMessage error={state?.error} />
      </form>
      {feedback && (
        <div className="space-y-3 rounded-lg border border-border bg-panel p-4 text-sm">
          <p className="font-medium">
            <span className="font-mono">{feedback.score}/5</span>
            <span className="ml-2 text-muted">
              {feedback.score >= 4 ? "Strong answer" : feedback.score === 3 ? "Good, with room to sharpen" : "Needs a concrete example"}
            </span>
          </p>
          {feedback.strengths.length > 0 && (
            <div>
              <p className="text-[13px] font-medium text-money">Working</p>
              <ul className="ml-5 list-disc text-[13px]">
                {feedback.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {feedback.improve.length > 0 && (
            <div>
              <p className="text-[13px] font-medium">To improve</p>
              <ul className="ml-5 list-disc text-[13px]">
                {feedback.improve.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {feedback.rewrite && (
            <details>
              <summary className="cursor-pointer text-[13px] font-medium">A tighter version</summary>
              <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed">{feedback.rewrite}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
