import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { TemplateGallery } from "@/components/studio/template-gallery";
import { Eyebrow } from "@/components/ui";
import { SAMPLE_PROFILE } from "@/lib/templates/sample";

export const metadata: Metadata = {
  title: "100 free CV templates",
  description: "100 CV templates that look good and say clearly whether applicant tracking systems can read them. Free to use, or make your own.",
};

export default function PublicTemplates() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
        <header className="mb-10 max-w-2xl">
          <Eyebrow>CV templates</Eyebrow>
          <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight">100 CV templates, honestly labelled.</h1>
          <p className="mt-4 text-lg text-muted">
            Each one says whether applicant tracking systems can read it. All are free. Sign up to see them with your own CV, change fonts and colours, or
            make your own.
          </p>
        </header>
        <TemplateGallery cv={SAMPLE_PROFILE} photoUrl="/sample-photo.svg" mode={{ kind: "public" }} />
      </main>
      <SiteFooter />
    </>
  );
}
