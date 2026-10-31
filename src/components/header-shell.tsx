"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The public header. It sits flat on the page at the top and gains a hairline and a solid surface once the page
 * scrolls under it, so it never looks like a bar stuck on top of the hero. Only that one flag is client state.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 8));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);
  return (
    <header
      data-scrolled={scrolled}
      className="sticky top-0 z-30 border-b border-transparent bg-background/0 transition-[background-color,border-color] duration-200 ease-out data-[scrolled=true]:border-border data-[scrolled=true]:bg-surface"
    >
      {children}
    </header>
  );
}
