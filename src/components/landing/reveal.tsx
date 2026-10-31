"use client";

import { m, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** The one easing curve the whole site uses for entrances: fast out, long soft settle, no overshoot. */
export const EASE = [0.16, 1, 0.3, 1] as const;

const TAGS = { div: m.div, li: m.li, p: m.p, section: m.section, tr: m.tr } as const;

/**
 * Fades and lifts its content in once, as it scrolls into view.
 *
 * The server renders the content fully visible. After hydration, anything that is still below the fold is
 * hidden and then revealed on scroll, so with no JavaScript (or a slow load) nothing is ever stuck invisible,
 * and content already on screen never flashes. Under prefers-reduced-motion it simply stays put.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Seconds. Stagger siblings with index * 0.07. */
  delay?: number;
  y?: number;
  as?: keyof typeof TAGS;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (reduce || !el) return;
    // Already on screen: leave it alone, so there is no hide-then-show flash.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setArmed(true);
  }, [reduce]);

  const Tag = TAGS[as];
  const visible = !armed || inView;
  return (
    <Tag
      ref={ref as never}
      className={className}
      initial={false}
      animate={visible ? { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay } } : { opacity: 0, y, transition: { duration: 0 } }}
    >
      {children}
    </Tag>
  );
}
