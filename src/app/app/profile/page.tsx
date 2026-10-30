import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ProfileEditor } from "@/components/profile-editor";
import { ProfileImport } from "@/components/profile-import";
import { ButtonLink, FormMessage } from "@/components/ui";
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
        <PageHeader
          title={profile ? "Your CV" : "Start with your CV"}
          actions={
            profile && !ready ? (
              <ButtonLink href="/app/profile/build" variant="secondary">
                Continue with the guided builder
              </ButtonLink>
            ) : undefined
          }
          subtitle={
            <>
              {welcome === "1" && <span className="font-medium text-foreground">Step 1 of 2 · </span>}
              Everything Shortlist writes for you comes from here and nowhere else.
            </>
          }
        />
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
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
          <section aria-labelledby="have-cv" className="bg-surface p-6">
            <h2 id="have-cv" className="text-base font-semibold">
              I have a CV
            </h2>
            <p className="mb-5 mt-1 text-sm text-muted">Upload it or paste it, and we&apos;ll read it into the sections below.</p>
            <ProfileImport replacing={false} />
          </section>
          <section aria-labelledby="no-cv" className="flex flex-col bg-surface p-6">
            <h2 id="no-cv" className="text-base font-semibold">
              I don&apos;t have one yet
            </h2>
            <p className="mt-1 text-sm text-muted">
              Six short steps with a live preview. Write roughly what you did and we&apos;ll turn it into bullet points, using only your words. School,
              projects, volunteering and part-time work all count.
            </p>
            <div className="mt-5">
              <ButtonLink href="/app/profile/build">Build one with help</ButtonLink>
            </div>
          </section>
        </div>
      )}

      {/* Remount only after an import, so saving keeps the form (and its message) in place. */}
      <ProfileEditor key={typeof at === "string" ? at : "profile"} initial={profile ?? { ...EMPTY_PROFILE, name: user.name, email: user.email }} />
    </div>
  );
}
