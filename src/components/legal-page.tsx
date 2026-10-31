import type { ReactNode } from "react";
import { SITE } from "@/lib/site";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { Eyebrow } from "./ui";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <Eyebrow>Last updated {SITE.legalUpdated}</Eyebrow>
        <h1 className="t-heading mt-2 text-balance">{title}</h1>
        <div className="mt-10 space-y-4 text-base leading-7 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.015em] [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
