"use client";

import { m, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { useMounted } from "./use-mounted";

/**
 * A soft pool of the accent colour that follows the pointer across a surface (mouse only; touch and
 * keyboard users never see it, and nothing depends on it). One element, moved with two CSS variables.
 */
export function Spotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const box = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - box.left}px`);
    el.style.setProperty("--my", `${e.clientY - box.top}px`);
  };
  return (
    <div ref={ref} onPointerMove={move} className={`group/spot relative overflow-hidden ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background: "radial-gradient(360px circle at var(--mx, 50%) var(--my, 50%), var(--wash), transparent 70%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Drifts its content slightly against the scroll, so the product preview sits a little apart from the text. */
export function Parallax({ children, distance = 26, className = "" }: { children: ReactNode; distance?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const on = useMounted() && !reduce;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return (
    <m.div ref={ref} style={on ? { y } : undefined} className={className}>
      {children}
    </m.div>
  );
}
