"use client";

import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { useMounted } from "./use-mounted";

function Word({ word, index, total, progress, on }: { word: string; index: number; total: number; progress: MotionValue<number>; on: boolean }) {
  const start = index / total;
  const opacity = useTransform(progress, [start, Math.min(1, start + 2.5 / total)], [0.25, 1]);
  return (
    <>
      <m.span style={on ? { opacity } : undefined}>{word}</m.span>{" "}
    </>
  );
}

/**
 * A paragraph whose words firm up from faint to full as it scrolls through the middle of the screen. The text is
 * ordinary text in the page, so search engines and screen readers get it all at once; the effect is only an
 * opacity change, and it is off for people who ask for reduced motion (and before the page has loaded).
 */
export function ScrollWords({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const on = useMounted() && !reduce;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.88", "end 0.55"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <Word key={`${w}-${i}`} word={w} index={i} total={words.length} progress={scrollYProgress} on={on} />
      ))}
    </p>
  );
}
