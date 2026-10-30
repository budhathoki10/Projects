"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { addDays } from "@/lib/dates";
import { extractJob } from "@/lib/jobs/extract";
import { fetchJobPost } from "@/lib/jobs/fetch-post";
import { scoreMatch } from "@/lib/match/score";
import { today } from "@/lib/plans";
import { createJob, deleteJob, isStatus, ownedJob, setFollowUp, setInterviewDate, setNotes, setStatus, setWeeklyGoal } from "@/lib/services/jobs";
import { getProfile, profileReady } from "@/lib/services/profile";
import { cleanText } from "@/lib/text";

export type JobState = { error?: string; needText?: boolean; url?: string } | undefined;

const FETCH_ERRORS = {
  login: "That site only shows job posts to signed-in users, so we can't read it. Copy the job description from the page and paste it below.",
  blocked: "That site doesn't let us read its pages. Copy the job description and paste it below.",
  unreachable: "We couldn't open that link. Check it, or paste the job description below.",
  too_short: "We couldn't find a job description on that page. Paste it below instead.",
} as const;

/** Add a job from a link or pasted text, read it, and check it against the profile. */
export async function addJob(_: JobState, formData: FormData): Promise<JobState> {
  const user = await requireUser();
  const url = String(formData.get("url") ?? "").trim();
  let text = cleanText(String(formData.get("text") ?? ""));
  let source: string | null = null;

  if (!text && url) {
    const fetched = await fetchJobPost(url);
    if (!fetched.ok) return { error: FETCH_ERRORS[fetched.reason], needText: true, url };
    text = fetched.text;
    source = fetched.url;
  } else if (url) {
    source = url;
  }
  if (text.length < 120) return { error: "Paste the full job description: the title, what you'd do and what they're looking for.", needText: true, url };

  const { post } = await extractJob(text.slice(0, 40_000));
  const profile = await getProfile(user.id);
  const job = await createJob(user.id, {
    url: source && /^https?:\/\//i.test(source) ? source.slice(0, 2000) : null,
    postText: text.slice(0, 40_000),
    post,
    match: profileReady(profile) ? scoreMatch(profile, post) : null,
  });
  revalidatePath("/app", "layout");
  redirect(`/app/jobs/${job.id}`);
}

async function requireJob(jobId: FormDataEntryValue | null) {
  const user = await requireUser();
  const job = await ownedJob(user.id, String(jobId ?? ""));
  if (!job) redirect("/app/jobs");
  return { user, job };
}

export async function changeStatus(formData: FormData) {
  const { user, job } = await requireJob(formData.get("jobId"));
  const status = formData.get("status");
  if (isStatus(status)) await setStatus(user.id, job.id, status);
  revalidatePath("/app", "layout");
}

export async function saveNotes(formData: FormData) {
  const { user, job } = await requireJob(formData.get("jobId"));
  await setNotes(user.id, job.id, String(formData.get("notes") ?? "").slice(0, 5000));
  revalidatePath(`/app/jobs/${job.id}`);
}

/** "I followed up" clears the reminder; "Remind me later" moves it four days out. */
export async function followUpAction(formData: FormData) {
  const { user, job } = await requireJob(formData.get("jobId"));
  const later = formData.get("op") === "later";
  await setFollowUp(user.id, job.id, later ? addDays(today(), 4) : null);
  revalidatePath("/app", "layout");
}

export async function removeJob(formData: FormData) {
  const { user, job } = await requireJob(formData.get("jobId"));
  await deleteJob(user.id, job.id);
  revalidatePath("/app", "layout");
  redirect("/app/jobs");
}

export async function interviewDateAction(formData: FormData) {
  const user = await requireUser();
  const jobId = String(formData.get("jobId") ?? "");
  const day = String(formData.get("day") ?? "");
  await setInterviewDate(user.id, jobId, /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null);
  revalidatePath("/app", "layout");
}

export async function weeklyGoalAction(formData: FormData) {
  const user = await requireUser();
  const goal = Number(formData.get("goal"));
  if (Number.isFinite(goal)) await setWeeklyGoal(user.id, goal);
  revalidatePath("/app");
}
