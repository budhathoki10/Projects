import { requireUser } from "@/lib/auth/session";
import { originalFileResponse } from "@/lib/cv/original";
import { getOriginalCv } from "@/lib/services/profile";

/** The source document, without a re-export that could change its typography or links. */
export async function GET(request: Request) {
  const user = await requireUser();
  const file = await getOriginalCv(user.id);
  if (!file) return new Response("Original CV not saved. Upload the original file in Your CV.", { status: 404 });
  return originalFileResponse(file, new URL(request.url).searchParams.get("inline") === "1");
}
