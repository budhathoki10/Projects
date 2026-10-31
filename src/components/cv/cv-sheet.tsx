"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/model/types";
import { fitSteps, type Fit } from "@/lib/templates/fit";
import { PAGE_MM, type TemplateSpec } from "@/lib/templates/spec";
import { CvDocument } from "./cv-document";

const PX_PER_MM = 96 / 25.4;

/** How many printed pages a CV of this height takes, given the page and its margins. */
export function pagesFor(heightPx: number, spec: Pick<TemplateSpec, "page">, margin = spec.page.margin) {
  const pageH = PAGE_MM[spec.page.size].h * PX_PER_MM;
  const m = margin * PX_PER_MM;
  return Math.max(1, Math.ceil((heightPx - 2 * m - 1) / (pageH - 2 * m)));
}

/**
 * Finds the loosest density that fits the CV on `target` pages, by measuring a hidden copy of the
 * rendered article with each step's CSS variables. Returns null when even the tightest step
 * doesn't fit, so the user knows to shorten the content instead.
 */
export function measureFit(article: HTMLElement, spec: TemplateSpec, target: number): Fit | null {
  const probe = article.cloneNode(true) as HTMLElement;
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none";
  host.appendChild(probe);
  document.body.appendChild(host);
  try {
    for (const step of fitSteps(spec)) {
      probe.style.setProperty("--cv-fs", `${step.density.fontSize}pt`);
      probe.style.setProperty("--cv-lh", String(step.density.lineHeight));
      probe.style.setProperty("--cv-gap", `${step.density.sectionGap}pt`);
      probe.style.setProperty("--cv-margin", `${step.margin}mm`);
      if (pagesFor(probe.offsetHeight, spec, step.margin) <= target) return step;
    }
    return null;
  } finally {
    host.remove();
  }
}

/**
 * A CV page scaled to fit its container, with dashed lines where pages will break when printed.
 * `articleRef` gives callers the real (unscaled) article, for fitting and "what an ATS reads".
 */
export function CvSheet({
  spec,
  cv,
  photoUrl,
  breaks = true,
  maxScale = 1,
  onPages,
  articleRef,
  className = "",
}: {
  spec: TemplateSpec;
  cv: Profile;
  photoUrl?: string | null;
  breaks?: boolean;
  maxScale?: number;
  onPages?: (pages: number) => void;
  articleRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const naturalW = PAGE_MM[spec.page.size].w * PX_PER_MM;

  useLayoutEffect(() => {
    const o = outer.current;
    const article = inner.current?.querySelector("article");
    if (!o || !article) return;
    if (articleRef) articleRef.current = article;
    const measure = () => setBox({ width: o.clientWidth, height: article.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(article);
    return () => ro.disconnect();
  }, [articleRef]);

  const scale = box.width ? Math.min(maxScale, box.width / naturalW) : 0;
  const pageH = PAGE_MM[spec.page.size].h * PX_PER_MM;
  const m = spec.page.margin * PX_PER_MM;
  const pages = box.height ? pagesFor(box.height, spec) : 1;

  useEffect(() => {
    onPages?.(pages);
  }, [pages, onPages]);

  return (
    <div ref={outer} className={`relative w-full ${className}`} style={{ height: scale ? box.height * scale : undefined }}>
      <div
        ref={inner}
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: naturalW, transform: `scale(${scale || 0.0001})`, visibility: scale ? "visible" : "hidden" }}
      >
        <div className="shadow-[0_1px_3px_rgb(0_0_0/0.08),0_8px_24px_rgb(0_0_0/0.06)]">
          <CvDocument spec={spec} cv={cv} photoUrl={photoUrl} />
        </div>
        {breaks &&
          Array.from({ length: pages - 1 }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-pen/60"
              style={{ top: m + (i + 1) * (pageH - 2 * m) }}
            >
              <span className="absolute right-2 top-1 rounded bg-danger px-1.5 py-0.5 text-[11px] font-medium text-white">Page {i + 2}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
