import "server-only";
import { and, count, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Job } from "@/db/schema";
import { addDays } from "@/lib/dates";
import { scoreMatch } from "@/lib/match/score";
import type { JobPost, Match, Profile } from "@/lib/model/types";
import { today } from "@/lib/plans";

import type { Status } from "./job-status";

export { isStatus, STATUS_LABELS, STATUSES, type Status } from "./job-status";

/** Days after applying before we suggest a polite follow-up. */
export const FOLLOW_UP_AFTER_DAYS = 7;

export async function createJob(userId: string, input: { url: string | null; postText: string; post: JobPost; match: Match | null }) {
  const [job] = await db.insert(schema.jobs).values({ userId, ...input }).returning();
  return job;
}

export async function ownedJob(userId: string, jobId: string): Promise<Job | null> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, userId)))
    .limit(1);
  return job ?? null;
}

export function listJobs(userId: string) {
  return db.select().from(schema.jobs).where(eq(schema.jobs.userId, userId)).orderBy(desc(schema.jobs.updatedAt));
}

export async function setMatch(jobId: string, match: Match) {
  await db.update(schema.jobs).set({ match }).where(eq(schema.jobs.id, jobId));
}

/** Re-score every job after the profile changes, so match badges stay current. Plain code, no AI. */
export async function rescoreAll(userId: string, profile: Profile) {
  const jobs = await db.select({ id: schema.jobs.id, post: schema.jobs.post }).from(schema.jobs).where(eq(schema.jobs.userId, userId));
  for (const j of jobs) await setMatch(j.id, scoreMatch(profile, j.post));
}

/**
 * Move a job along. Applying sets a follow-up a week out; any answer from the employer
 * (interview, offer, rejection) clears it.
 */
export async function setStatus(userId: string, jobId: string, status: Status, day = today()) {
  const job = await ownedJob(userId, jobId);
  if (!job) return null;
  const patch: Partial<typeof schema.jobs.$inferInsert> = { status, updatedAt: new Date() };
  if (status === "applied") {
    patch.appliedOn = job.appliedOn ?? day;
    patch.followUpOn = job.status === "applied" ? job.followUpOn : addDays(day, FOLLOW_UP_AFTER_DAYS);
  } else if (status === "saved") {
    patch.followUpOn = null;
  } else {
    patch.followUpOn = null;
    patch.appliedOn = job.appliedOn ?? day;
  }
  await db.update(schema.jobs).set(patch).where(eq(schema.jobs.id, jobId));
  return status;
}

export async function setFollowUp(userId: string, jobId: string, day: string | null) {
  await db
    .update(schema.jobs)
    .set({ followUpOn: day, updatedAt: new Date() })
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, userId)));
}

export async function setNotes(userId: string, jobId: string, notes: string) {
  await db
    .update(schema.jobs)
    .set({ notes: notes || null, updatedAt: new Date() })
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, userId)));
}

export async function deleteJob(userId: string, jobId: string) {
  await db.delete(schema.jobs).where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, userId)));
}

const dueWhere = (userId: string, day: string) =>
  and(eq(schema.jobs.userId, userId), eq(schema.jobs.status, "applied"), isNotNull(schema.jobs.followUpOn), lte(schema.jobs.followUpOn, day));

export function dueFollowUps(userId: string, day = today()) {
  return db.select().from(schema.jobs).where(dueWhere(userId, day)).orderBy(schema.jobs.followUpOn);
}

export async function dueFollowUpCount(userId: string, day = today()) {
  const [row] = await db.select({ n: count() }).from(schema.jobs).where(dueWhere(userId, day));
  return row.n;
}

/** Applications sent, replies and interviews: overall and for the last 7 days. */
export async function progress(userId: string, day = today()) {
  const jobs = await db
    .select({ status: schema.jobs.status, appliedOn: schema.jobs.appliedOn, createdAt: schema.jobs.createdAt })
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, userId));
  const weekAgo = addDays(day, -6);
  const applied = jobs.filter((j) => j.appliedOn);
  const heardBack = applied.filter((j) => j.status === "interview" || j.status === "offer" || j.status === "rejected");
  const interviews = jobs.filter((j) => j.status === "interview" || j.status === "offer");
  return {
    saved: jobs.length,
    applied: applied.length,
    appliedThisWeek: applied.filter((j) => j.appliedOn! >= weekAgo).length,
    responseRate: applied.length ? Math.round((heardBack.length / applied.length) * 100) : null,
    interviews: interviews.length,
    offers: jobs.filter((j) => j.status === "offer").length,
    waiting: applied.filter((j) => j.status === "applied").length,
  };
}

/** Everyone with follow-ups due today, for the daily email. */
export function allDueFollowUps(day = today()) {
  return db
    .select({ job: schema.jobs, email: schema.users.email, name: schema.users.name })
    .from(schema.jobs)
    .innerJoin(schema.users, eq(schema.users.id, schema.jobs.userId))
    .where(and(eq(schema.jobs.status, "applied"), isNotNull(schema.jobs.followUpOn), lte(schema.jobs.followUpOn, day), gte(schema.jobs.followUpOn, addDays(day, -60))));
}

