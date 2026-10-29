import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { writeCover } from "@/app/actions/tailor";
import { AiActionButton } from "@/components/ai-action-button";
import { CoverLetterEditor } from "@/components/cover-letter-editor";
import { ButtonLink } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getProfile, profileReady } from "@/lib/services/profile";
import { getCoverLetter } from "@/lib/services/documents";
import { ownedJob } from "@/lib/services/jobs";
import { unsupportedFacts } from "@/lib/tailor/fact-check";

export const metadata: Metadata = { title: "Cover letter" };

export default async function CoverTab({ params }: PageProps<"/app/jobs/[id]/cover-letter">) {
  const user = await requireUser();
  const { id } = await params;
  const [job, profile, doc] = await Promise.all([ownedJob(user.id, id), getProfile(user.id), getCoverLetter(user.id, id)]);
  if (!job) notFound();
  if (!profileReady(profile)) {
    return (
      <div className="rounded-md border border-dashed border-strong-border px-6 py-8">
        <p className="mb-4 text-muted">Add your CV first. The letter is written from it.</p>
        <ButtonLink href="/app/profile">Add your CV</ButtonLink>
      </div>
    );
  }
  if (!doc?.text) {
    return (
      <div className="max-w-2xl space-y-4 rounded-md border border-border bg-surface p-6">
        <h2 className="font-serif text-2xl font-medium">A cover letter for this job</h2>
        <p className="text-sm text-muted">
          Short, specific and in plain words: why this job, and two or three things you&apos;ve actually done that it needs. Nothing invented. Edit it
          until it sounds like you.
        </p>
        <AiActionButton action={writeCover} jobId={job.id} label="Write a draft" pendingLabel="Writing…" />
      </div>
    );
  }
  return (
    <div className="max-w-3xl">
      <CoverLetterEditor
        key={doc.updatedAt.toISOString()}
        jobId={job.id}
        initial={doc.text}
        flags={unsupportedFacts(doc.text, profile, JSON.stringify(job.post))}
      />
    </div>
  );
}
