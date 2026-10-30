import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TemplateGallery } from "@/components/studio/template-gallery";
import Link from "next/link";
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
      <PageHeader
        back={<Link href="/app/studio" className="hover:text-foreground">CV Studio</Link>}
        title="Templates"
        subtitle={ready ? "Every preview shows your own CV. Use one as your default, for one job, or customise it." : "Previews use a sample CV until you add yours."}
      />
      <TemplateGallery
        cv={ready ? profile : SAMPLE_PROFILE}
        photoUrl={ready ? photo : "/sample-photo.svg"}
        mode={{ kind: "app", defaultId, jobs: jobs.map((j) => ({ id: j.id, title: j.post.title, company: j.post.company })) }}
      />
    </div>
  );
}
