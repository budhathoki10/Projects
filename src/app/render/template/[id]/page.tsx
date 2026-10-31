import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CvDocument } from "@/components/cv/cv-document";
import { getBuiltin } from "@/lib/templates/registry";
import { SAMPLE_PROFILE } from "@/lib/templates/sample";

export const metadata: Metadata = { robots: { index: false } };

/** A bare built-in template with the sample CV, for `npm run templates:thumbs` to photograph. */
export default async function RenderTemplate({ params }: PageProps<"/render/template/[id]">) {
  const { id } = await params;
  const template = getBuiltin(id);
  if (!template) notFound();
  return (
    <div className="bg-paper">
      <CvDocument spec={template.spec} cv={SAMPLE_PROFILE} photoUrl="/sample-photo.svg" label={`${template.name} template`} titleLevel={1} />
    </div>
  );
}
