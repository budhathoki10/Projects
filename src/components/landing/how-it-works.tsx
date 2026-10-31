"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Spotlight } from "./interactive";
import { Reveal } from "./reveal";

type Step = readonly [title: string, text: string];

const t = "transition-[opacity,transform,background-color,text-decoration-color] duration-700 ease-out";
const shown = (on: boolean) => (on ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0");
const delay = (ms: number) => ({ transitionDelay: `${ms}ms` });

/** A small picture of what each step does, drawn from the real interface's own tokens. `on` plays it. */
function Visual({ index, on }: { index: number; on: boolean }) {
  if (index === 0) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded bg-accent-soft text-accent-strong">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 15.5h6" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">cv.pdf</p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken">
              <div className={`h-full origin-left rounded-full bg-accent ${on ? "scale-x-100" : "scale-x-0"}`} style={{ transition: "transform 1100ms cubic-bezier(0.16,1,0.3,1)" }} />
            </div>
          </div>
        </div>
        <p className={`text-[13px] text-success ${t} ${shown(on)}`} style={delay(700)}>
          Read: 2 roles · 1 education · 8 skills
        </p>
      </div>
    );
  }
  if (index === 1) {
    const chips = [
      ["bg-success", "Zendesk", "You show this"],
      ["bg-warning", "Customer success", "Only in your skills"],
      ["bg-danger", "HubSpot", "Not in your CV"],
    ] as const;
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-muted">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          </svg>
          <span className="truncate">northwind.com/jobs/customer-success-lead</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map(([dot, word, label], k) => (
            <span key={word} className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[13px] ${t} ${shown(on)}`} style={delay(250 + k * 200)}>
              <i className={`size-1.5 rounded-full ${dot}`} />
              {word}
              <span className="text-faint">· {label}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="rounded-md border border-border bg-background p-3 text-[13px] leading-relaxed" aria-hidden="true">
        <del className={`${t} ${on ? "[text-decoration-color:var(--faint)]" : "[text-decoration-color:transparent]"} text-faint`}>Answered customer tickets </del>
        <ins className={`rounded-[2px] px-0.5 no-underline ${t} ${on ? "bg-mark" : "bg-transparent"}`} style={delay(450)}>
          Onboarded 40 new business accounts in Zendesk,{" "}
        </ins>
        keeping churn under 3%
        <p className={`mt-2 text-success ${t} ${shown(on)}`} style={delay(900)}>
          Using · every fact is in your CV
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3" aria-hidden="true">
      <span className="grid size-9 shrink-0 place-items-center rounded bg-warning-soft text-warning">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium">Follow up: Customer Success Lead</p>
        <p className="text-[13px] text-muted">No answer in 7 days. A polite note is ready.</p>
        <span className={`mt-2 inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent-strong ${t} ${shown(on)}`} style={delay(500)}>
          Review the note
        </span>
      </div>
    </div>
  );
}

function StepCard({ step, index, active, played, enhanced }: { step: Step; index: number; active: boolean; played: boolean; enhanced: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const [title, text] = step;
  // Wide screens: a step plays when it becomes current and stays played. Everywhere else: it plays once, when scrolled to.
  const on = enhanced ? played : seen;
  return (
    <li ref={ref} data-step>
      <Reveal>
        <Spotlight className={`rounded-xl border p-5 transition-[background-color,border-color,box-shadow] duration-500 ease-out sm:p-6 ${enhanced && active ? "border-accent/35 bg-surface shadow-[0_14px_34px_-18px_rgb(47_91_234/0.35)]" : "border-border bg-surface shadow-[0_1px_0_rgb(17_19_26/0.03)]"}`}>
          <div className="flex items-baseline gap-3">
            <span className={`font-mono text-xs tabular-nums transition-colors duration-500 ${active && enhanced ? "text-accent" : "text-faint"}`}>{String(index + 1).padStart(2, "0")}</span>
            <h3 className="text-lg font-semibold tracking-[-0.01em]">{title}</h3>
          </div>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">{text}</p>
          <div className={`mt-5 transition-opacity duration-500 ${enhanced && !active ? "opacity-50" : ""}`}>
            <Visual index={index} on={on} />
          </div>
        </Spotlight>
      </Reveal>
    </li>
  );
}

/**
 * Four steps. On wide screens the title stays in view while a line fills as you scroll and the current step comes
 * forward (GSAP ScrollTrigger, loaded only here and only then). On phones, and for anyone who asks for reduced
 * motion, it is a plain list whose steps reveal as they arrive.
 */
export function HowItWorks({ steps }: { steps: readonly Step[] }) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    if (!wide.matches) return;
    let cancelled = false;
    let revert: (() => void) | undefined;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled || !root.current || !list.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        gsap.fromTo("[data-fill]", { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: list.current, start: "top 58%", end: "bottom 58%", scrub: 0.4 } });
        gsap.utils.toArray<HTMLElement>("[data-step]").forEach((el, i) => {
          ScrollTrigger.create({ trigger: el, start: "top 58%", end: "bottom 58%", onToggle: (self) => {
              if (!self.isActive) return;
              setActive(i);
              setReached((r) => Math.max(r, i));
            },
          });
        });
      }, root);
      revert = () => ctx.revert();
      setEnhanced(true);
      ScrollTrigger.refresh();
    })();
    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return (
    <div ref={root} className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[2rem] sm:leading-[1.15]">How it works</h2>
        <p className="mt-3 max-w-sm text-muted">Four steps, and you stay in charge of every one.</p>
        <div className={enhanced ? "mt-8 hidden gap-5 lg:flex" : "hidden"} aria-hidden="true">
          <div className="relative w-px bg-border">
            <div data-fill className="absolute inset-0 origin-top scale-y-0 bg-accent" />
          </div>
          <ul className="space-y-3 text-sm">
            {steps.map(([title], i) => (
              <li key={title} className={`flex items-baseline gap-3 transition-colors duration-300 ${active === i ? "text-foreground" : "text-faint"}`}>
                <span className={`font-mono text-xs tabular-nums transition-colors duration-300 ${active === i ? "text-accent" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
                {title}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ol ref={list} className="space-y-5 lg:space-y-[16vh]">
        {steps.map((step, i) => (
          <StepCard key={step[0]} step={step} index={i} active={active === i} played={reached >= i} enhanced={enhanced} />
        ))}
      </ol>
    </div>
  );
}
