"use client";

import { useToast } from "./toast";
import { Button } from "./ui";

/** Copies text and says so. If the browser blocks the clipboard, the text is already selectable on the page. */
export function CopyButton({ text, label = "Copy", what = "Copied" }: { text: string; label?: string; what?: string }) {
  const toast = useToast();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.show({ message: what, tone: "success", duration: 2500 });
        } catch {
          toast.show({ tone: "error", message: "Couldn’t copy. Select the text and copy it instead." });
        }
      }}
    >
      {label}
    </Button>
  );
}
