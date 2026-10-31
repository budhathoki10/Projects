import { Skeleton } from "@/components/ui";

/** The job page's tab content: a result header and a list of rows. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="flex items-end gap-6">
        <Skeleton className="h-14 w-28" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-56 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
