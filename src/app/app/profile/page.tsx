import type { Metadata } from "next";
import { ProfileEditor } from "@/components/profile-editor";
import { ProfileImport } from "@/components/profile-import";
import { Eyebrow, FormMessage } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { EMPTY_PROFILE } from "@/lib/model/types";
import { getProfileRow, profileReady } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Your CV" };

export default async function ProfilePage({ searchParams }: PageProps<"/app/profile">) {
  const user = await requireUser();
  const [{ welcome, needed, imported, at }, row] = await Promise.all([searchParams, getProfileRow(user.id)]);
  const profile = row?.data ?? null;
  const ready = profileReady(profile);

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <Eyebrow>{welcome === "1" ? "Step 1 of 2" : "Your profile"}</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">{profile ? "Your CV" : "Start with your CV"}</h1>
        <p className="mt-1.5 text-sm text-muted">
          Everything Shortlist writes for you comes from here and nowhere else. If it isn&apos;t in your profile, it won&apos;t appear in a tailored CV
          or cover letter.
        </p>
        {imported && (
          <div className="mt-4">
            <FormMessage
              success={
                imported === "ai"
                  ? "Your CV is in. Check every section below: this is the only source of facts we'll use."
                  : "Your CV is in. We read it with our basic reader, so check each section carefully and fix anything that landed in the wrong place."
              }
            />
          </div>
        )}
        {needed === "1" && !ready && (
          <p role="alert" className="mt-4 rounded-lg border border-pen-border/60 bg-pen-soft px-3 py-2 text-sm text-pen-strong">
            Add your CV first, with at least one job, project or qualification, so there&apos;s something to tailor.
          </p>
        )}
      </div>

      {profile ? (
        <details className="rounded-xl border border-border bg-surface shadow-1 p-5">
          <summary className="cursor-pointer text-sm font-medium">Replace from a new CV file</summary>
          <div className="mt-4">
            <ProfileImport replacing />
          </div>
        </details>
      ) : (
        <div className="rounded-xl border border-border bg-surface shadow-1 p-6">
          <ProfileImport replacing={false} />
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted">
            No CV yet? Fill in the form below instead. Even a first job hunt has something to put here: school, projects, volunteering, part-time work.
          </p>
        </div>
      )}

      {/* Remount only after an import, so saving keeps the form (and its message) in place. */}
      <ProfileEditor key={typeof at === "string" ? at : "profile"} initial={profile ?? { ...EMPTY_PROFILE, name: user.name, email: user.email }} />
    </div>
  );
}
