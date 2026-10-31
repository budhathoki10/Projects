import { redirect } from "next/navigation";

/** The application plan moved onto the job's Fit tab; old links land there. */
export default async function PlanMoved({ params }: PageProps<"/app/jobs/[id]/plan">) {
  const { id } = await params;
  redirect(`/app/jobs/${id}`);
}
