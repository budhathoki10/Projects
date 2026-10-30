"use client";

import { useActionState } from "react";
import type { TailorState } from "@/app/actions/tailor";
import { Button, FormMessage } from "./ui";

/** One button that runs an AI action for a job and shows what happened. */
export function AiActionButton({
  action: serverAction,
  jobId,
  label,
  pendingLabel,
  variant = "primary",
}: {
  action: (state: TailorState, formData: FormData) => Promise<TailorState>;
  jobId: string;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}
