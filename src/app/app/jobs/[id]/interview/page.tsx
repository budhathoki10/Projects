import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prepareInterview } from "@/app/actions/tailor";
import { AiActionButton } from "@/components/ai-action-button";
import { PracticeAnswer } from "@/components/practice-answer";
import { ButtonLink } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getInterview } from "@/lib/services/documents";
import { ownedJob } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Interview prep" };

export default async function InterviewTab({ params }: PageProps<"/app/jobs/[id]/interview">) {
  const user = await requireUser();
  const { id } = await params;
  const [job, profile, session] = await Promise.all([ownedJob(user.id, id), getProfile(user.id), getInterview(user.id, id)]);
  if (!job) notFound();
  if (!profileReady(profile)) {
    return (
      <div className="rounded-xl border border-dashed border-strong-border px-6 py-8">
        <p className="mb-4 text-muted">Add your CV first. Questions are built from it and the job.</p>
        <ButtonLink href="/app/profile">Add your CV</ButtonLink>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="max-w-2xl space-y-4 rounded-xl border border-border bg-surface shadow-1 p-6">
        <h2 className="font-serif text-2xl font-medium">Practise for the interview</h2>
        <p className="text-sm text-muted">
          The questions an interviewer for this job is likely to ask you: about what the job needs, about your own experience, and about the gaps.
          Type an answer and get feedback on structure, detail and length.
        </p>
        <AiActionButton action={prepareInterview} jobId={job.id} label="Get my questions" pendingLabel="Preparing questions…" />
      </div>
    );
  }
  const done = session.questions.filter((q) => q.feedback).length;
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted">
        Practised {done} of {session.questions.length}. Say your answers out loud too: it&apos;s different from writing them.
      </p>
      <ol className="space-y-6">
        {session.questions.map((q, i) => (
          <li key={q.id} className="space-y-3 border-t border-border pt-5">
            <div>
              <p className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="font-serif text-xl font-medium">{q.question}</h3>
              <p className="mt-1 text-[13px] text-muted">{q.why}</p>
            </div>
            <PracticeAnswer jobId={job.id} questionId={q.id} answer={q.answer} feedback={q.feedback} />
          </li>
        ))}
      </ol>
      <div className="border-t border-border pt-5">
        <AiActionButton action={prepareInterview} jobId={job.id} label="New set of questions" pendingLabel="Preparing…" variant="secondary" />
      </div>
    </div>
  );
}
