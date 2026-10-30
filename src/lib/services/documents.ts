import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { InterviewQuestion, TailoredCv } from "@/lib/model/types";

async function find(userId: string, jobId: string, kind: "cv" | "cover_letter") {
  const [row] = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.userId, userId), eq(schema.documents.jobId, jobId), eq(schema.documents.kind, kind)))
    .limit(1);
  return row ?? null;
}

export const getTailoredCv = (userId: string, jobId: string) => find(userId, jobId, "cv");
export const getCoverLetter = (userId: string, jobId: string) => find(userId, jobId, "cover_letter");

export async function saveTailoredCv(userId: string, jobId: string, cv: TailoredCv) {
  const existing = await getTailoredCv(userId, jobId);
  if (existing) await db.update(schema.documents).set({ cv, updatedAt: new Date() }).where(eq(schema.documents.id, existing.id));
  else await db.insert(schema.documents).values({ userId, jobId, kind: "cv", cv });
}

/** Save edits in place. A fresh draft (`replace`) starts a new document, so the editor knows to reload. */
export async function saveCoverLetter(userId: string, jobId: string, text: string, opts: { replace?: boolean } = {}) {
  const existing = await getCoverLetter(userId, jobId);
  if (existing && !opts.replace) {
    await db.update(schema.documents).set({ text, updatedAt: new Date() }).where(eq(schema.documents.id, existing.id));
    return;
  }
  if (existing) await db.delete(schema.documents).where(eq(schema.documents.id, existing.id));
  await db.insert(schema.documents).values({ userId, jobId, kind: "cover_letter", text });
}

export async function getInterview(userId: string, jobId: string) {
  const [row] = await db
    .select()
    .from(schema.interviews)
    .where(and(eq(schema.interviews.userId, userId), eq(schema.interviews.jobId, jobId)))
    .limit(1);
  return row ?? null;
}

export async function saveInterview(userId: string, jobId: string, questions: InterviewQuestion[]) {
  await db
    .insert(schema.interviews)
    .values({ userId, jobId, questions })
    .onConflictDoUpdate({ target: schema.interviews.jobId, set: { questions, updatedAt: new Date() } });
}

/** Ids of this user's jobs that have a tailored CV, and those with interview practice started. */
export async function preparedJobIds(userId: string) {
  const [cvs, practice] = await Promise.all([
    db.select({ jobId: schema.documents.jobId }).from(schema.documents).where(and(eq(schema.documents.userId, userId), eq(schema.documents.kind, "cv"))),
    db.select({ jobId: schema.interviews.jobId, questions: schema.interviews.questions }).from(schema.interviews).where(eq(schema.interviews.userId, userId)),
  ]);
  return {
    tailored: new Set(cvs.map((r) => r.jobId)),
    practised: new Set(practice.filter((r) => r.questions.some((q) => q.answer.trim())).map((r) => r.jobId)),
  };
}
