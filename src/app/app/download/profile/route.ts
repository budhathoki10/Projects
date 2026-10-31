import { requireUser } from "@/lib/auth/session";
import { presentCv } from "@/lib/cv/presentation";
import { profileNeedsRepair } from "@/lib/cv/quality";
import { cvPdfBuffer } from "@/lib/export/pdf";
import { cvFileName } from "@/lib/export/docx";
import { getOriginalCv, getProfile, profileReady } from "@/lib/services/profile";
import { originalFileResponse } from "@/lib/cv/original";
import { appUrl } from "@/lib/util";

export async function GET(request: Request) {
  const user = await requireUser();
  const query = new URL(request.url).searchParams;
  if (query.get("layout") !== "redesigned") {
    const original = await getOriginalCv(user.id);
    if (original?.type === "application/pdf") return originalFileResponse(original);
  }
  const profile = await getProfile(user.id);
  if (!profileReady(profile) || profileNeedsRepair(profile)) return Response.redirect(appUrl("/app/profile?repair=1"), 303);
  const cv = presentCv(profile, query.get("content") === "focused" ? "focused" : "full");
  return new Response(new Uint8Array(await cvPdfBuffer(cv)), { headers: {
    "content-type": "application/pdf", "content-disposition": `attachment; filename="${cvFileName(cv, "", "pdf")}"`, "cache-control": "private, no-store",
  } });
}
