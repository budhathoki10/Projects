"use client";

import type { ComponentProps } from "react";
import { Button } from "./ui";
import { useHydrated } from "./use-hydrated";

/**
 * Submit button for forms handled in JavaScript. It stays disabled until the page is interactive:
 * a click before then would be a plain browser form submit, which for a login form puts the
 * password in the URL. (An Enter key press is blocked too, because the form's default button is disabled.)
 */
export function FormSubmit({ disabled, ...props }: Omit<ComponentProps<typeof Button>, "type">) {
  const hydrated = useHydrated();
  return <Button type="submit" disabled={disabled || !hydrated} {...props} />;
}
