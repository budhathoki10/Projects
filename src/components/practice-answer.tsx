"use client";

import { ActionToast } from "@/components/toast";
import { useActionState, useState } from "react";
import { practiseAnswer } from "@/app/actions/tailor";
import type { AnswerFeedback } from "@/lib/model/types";
import { inputClass, Kbd } from "./ui";
import { FormSubmit } from "./form-submit";
import { keepInputOnSubmit } from "./use-keep-input";
import { InterviewFeedback } from "./interview-feedback";

export function PracticeAnswer({ jobId, questionId, answer, feedback, draft, onDraftChange }: { jobId: string; questionId: string; answer: string; feedback: AnswerFeedback | null; draft?: string; onDraftChange?: (value: string) => void }) {
  const [state, action, pending] = useActionState(practiseAnswer, undefined);
  const [text, setText] = useState(draft ?? answer);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-3">
      <form method="post" onSubmit={keepInputOnSubmit(action)} className="space-y-3">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="questionId" value={questionId} />
        <textarea
          name="answer"
          aria-label="Your answer"
          value={text}
          onChange={(e) => { setText(e.target.value); onDraftChange?.(e.target.value); }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={7}
          className={`${inputClass} leading-relaxed`}
          placeholder="Start with what you know. Even one sentence is enough to get coaching. Describe the situation, your action, and what happened."
        />
        <div className="flex flex-wrap items-center gap-3">
          <FormSubmit variant="secondary" size="sm" loading={pending}>
            {pending ? "Reading your answer…" : answer ? "Get feedback again" : "Get feedback"}
          </FormSubmit>
          <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd>
          </span>
          <span className="ml-auto text-xs tabular-nums text-muted">
            {words} word{words === 1 ? "" : "s"} · {words < 40 ? "a starting point is enough" : `about ${Math.max(1, Math.round(words / 130 * 60))} seconds spoken`}
          </span>
        </div>
        <ActionToast state={state} only="error" />
      </form>
      {feedback && text !== answer && <p className="text-xs text-muted">You’ve changed your answer. Get feedback again to review this version.</p>}
      {feedback && text === answer && <InterviewFeedback review={{ ...feedback, improvements: feedback.improve, improvedAnswer: feedback.rewrite, corrections: feedback.corrections ?? [], modelAnswer: feedback.modelAnswer ?? "", rubric: feedback.rubric ?? [] }} />}
    </div>
  );
}
