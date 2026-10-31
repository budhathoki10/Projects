"use client";

import { useId, useRef, type ReactNode } from "react";
import { SubmitButton } from "./submit-button";
import { Button } from "./ui";

/**
 * A destructive action behind a dialog that names exactly what will be lost, with the confirm
 * button saying what it does ("Delete job", never "OK"). It's a native <dialog>: Esc cancels,
 * focus is trapped inside, and returns to the trigger when it closes.
 */
export function ConfirmAction({
  trigger,
  title,
  children,
  confirmLabel,
  pendingLabel = "Working…",
  action,
  fields,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded text-[13px] text-muted transition-colors duration-150 hover:text-danger max-sm:min-h-11"
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl p-6 shadow-xl shadow-black/10"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <form action={action}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={titleId} className="t-title">
            {title}
          </h2>
          <div className="mt-2 text-sm text-muted">{children}</div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>
              Cancel
            </Button>
            <SubmitButton variant="danger" pendingLabel={pendingLabel}>
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
