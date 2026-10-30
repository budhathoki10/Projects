"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { changeStatus } from "@/app/actions/jobs";
import { Icon } from "./icons";
import { Badge, scoreTone } from "./ui";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/services/job-status";

export type BoardJob = {
  id: string;
  title: string;
  company: string;
  status: Status;
  score: number | null;
  appliedOn: string | null;
  createdAt: string;
  tailored: boolean;
};

const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

type Sort = "added" | "match" | "applied";

/**
 * All jobs as a board (drag a card to another stage, or use its stage menu) or as a sortable
 * table. Moves show at once and save in the background.
 */
export function JobsBoard({ jobs }: { jobs: BoardJob[] }) {
  const [view, setView] = useState<"board" | "table">("board");
  const [sort, setSort] = useState<Sort>("added");
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [, startTransition] = useTransition();
  const [items, move] = useOptimistic(jobs, (cur, { id, status }: { id: string; status: Status }) => cur.map((j) => (j.id === id ? { ...j, status } : j)));

  const moveTo = (id: string, status: Status) => {
    const fd = new FormData();
    fd.set("jobId", id);
    fd.set("status", status);
    startTransition(async () => {
      move({ id, status });
      await changeStatus(fd);
    });
  };

  const sorted = useMemo(() => {
    const list = [...items];
    if (sort === "match") list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    else if (sort === "applied") list.sort((a, b) => (b.appliedOn ?? "").localeCompare(a.appliedOn ?? ""));
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [items, sort]);

  const toggle = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px]";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="View" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")} className={`${toggle} ${view === "board" ? "bg-ink text-on-ink" : "text-muted"}`}>
            <Icon name="board" size={15} /> Board
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")} className={`${toggle} ${view === "table" ? "bg-ink text-on-ink" : "text-muted"}`}>
            <Icon name="table" size={15} /> Table
          </button>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-xl border border-border bg-surface shadow-1 px-2 text-[13px] text-foreground">
            <option value="added">Newest</option>
            <option value="match">Best match</option>
            <option value="applied">Applied date</option>
          </select>
        </label>
      </div>

      {view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
          <div className="grid min-w-[60rem] grid-cols-5 gap-3">
            {STATUSES.map((s) => {
              const col = sorted.filter((j) => j.status === s);
              return (
                <section
                  key={s}
                  id={`stage-${s}`}
                  aria-labelledby={`col-${s}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(s);
                  }}
                  onDragLeave={() => setOver((o) => (o === s ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    setOver(null);
                    setDragging(null);
                    if (id && items.find((j) => j.id === id)?.status !== s) moveTo(id, s);
                  }}
                  className={`min-w-0 scroll-mt-24 rounded-xl p-2 transition-colors ${over === s ? "bg-brand-soft ring-2 ring-brand-border" : "bg-panel"}`}
                >
                  <h2 id={`col-${s}`} className="mb-2 flex items-baseline justify-between px-1 text-[13px] font-medium">
                    {STATUS_LABELS[s]}
                    <span className="font-mono text-muted">{col.length}</span>
                  </h2>
                  <ul className="min-h-24 space-y-2">
                    {col.map((j) => (
                      <li
                        key={j.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", j.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragging(j.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                        className={`group relative rounded-lg border border-border bg-surface p-3 shadow-1 transition hover:border-strong-border ${dragging === j.id ? "opacity-40" : ""}`}
                      >
                        <Link href={`/app/jobs/${j.id}`} className="block after:absolute after:inset-0">
                          <p className="truncate pr-6 text-sm font-medium">{j.title || "Untitled job"}</p>
                        </Link>
                        <p className="truncate text-[13px] text-muted">{j.company || "Company not stated"}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                          {j.score !== null ? <Badge tone={scoreTone(j.score)}>{j.score}% match</Badge> : <span />}
                          {j.appliedOn ? <span>Applied {day(j.appliedOn)}</span> : j.tailored ? <span className="text-money">CV tailored</span> : null}
                        </div>
                        <label className="absolute right-1.5 top-1.5 z-10">
                          <span className="sr-only">Move {j.title} to</span>
                          <select
                            value={j.status}
                            onChange={(e) => moveTo(j.id, e.target.value as Status)}
                            className="size-7 cursor-pointer appearance-none rounded-md bg-transparent text-transparent opacity-60 hover:bg-subtle hover:opacity-100 focus:opacity-100"
                            style={{ backgroundImage: "radial-gradient(circle, var(--muted) 1.4px, transparent 1.6px)", backgroundSize: "6px 6px", backgroundPosition: "center", backgroundRepeat: "repeat-x" }}
                          >
                            {STATUSES.map((o) => (
                              <option key={o} value={o} className="text-foreground">
                                {STATUS_LABELS[o]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-muted">
                <th className="px-4 py-2.5 font-medium">Job</th>
                <th className="px-4 py-2.5 font-medium">Match</th>
                <th className="px-4 py-2.5 font-medium">Stage</th>
                <th className="px-4 py-2.5 font-medium">Applied</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((j) => (
                <tr key={j.id} className="border-b border-border last:border-0 hover:bg-subtle">
                  <td className="px-4 py-3">
                    <Link href={`/app/jobs/${j.id}`} className="font-medium hover:underline">
                      {j.title || "Untitled job"}
                    </Link>
                    <p className="text-[13px] text-muted">{j.company}</p>
                  </td>
                  <td className="px-4 py-3">{j.score !== null ? <Badge tone={scoreTone(j.score)}>{j.score}%</Badge> : "–"}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Stage for ${j.title}`}
                      value={j.status}
                      onChange={(e) => moveTo(j.id, e.target.value as Status)}
                      className="h-8 rounded-xl border border-border bg-surface shadow-1 px-2 text-[13px]"
                    >
                      {STATUSES.map((o) => (
                        <option key={o} value={o}>
                          {STATUS_LABELS[o]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted">{j.appliedOn ? day(j.appliedOn) : "–"}</td>
                  <td className="px-4 py-3 text-muted">{day(j.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
