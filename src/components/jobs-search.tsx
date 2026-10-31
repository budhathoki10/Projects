"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { icons } from "./icons";
import { inputClass } from "./ui";

/** Filters the job list as you type. The query lives in the URL (?q=), so a filtered view can be shared, bookmarked and reached with Back. */
export function JobsSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const push = (q: string) => {
    const next = new URLSearchParams(params.toString());
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    startTransition(() => router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false }));
  };

  return (
    <div className="relative w-full sm:max-w-xs">
      <label htmlFor="jobs-search" className="sr-only">
        Search your jobs
      </label>
      <icons.search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        id="jobs-search"
        type="search"
        value={value}
        placeholder="Search title or company"
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => push(e.target.value), 200);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            setValue("");
            push("");
          }
        }}
        aria-busy={pending}
        className={`${inputClass} pl-9`}
      />
    </div>
  );
}
