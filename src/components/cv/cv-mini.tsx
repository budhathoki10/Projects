"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/model/types";
import { PAGE_MM, type TemplateSpec } from "@/lib/templates/spec";
import { CvDocument } from "./cv-document";

/** A small picture of the first page of a CV, scaled to its card's width. Decorative. */
export function CvMini({ spec, cv, photoUrl }: { spec: TemplateSpec; cv: Profile; photoUrl?: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const page = PAGE_MM[spec.page.size];
  const naturalW = (page.w * 96) / 25.4;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="relative w-full overflow-hidden bg-paper" style={{ aspectRatio: `${page.w} / ${page.h}` }} aria-hidden>
      {width > 0 && (
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: naturalW, transform: `scale(${width / naturalW})` }}>
          <CvDocument spec={spec} cv={cv} photoUrl={photoUrl} label="CV thumbnail" />
        </div>
      )}
    </div>
  );
}
