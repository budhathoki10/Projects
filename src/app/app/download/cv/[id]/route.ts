import sharp from "sharp";
import { requireUser } from "@/lib/auth/session";
import { cvDocxBuffer, cvFileName } from "@/lib/export/docx";
import { cvPdfBuffer } from "@/lib/export/pdf";
import { presentCv } from "@/lib/cv/presentation";
import { profileNeedsRepair } from "@/lib/cv/quality";
import { limitsFor } from "@/lib/plans";
import { getTailoredCv } from "@/lib/services/documents";
import { ownedJob } from "@/lib/services/jobs";
import { getPhoto } from "@/lib/services/photos";
import { getOriginalCv, getProfile, profileReady } from "@/lib/services/profile";
import { originalFileResponse } from "@/lib/cv/original";
import { resolveCvStyle } from "@/lib/services/templates";
import { applyChanges } from "@/lib/tailor/apply";
import { appUrl } from "@/lib/util";

/** The tailored CV as a Word file. Part of a paid plan. */
export async function GET(request: Request, ctx: RouteContext<"/app/download/cv/[id]">) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const query = new URL(request.url).searchParams;
  const pdf = query.get("format") === "pdf";
  if (!pdf && !limitsFor(user).docx) return Response.redirect(appUrl("/app/billing?for=docx"), 303);
  const [job, profile, doc] = await Promise.all([ownedJob(user.id, id), getProfile(user.id), getTailoredCv(user.id, id)]);
  if (!job || !profileReady(profile)) return new Response("Not found", { status: 404 });
  if (pdf && query.get("layout") !== "redesigned") {
    const original = await getOriginalCv(user.id);
    if (original?.type === "application/pdf") return originalFileResponse(original);
    if (query.get("layout") === "original") return new Response("Upload your original PDF in Your CV first. Its formatting cannot be recovered from extracted text alone.", { status: 409 });
  }
  if (profileNeedsRepair(profile)) return Response.redirect(appUrl("/app/profile?repair=1"), 303);
  const cv = presentCv(applyChanges(profile, doc?.sourceNeedsReview ? [] : doc?.cv?.changes ?? []), query.get("content") === "focused" ? "focused" : "full");
  let body: Buffer;
  if (pdf) {
    body = await cvPdfBuffer(cv);
  } else {
    const [{ spec }, photo] = await Promise.all([resolveCvStyle(user.id, job), getPhoto(user.id)]);
    const png = photo && spec.photo !== "off" ? await sharp(photo.image).png().toBuffer() : null;
    body = await cvDocxBuffer(cv, spec, png);
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${cvFileName(cv, job.post.title, pdf ? "pdf" : "docx")}"`,
      "cache-control": "private, no-store",
    },
  });
}
