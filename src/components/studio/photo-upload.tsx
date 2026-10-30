"use client";

import { useActionState, useRef } from "react";
import { removePhotoAction, uploadPhotoAction } from "@/app/actions/templates";
import { Icon } from "@/components/icons";
import { FormMessage } from "@/components/ui";

/** Upload, replace or remove the profile photo. It's re-encoded on the server and stays private. */
export function PhotoUpload({ photoUrl }: { photoUrl: string | null }) {
  const [state, upload, uploading] = useActionState(uploadPhotoAction, undefined);
  const [removed, remove, removing] = useActionState(removePhotoAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  const message = removed?.success && !state?.success ? removed : state;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-subtle ring-1 ring-border">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, per-user image
          <img src={photoUrl} alt="Your photo" className="size-full object-cover" />
        ) : (
          <Icon name="photo" size={26} className="text-faint" />
        )}
      </div>
      <div className="space-y-2">
        <form ref={form} action={upload}>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-strong-border bg-surface px-3 text-[13px] font-medium hover:border-hover-border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand">
            <Icon name="photo" size={15} />
            {uploading ? "Uploading…" : photoUrl ? "Replace photo" : "Add a photo"}
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={() => form.current?.requestSubmit()}
              disabled={uploading}
            />
          </label>
        </form>
        {photoUrl && (
          <form action={remove}>
            <button type="submit" disabled={removing} className="text-[13px] text-muted underline underline-offset-4 hover:text-foreground">
              Remove photo
            </button>
          </form>
        )}
        <p className="text-[12px] text-muted">JPEG, PNG or WebP, up to 3 MB. We crop it square and remove location data.</p>
      </div>
      <div className="w-full">
        <FormMessage error={message?.error} success={message?.success} />
      </div>
    </div>
  );
}
