"use client";

import { ActionToast } from "@/components/toast";
import { useActionState, useState } from "react";
import { continueMockInterview, submitMockAnswer } from "@/app/actions/career";
import type { MockTurn } from "@/lib/career/types";
import { Button, inputClass } from "../ui";
import { keepInputOnSubmit } from "../use-keep-input";

export function MockAnswerForm({ jobId, sessionId, version, turn }: { jobId: string; sessionId: string; version: number; turn: MockTurn }) {
  const [state, action, pending] = useActionState(submitMockAnswer, undefined);
  const [answer, setAnswer] = useState(turn.answer);
  return <form method="post" onSubmit={keepInputOnSubmit(action)} className="space-y-3">
    <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="sessionId" value={sessionId} /><input type="hidden" name="version" value={version} />
    <label htmlFor="mock-answer" className="block text-sm font-medium">Your interview answer{turn.question.kind === "coding" ? " or code" : ""}</label>
    <textarea id="mock-answer" name="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={9} maxLength={12000} className={`${inputClass} ${turn.question.kind === "coding" ? "font-mono" : ""}`} placeholder="Answer as you would in an interview. It is fine to explain what you do not know. Use your own examples." />
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" loading={pending}>{pending ? "Reviewing your answer…" : "Submit interview answer"}</Button><span className="text-xs text-muted">{answer.trim() ? answer.trim().split(/\s+/).length : 0} words · no minimum word count</span></div>
    <ActionToast state={state} only="error" />
  </form>;
}

export function MockContinue({ sessionId, version, finish = false, label }: { sessionId: string; version: number; finish?: boolean; label: string }) {
  const [state, action, pending] = useActionState(continueMockInterview, undefined);
  return <form action={action} className="space-y-2"><input type="hidden" name="sessionId" value={sessionId} /><input type="hidden" name="version" value={version} />{finish && <input type="hidden" name="finish" value="1" />}<Button type="submit" variant={finish ? "secondary" : "primary"} loading={pending}>{pending ? "Saving…" : label}</Button><ActionToast state={state} only="error" /></form>;
}
