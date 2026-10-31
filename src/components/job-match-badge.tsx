import type { JobPost, Match } from "@/lib/model/types";
import { jobHasCriteria } from "@/lib/jobs/quality";
import { Badge, scoreTone } from "./ui";

export function JobMatchBadge({ post, match }: { post: JobPost; match: Match | null }) {
  if (!jobHasCriteria(post)) return <Badge tone="warn">Needs description</Badge>;
  return match ? <Badge tone={scoreTone(match.score)}>{match.score}% match</Badge> : <Badge>Add your CV</Badge>;
}
