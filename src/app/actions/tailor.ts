"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { scoreMatch } from "@/lib/match/score";
import type { UsageKind } from "@/lib/plans";
import { getCoverLetter, getInterview, getTailoredCv, saveCoverLetter, saveInterview, saveTailoredCv } from "@/lib/services/documents";
import { ownedJob, setMatch } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";
import { refundAllowance, spendAllowance } from "@/lib/services/usage";
import { writeCoverLetter } from "@/lib/tailor/cover-letter";
import { answerFeedback, interviewQuestions } from "@/lib/tailor/interview";
import { proposeChanges } from "@/lib/tailor/tailor";

export type TailorState = { error?: string; success?: string } | undefined;

const LIMIT_MESSAGE = "That's this month's free allowance used. A Job-hunt pass removes the limit for 30 or 90 days.";

async function context(jobId: FormDataEntryValue | null) {
  const user = await requireUser();
  const job = await ownedJob(user.id, String(jobId ?? ""));
  if (!job) redirect("/app/jobs");
  const profile = await getProfile(user.id);
  if (!profileReady(profile)) redirect("/app/profile?needed=1");
  // Always score against the latest profile.
  const match = scoreMatch(profile, job.post);
  await setMatch(job.id, match);
  return { user, job, profile, match };
}

/** Run AI work against the monthly allowance, giving the use back if the work throws. */
async function metered<T>(userId: string, passUntil: Date | null, kind: UsageKind, work: () => Promise<T>): Promise<T | null> {
  if (!(await spendAllowance({ id: userId, passUntil }, kind))) return null;
  try {
    return await work();
  } catch (err) {
    await refundAllowance(userId, kind);
    throw err;
  }
}

export async function tailorCv(_: TailorState, formData: FormData): Promise<TailorState> {
  const { user, job, profile, match } = await context(formData.get("jobId"));
  const result = await metered(user.id, user.passUntil, "tailor", () => proposeChanges(profile, job.post, match));
  if (!result) return { error: LIMIT_MESSAGE };
  await saveTailoredCv(user.id, job.id, { changes: result.changes });
  revalidatePath(`/app/jobs/${job.id}/cv`);
  const blocked = result.changes.filter((c) => c.flags.length > 0).length;
  return {
    success:
      result.changes.length === 0
        ? "Your CV already fits this job well. Nothing worth changing."
        : `${result.changes.length} suggested change${result.changes.length === 1 ? "" : "s"}.${blocked ? ` ${blocked} blocked because they added something that isn't in your CV.` : ""}`,
  };
}

/** Accept or reject one suggested change. Changes the fact check blocked can't be accepted. */
export async function toggleChange(formData: FormData) {
  const user = await requireUser();
  const jobId = String(formData.get("jobId") ?? "");
  const doc = await getTailoredCv(user.id, jobId);
  if (!doc?.cv) return;
  const id = String(formData.get("changeId"));
  const accept = formData.get("accept") === "1";
  const changes = doc.cv.changes.map((c) => (c.id === id && c.flags.length === 0 ? { ...c, accepted: accept } : c));
  await saveTailoredCv(user.id, jobId, { changes });
  revalidatePath(`/app/jobs/${jobId}/cv`);
}

export async function writeCover(_: TailorState, formData: FormData): Promise<TailorState> {
  const { user, job, profile, match } = await context(formData.get("jobId"));
  const result = await metered(user.id, user.passUntil, "cover", () => writeCoverLetter(profile, job.post, match));
  if (!result) return { error: LIMIT_MESSAGE };
  await saveCoverLetter(user.id, job.id, result.text, { replace: true });
  revalidatePath(`/app/jobs/${job.id}/cover-letter`);
  return { success: "Here's a draft. Make it sound like you before sending." };
}

export async function saveCover(_: TailorState, formData: FormData): Promise<TailorState> {
  const user = await requireUser();
  const job = await ownedJob(user.id, String(formData.get("jobId") ?? ""));
  if (!job) return { error: "Job not found." };
  const text = String(formData.get("text") ?? "").slice(0, 8000);
  if (!(await getCoverLetter(user.id, job.id)) && !text.trim()) return { error: "The letter is empty." };
  await saveCoverLetter(user.id, job.id, text);
  revalidatePath(`/app/jobs/${job.id}/cover-letter`);
  return { success: "Saved." };
}

export async function prepareInterview(_: TailorState, formData: FormData): Promise<TailorState> {
  const { user, job, profile, match } = await context(formData.get("jobId"));
  const questions = await metered(user.id, user.passUntil, "interview", () => interviewQuestions(profile, job.post, match));
  if (!questions) return { error: LIMIT_MESSAGE };
  await saveInterview(user.id, job.id, questions);
  revalidatePath(`/app/jobs/${job.id}/interview`);
  return { success: `${questions.length} questions to practise.` };
}

/** Feedback on one practice answer. Counts against the interview allowance like a new set of questions. */
export async function practiseAnswer(_: TailorState, formData: FormData): Promise<TailorState> {
  const { user, job, profile } = await context(formData.get("jobId"));
  const session = await getInterview(user.id, job.id);
  const qid = String(formData.get("questionId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim().slice(0, 6000);
  const q = session?.questions.find((x) => x.id === qid);
  if (!session || !q) return { error: "That question isn't there any more. Refresh the page." };
  if (answer.split(/\s+/).length < 15) return { error: "Write your answer out as you'd say it, at least a few sentences." };
  const feedback = await metered(user.id, user.passUntil, "interview", () => answerFeedback(q.question, answer, profile, job.post));
  if (!feedback) return { error: LIMIT_MESSAGE };
  await saveInterview(
    user.id,
    job.id,
    session.questions.map((x) => (x.id === qid ? { ...x, answer, feedback } : x)),
  );
  revalidatePath(`/app/jobs/${job.id}/interview`);
  return { success: "Feedback below." };
}
