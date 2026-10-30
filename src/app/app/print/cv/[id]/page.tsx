import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CvPreview } from "@/components/cv-preview";
import { PrintButton } from "@/components/print-button";
import { requireUser } from "@/lib/auth/session";
import { cvFileName } from "@/lib/export/docx";
import { getTailoredCv } from "@/lib/services/documents";
import { ownedJob } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";
import { applyChanges } from "@/lib/tailor/apply";

export async function generateMetadata({ params }: PageProps<"/app/print/cv/[id]">): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const [job, profile] = await Promise.all([ownedJob(user.id, id), getProfile(user.id)]);
  // Browsers suggest the page title as the PDF's file name.
  return { title: { absolute: job && profile ? cvFileName(profile, job.post.title, "pdf").replace(/\.pdf$/, "") : "CV" } };
}

export default async function PrintCv({ params }: PageProps<"/app/print/cv/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [job, profile, doc] = await Promise.all([ownedJob(user.id, id), getProfile(user.id), getTailoredCv(user.id, id)]);
  if (!job || !profileReady(profile)) notFound();
  const cv = applyChanges(profile, doc?.cv?.changes ?? []);
  return (
    <div className="mx-auto max-w-[52rem] space-y-4 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">In the print window, choose &ldquo;Save as PDF&rdquo; as the destination.</p>
        <PrintButton auto />
      </div>
      <div className="rounded-md border border-strong-border print:border-0">
        <CvPreview cv={cv} />
      </div>
    </div>
  );
}
