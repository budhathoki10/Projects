"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "./icons";

/**
 * Short confirmations ("Email confirmed", "Template deleted") that appear in a corner and leave by
 * themselves. Anything the person must act on stays on the page instead, next to what it's about.
 */

type Tone = "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

const SHOW_MS = 5000;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, tone: Tone = "success") {
  // The same message twice in a row (a double click, a strict-mode remount) shows once.
  if (toasts.some((t) => t.message === message)) return;
  toasts = [...toasts.slice(-2), { id: nextId++, message, tone }];
  emit();
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const NONE: Toast[] = [];

/** Where toasts appear: under the top bar on phones (clear of the tab bar and Add button), bottom right on larger screens. Mounted once. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => NONE);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:items-end md:px-0 print:hidden"
    >
      {list.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t }: { toast: Toast }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(SHOW_MS);
  const started = useRef(0);

  // The countdown stops while the pointer or keyboard focus is on the toast, so it can be read.
  useEffect(() => {
    if (paused) return;
    started.current = Date.now();
    const timer = setTimeout(() => dismiss(t.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started.current;
    };
  }, [paused, t.id]);

  return (
    <div
      role={t.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-2.5 rounded-xl bg-ink py-3 pl-3.5 pr-2 text-sm text-on-ink shadow-3 motion-reduce:animate-none"
    >
      <Icon name={t.tone === "error" ? "alert" : "done"} size={18} className="mt-px shrink-0 opacity-80" />
      <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
      <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-my-1 shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 focus-visible:opacity-100">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

/**
 * Shows a toast once when a page loads with a one-off flag in its address (like `?verified=1`),
 * then removes the flag, so reloading or sharing the link doesn't show it again.
 */
export function FlashToast({ message, tone = "success", clear }: { message: string | null | undefined; tone?: Tone; clear: string[] }) {
  const shown = useRef(false);
  useEffect(() => {
    if (!message || shown.current) return;
    shown.current = true;
    toast(message, tone);
    const url = new URL(window.location.href);
    for (const key of clear) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per message; `clear` is a fresh array each render
  }, [message, tone]);
  return null;
}
