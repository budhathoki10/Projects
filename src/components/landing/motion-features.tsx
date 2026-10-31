"use client";

import { domAnimation, LazyMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Loads only Motion's DOM animation features for the landing page. The landing components use the
 * lightweight `m` elements, which `strict` keeps that way.
 */
export function MotionFeatures({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
