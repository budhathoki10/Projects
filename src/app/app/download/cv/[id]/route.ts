import { requireUser } from "@/lib/auth/session";
import { cvDocxBuffer, cvFileName } from "@/lib/export/docx";
import { limitsFor } from "@/lib/plans";
import { getTailoredCv } from "@/lib/services/documents";
import { ownedJob } from "@/lib/services/jobs";
import { getPhoto } from "@/lib/services/photos";
import { getProfile, profileReady } from "@/lib/services/profile";
import { resolveCvStyle } from "@/lib/services/templates";
import sharp from "sharp";
import { applyChanges } from "@/lib/tailor/apply";
import { appUrl } from "@/lib/util";

/** The tailored CV as a Word file. Part of the Job-hunt pass. */
export async function GET(_: Request, ctx: RouteContext<"/app/download/cv/[id]">) {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!limitsFor(user).docx) return Response.redirect(appUrl("/app/billing?for=docx"), 303);
  const [job, profile, doc] = await Promise.all([ownedJob(user.id, id), getProfile(user.id), getTailoredCv(user.id, id)]);
  if (!job || !profileReady(profile)) return new Response("Not found", { status: 404 });
  const cv = applyChanges(profile, doc?.cv?.changes ?? []);
  const [{ spec }, photo] = await Promise.all([resolveCvStyle(user.id, job), getPhoto(user.id)]);
  // Word can't show WebP, so the stored photo goes in as PNG.
  const png = photo && spec.photo !== "off" ? await sharp(photo.image).png().toBuffer() : null;
  const body = await cvDocxBuffer(cv, spec, png);
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${cvFileName(cv, job.post.title, "docx")}"`,
      "cache-control": "private, no-store",
    },
  });
}
