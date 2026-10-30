import type { Metadata } from "next";
import { TemplateGallery } from "@/components/studio/template-gallery";
import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { listJobs } from "@/lib/services/jobs";
import { photoUrl } from "@/lib/services/photos";
import { getProfile, profileReady } from "@/lib/services/profile";
import { getDefaultTemplateId } from "@/lib/services/templates";
import { SAMPLE_PROFILE } from "@/lib/templates/sample";

export const metadata: Metadata = { title: "CV templates" };

export default async function TemplatesPage() {
  const user = await requireUser();
  const [profile, photo, defaultId, jobs] = await Promise.all([getProfile(user.id), photoUrl(user.id), getDefaultTemplateId(user.id), listJobs(user.id)]);
  const ready = profileReady(profile);
  return (
    <div className="space-y-8">
      <header>
        <Eyebrow>CV Studio</Eyebrow>
        <h1 className="mt-1 font-serif text-4xl">100 templates</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {ready
            ? "Every preview shows your own CV. Pick one as your default, use it for one job, or customise it into your own."
            : "Previews use a sample CV until you add yours."}
        </p>
      </header>
      <TemplateGallery
        cv={ready ? profile : SAMPLE_PROFILE}
        photoUrl={ready ? photo : "/sample-photo.svg"}
        mode={{ kind: "app", defaultId, jobs: jobs.map((j) => ({ id: j.id, title: j.post.title, company: j.post.company })) }}
      />
    </div>
  );
}
